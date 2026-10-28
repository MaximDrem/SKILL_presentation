// pptxgen-adapter.cjs — production build через vendored PptxGenJS 4.0.1.
// PptxGenJS создаёт content-only временную деку (структура фигур/текста/чартов),
// generic OOXML normalizer приводит её к python-pptx канону, OPC merge переносит
// фигуры + dependency graphs (images/charts) в shell пакета (blank/template).
// Legacy fallback НЕТ: сбой адаптера — exit 3.
'use strict';
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("../../../vendor/pptxgenjs.bundle.cjs");
const { El } = require("../xml.cjs");
const { NS_A, NS_P, NS_R, mk, sub, findL, removeL } = require("./xmlbuild.cjs");
const { asNum, numToken } = require("../jsonpy.cjs");
const { pyRound } = require("../numfmt.cjs");
const { splitHex } = require("./xmlbuild.cjs");

const EMU_PER_IN = 914400;

class AdapterError extends Error {}

function inOf(pxVal, k) { return asNum(pxVal) * k / EMU_PER_IN; } // px → inches

// ---------- page model → PptxGenJS ----------

const ALIGN_TO_PGX = { l: "left", ctr: "center", r: "right", just: "justify" };
const ANCHOR_TO_PGX = { t: "top", ctr: "middle", b: "bottom" };

function splitColor(c) {
  // "#RRGGBB" или "#RRGGBBAA" → {color, transparency}
  const [hex, alpha] = splitHex(c);
  if (alpha === null || alpha === undefined || alpha === 255) return { color: hex };
  return { color: hex, transparency: Math.round((255 - alpha) / 255 * 100) };
}

function addTextEl(slide, el, k) {
  const [x, y, w, h] = el.bounds.map((v) => inOf(v, k));
  const box = {
    x, y, w, h, margin: 0,
    ...(el.anchor ? { valign: ANCHOR_TO_PGX[el.anchor] } : {}),
    wrap: true,
  };
  const items = [];
  const paras = el.paragraphs || [];
  paras.forEach((p, pi) => {
    const runs = (p.runs || []).map((r) => ({
      text: String(r.text ?? ""),
      options: {
        ...(r.sz !== undefined && r.sz !== null ? { fontSize: asNum(r.sz) } : {}),
        ...(r.b ? { bold: true } : {}),
        ...(r.i ? { italic: true } : {}),
        ...(r.font ? { fontFace: r.font } : {}),
        ...(typeof r.color === "string" ? splitColor(r.color) : {}),
        ...(r.link ? { hyperlink: { url: r.link } } : {}),
      },
    }));
    if (!runs.length) runs.push({ text: "", options: {} });
    runs[runs.length - 1].options.breakLine = true; // breakLine только на последнем run параграфа
    // paragraph-level options на первом run параграфа
    const first = runs[0].options;
    if (p.align) first.align = ALIGN_TO_PGX[p.align];
    if (p.lineHeight !== undefined && p.lineHeight !== null) first.lineSpacingMultiple = asNum(p.lineHeight);
    if (p.spcBef !== undefined && p.spcBef !== null) first.paraSpaceBefore = asNum(p.spcBef);
    if (p.spcAft !== undefined && p.spcAft !== null) first.paraSpaceAfter = asNum(p.spcAft);
    if (p.bullet === "char") first.bullet = { characterCode: (p.bulletChar || "•").codePointAt(0).toString(16).toUpperCase() };
    else if (p.bullet === "none") first.bullet = false;
    items.push(...runs);
    void pi;
  });
  slide.addText(items, box);
}

function addShapeEl(slide, el, k) {
  const [x, y, w, h] = el.bounds.map((v) => inOf(v, k));
  const o = { x, y, w, h };
  if (el.rotation !== undefined && el.rotation !== null) o.rotate = asNum(el.rotation);
  if (el.flip && typeof el.flip === "object") {
    if (el.flip.h) o.flipH = true;
    if (el.flip.v) o.flipV = true;
  }
  const f = el.fill;
  if (f && typeof f === "object") {
    if (f.none) o.fill = { type: "none" }; // → no fill element; normalizer добавит a:noFill
    else if (typeof f.solid === "string") o.fill = splitColor(f.solid);
    else if (f.gradient && Array.isArray(f.gradient.stops)) {
      // PptxGenJS градиентов нет → normalizer вставит из source model
      o.fill = splitColor(f.gradient.stops[0][1]);
    }
  }
  if (el.line && typeof el.line === "object") {
    o.line = {
      ...(typeof el.line.color === "string" ? splitColor(el.line.color) : {}),
      ...(el.line.w !== undefined && el.line.w !== null ? { width: asNum(el.line.w) } : {}),
    };
  } else {
    o.line = { type: "none" }; // → пустой a:ln; normalizer добавит a:noFill
  }
  // shadow/flip/rotation — normalizer берёт из source model (точные токены)
  slide.addShape(el.shape, o);
}

function addImageEl(slide, el, k, projectDir) {
  const [x, y, w, h] = el.bounds.map((v) => inOf(v, k));
  const fpath = path.join(projectDir, "media", String(el.src).startsWith("media/") ? String(el.src).slice(6) : String(el.src));
  const o = { path: fpath, x, y, w, h };
  if (el.rotation !== undefined && el.rotation !== null) o.rotate = asNum(el.rotation);
  if (el.flip && typeof el.flip === "object") {
    if (el.flip.h) o.flipH = true;
    if (el.flip.v) o.flipV = true;
  }
  if (el.opacity !== undefined && el.opacity !== null) o.transparency = Math.round((1 - asNum(el.opacity)) * 100);
  // srcRect/crop — normalizer пишет из source model (python-позиция/округление)
  slide.addImage(o);
}

function addTableEl(slide, el, k) {
  const [x, y, w, h] = el.bounds.map((v) => inOf(v, k));
  const tb = el.table;
  const rows = tb.rows.map((row) => row.map((cell) => ({
    text: String(cell.text ?? ""),
    options: {
      ...(cell.colSpan ? { colspan: cell.colSpan } : {}),
      ...(cell.rowSpan ? { rowspan: cell.rowSpan } : {}),
      ...(typeof cell.fill === "string" ? { fill: splitColor(cell.fill) } : {}),
      ...(typeof cell.color === "string" ? { color: splitColor(cell.color).color } : {}),
      ...(cell.sz !== undefined && cell.sz !== null ? { fontSize: asNum(cell.sz) } : {}),
      ...(cell.align ? { align: ALIGN_TO_PGX[cell.align] } : {}),
      valign: "middle",
      margin: 0,
    },
  })));
  slide.addTable(rows, {
    x, y, w, h,
    colW: tb.colW.map((v) => inOf(v, k)),
    border: { type: "none" },
    margin: 0,
  });
}

// ---------- content deck ----------

// pages: [{file, idx, spec}] (proto порядок); opts: {k, projectDir, slideWEmu, slideHEmu}
async function renderContentDeck(pages, opts) {
  const { k, projectDir } = opts;
  // PptxGenJS пишет warnings в console — CLI stdout/stderr contract не должен их видеть
  const origWarn = console.warn, origErr = console.error;
  const captured = [];
  console.warn = (...a) => captured.push(a.join(" "));
  console.error = (...a) => captured.push(a.join(" "));
  try {
    return await renderContentDeckInner(pages, opts, captured);
  } finally {
    console.warn = origWarn;
    console.error = origErr;
  }
}

async function renderContentDeckInner(pages, opts, captured) {
  const { k, projectDir } = opts;
  let pgx;
  try {
    pgx = new PptxGenJS();
    pgx.defineLayout({ name: "SKILL", width: opts.slideWEmu / EMU_PER_IN, height: opts.slideHEmu / EMU_PER_IN });
    pgx.layout = "SKILL";
  } catch (e) {
    throw new AdapterError(`pptxgenjs init: ${e.message}`);
  }
  for (const item of pages) {
    const slide = pgx.addSlide();
    const els = Array.isArray(item.spec.elements) ? item.spec.elements : [];
    for (const el of els) {
      if (el.__svg) continue; // SVG → native custGeom в shell (svgshape), не через PptxGenJS
      try {
        if (el.type === "text") addTextEl(slide, el, k);
        else if (el.type === "shape") addShapeEl(slide, el, k);
        else if (el.type === "image") addImageEl(slide, el, k, projectDir);
        else if (el.type === "table") addTableEl(slide, el, k);
        else if (el.type === "chart") require("./pptxgen-chart.cjs").addChartEl(slide, el, k);
        else throw new AdapterError(`непереводимый type=${el.type}`);
      } catch (e) {
        if (e instanceof AdapterError) throw e;
        throw new AdapterError(`${item.file} el ${el.id || "?"}: ${e.message}`);
      }
    }
  }
  try {
    return await pgx.write({ outputType: "nodebuffer" });
  } catch (e) {
    throw new AdapterError(`pptxgenjs write: ${e.message}${captured.length ? " [" + captured.join("; ") + "]" : ""}`);
  }
}

// ---------- OPC merge: content deck → shell slide ----------

// Графтит фигуры content-слайда (PptxGenJS) в shell-слайд: нормализация,
// id/name назначаются вызывающим (nextShapeId/setShapeNameDescr).
// elements — source page model (для точных числовых значений и fills).
// importImage(blob|src) → rId для r:embed ремаппинга.
// после graft: точные a:off/a:ext из source bounds общим Python-compatible px()
// (PptxGenJS пишет Math.round(inches*EMU) — half-EMU расходится для non-16:9)
function applyBounds(sh, el, k) {
  if (!Array.isArray(el.bounds)) return;
  const { px } = require("./elhelpers.cjs");
  const holder = findL(sh, "spPr") || sh; // sp/pic: spPr/xfrm; graphicFrame: xfrm напрямую
  const xf = findL(holder, "xfrm");
  if (!xf) return;
  const off = findL(xf, "off"), ext = findL(xf, "ext");
  if (off) { off.attrs.set("x", String(px(el.bounds[0], k))); off.attrs.set("y", String(px(el.bounds[1], k))); }
  if (ext) { ext.attrs.set("cx", String(px(el.bounds[2], k))); ext.attrs.set("cy", String(px(el.bounds[3], k))); }
}

function graftSlideContent(shellSpTree, contentSlidePart, elements, { importImageRel, k, pkg, shellSlidePart, chartTextRgb }) {
  const norm = require("./pptxgen-normalize.cjs");
  const cSld = findL(contentSlidePart.xmlEl, "cSld");
  const spTree = findL(cSld, "spTree");
  const shapes = spTree.children.filter((c) => c instanceof El && !["nvGrpSpPr", "grpSpPr"].includes(c.local));
  if (shapes.length !== elements.length) {
    throw new AdapterError(`content deck: фигур ${shapes.length} ≠ элементов ${elements.length}`);
  }
  const out = [];
  shapes.forEach((sh, i) => {
    const el = elements[i];
    if (el.type === "text") norm.normalizeTextShape(sh, el);
    else if (el.type === "shape") norm.normalizeShape(sh, el);
    else if (el.type === "image") {
      norm.normalizePic(sh, el);
      // r:embed → shell rId (sha1 dedup через importImageRel)
      const blipFill = findL(sh, "blipFill");
      const blip = findL(blipFill, "blip");
      const embedKey = `{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed`;
      const oldRid = blip.attrs.get(embedKey);
      const target = contentSlidePart.rels.get(oldRid);
      const contentPkg = contentSlidePart.pkg;
      const mediaPart = target ? contentPkg.parts.get(target.target) : null;
      const newRid = importImageRel(mediaPart ? mediaPart.blob : null, el);
      blip.attrs.set(embedKey, newRid);
    } else if (el.type === "table") {
      norm.normalizeTable(sh, el, k);
    } else if (el.type === "chart") {
      require("./pptxgen-chart.cjs").importChart(sh, el, contentSlidePart, { pkg, shellSlidePart, k, textRgb: chartTextRgb });
    }
    applyBounds(sh, el, k);
    out.push(sh);
  });
  void shellSpTree; // порядок/z-order собирает вызывающий (interleave с svg/decor)
  return out;
}

module.exports = { renderContentDeck, graftSlideContent, applyBounds, AdapterError, EMU_PER_IN };
