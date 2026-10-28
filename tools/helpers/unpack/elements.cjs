// elements.cjs — разбор элементов слайдов unpack (порт unpack/elements.py v3.2.1).
'use strict';
const path = require("path");
const { geoFacts, parseColor, parseFill, parseLn, parseShadow } = require("./colors.cjs");
const { atlasToPageGrammar } = require("./grammar.cjs");
const { attrsOf, childrenOf, findDesc, first, jsNum, kidOf, kidsOf, resolveTarget, r1, r2, tagOf, textOf } = require("./ooxml.cjs");
const { parseLvlStyles, txStyleClass } = require("./styles.cjs");
const { parseBodyPr, parseText } = require("./text.cjs");
const { pyJsonDumps } = require("../numfmt.cjs");

const XFORM_ID = { sx: 1, sy: 1, tx: 0, ty: 0 };

const _list = (x) => (Array.isArray(x) ? x : []);

function _applyT(t, x, y) {
  return [t.tx + x * t.sx, t.ty + y * t.sy];
}

function _composeT(parent, off, ext, chOff, chExt) {
  const sx = parent.sx * (ext.cx / chExt.cx);
  const sy = parent.sy * (ext.cy / chExt.cy);
  return {
    sx, sy,
    tx: parent.tx + (off.x - chOff.x * (ext.cx / chExt.cx)) * parent.sx,
    ty: parent.ty + (off.y - chOff.y * (ext.cy / chExt.cy)) * parent.sy,
  };
}

function xfrmOf(blockNode, xfrmTag = "a:xfrm") {
  const x = kidOf(blockNode, xfrmTag);
  if (x === null) return null;
  const a = attrsOf(x);
  const off = kidOf(x, "a:off");
  const ext = kidOf(x, "a:ext");
  const chOff = kidOf(x, "a:chOff");
  const chExt = kidOf(x, "a:chExt");
  return {
    rot: a.rot !== undefined && a.rot !== null ? parseFloat(a.rot) / 60000 : 0,
    flipH: a.flipH === "1",
    flipV: a.flipV === "1",
    off: off !== null ? { x: parseFloat(attrsOf(off).x), y: parseFloat(attrsOf(off).y) } : null,
    ext: ext !== null ? { cx: parseFloat(attrsOf(ext).cx), cy: parseFloat(attrsOf(ext).cy) } : null,
    chOff: chOff !== null ? { x: parseFloat(attrsOf(chOff).x), y: parseFloat(attrsOf(chOff).y) } : null,
    chExt: chExt !== null ? { cx: parseFloat(attrsOf(chExt).cx), cy: parseFloat(attrsOf(chExt).cy) } : null,
  };
}

function boundsPx(xf, t, scale) {
  if (!xf || !xf.off || !xf.ext) return null;
  const [x, y] = _applyT(t, xf.off.x, xf.off.y);
  return [r1(x * scale.kx), r1(y * scale.ky), r1(xf.ext.cx * t.sx * scale.kx), r1(xf.ext.cy * t.sy * scale.ky)];
}

function kindOfUri(uri) {
  if (uri.includes("diagram")) return "smartart";
  if (uri.includes("video") || uri.includes("media")) return "video";
  if (uri.includes("ole")) return "ole";
  return "other";
}

function parseTable(tblNode, scale, ctx, counters) {
  const cols = kidsOf(kidOf(tblNode, "a:tblGrid"), "a:gridCol").map((g) => parseFloat(attrsOf(g).w));
  const tblPr = kidOf(tblNode, "a:tblPr");
  const tblPrA = attrsOf(tblPr);
  const styleIdNode = tblPr !== null ? kidOf(tblPr, "a:tableStyleId") : null;
  const styleId = styleIdNode !== null ? (textOf(styleIdNode) || null) : null;
  const rows = [];
  for (const tr of kidsOf(tblNode, "a:tr")) {
    const h = parseFloat(attrsOf(tr).h ?? 0);
    const cells = [];
    for (const tc of kidsOf(tr, "a:tc")) {
      const tcPr = kidOf(tc, "a:tcPr");
      const tcPrA = attrsOf(tcPr);
      const solid = tcPr !== null ? kidOf(tcPr, "a:solidFill") : null;
      const fillC = solid !== null ? parseColor(solid, ctx.clrMap, ctx.theme) : null;
      const txBody = kidOf(tc, "a:txBody");
      const borders = {};
      for (const [tag2, key] of [["a:lnL", "l"], ["a:lnR", "r"], ["a:lnT", "t"], ["a:lnB", "b"]]) {
        const ln = tcPr !== null ? kidOf(tcPr, tag2) : null;
        if (ln === null) continue;
        const la = attrsOf(ln);
        const lSolid = kidOf(ln, "a:solidFill");
        const lc = lSolid !== null ? parseColor(lSolid, ctx.clrMap, ctx.theme) : null;
        const side = {};
        if (la.w !== undefined && la.w !== null) side.w = r1(parseFloat(la.w) / 9525);
        if (lc && lc.hex) side.color = lc.hex;
        if (Object.keys(side).length) borders[key] = side;
      }
      const cell = { text: txBody !== null ? parseText(txBody, { ...ctx, chain: ctx.tableChain || [] }, counters) : [] };
      if (fillC && fillC.hex) cell.fill = fillC.hex;
      else if (fillC) cell.fill = fillC;
      else if (tcPr !== null && kidOf(tcPr, "a:noFill") !== null) cell.fill = "none";
      if (tcPrA.anchor && tcPrA.anchor !== "t") cell.anchor = tcPrA.anchor;
      if (tcPrA.gridSpan) cell.colSpan = parseInt(tcPrA.gridSpan, 10);
      if (tcPrA.rowSpan) cell.rowSpan = parseInt(tcPrA.rowSpan, 10);
      if (tcPrA.hMerge === "1" || tcPrA.vMerge === "1") cell.merged = true;
      if (Object.keys(borders).length) cell.borders = borders;
      cells.push(cell);
    }
    rows.push({ h: r1(h * scale.ky), cells });
  }
  const out = { cols: cols.map((w) => r1(w * scale.kx)), rows };
  if (styleId) out.tableStyle = styleId;
  out.flags = {
    firstRow: tblPrA.firstRow === "1", lastRow: tblPrA.lastRow === "1",
    firstCol: tblPrA.firstCol === "1", lastCol: tblPrA.lastCol === "1",
    bandRow: tblPrA.bandRow === "1", bandCol: tblPrA.bandCol === "1",
  };
  return out;
}

const CHART_KIND_TAGS = [["c:barChart", "bar"], ["c:lineChart", "line"], ["c:pieChart", "pie"],
                         ["c:doughnutChart", "doughnut"], ["c:areaChart", "area"], ["c:scatterChart", "scatter"]];

function cachePts(refNode) {
  if (refNode === null || refNode === undefined) return null;
  const cache = first(kidOf(refNode, "c:strCache"), kidOf(refNode, "c:numCache"), kidOf(refNode, "c:multiLvlStrCache"));
  if (cache === null) return null;
  const pts = [];
  const walk = (n) => {
    for (const c of childrenOf(n)) {
      if (tagOf(c) === "c:pt") {
        pts.push({ idx: parseInt(attrsOf(c).idx, 10), v: textOf(kidOf(c, "c:v")) });
      } else {
        walk(c);
      }
    }
  };
  walk(cache);
  pts.sort((a, b) => a.idx - b.idx);
  return pts.map((p) => p.v);
}

function _toNum(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const f = parseFloat(v);
  if (Number.isNaN(f)) return null;
  // Python float(v): строка должна быть числом целиком
  if (!/^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(String(v))) return null;
  return f;
}

function parseChartPart(chartRoot, clrMap, theme) {
  const chart = findDesc(chartRoot, "c:chart");
  const plotArea = chart !== null ? findDesc(chart, "c:plotArea") : null;
  const chartNodes = plotArea !== null
    ? childrenOf(plotArea).filter((n) => /^c:\w+Chart$/.test(tagOf(n) || ""))
    : [];
  const hit = chartNodes.length === 1 ? Object.fromEntries(CHART_KIND_TAGS)[tagOf(chartNodes[0])] : null;
  if (!hit) return { kind: "other" };
  const kind = hit, cn = chartNodes[0];
  const series = [], colors = [];
  for (const ser of kidsOf(cn, "c:ser")) {
    const tx = kidOf(ser, "c:tx");
    let name = null;
    if (tx !== null) {
      const namePts = cachePts(kidOf(tx, "c:strRef"));
      if (namePts) {
        name = namePts[0];
      } else {
        const v = kidOf(tx, "c:v");
        if (v !== null) name = textOf(v);
      }
    }
    const cat = first(kidOf(ser, "c:cat"), kidOf(ser, "c:xVal"));
    const val = first(kidOf(ser, "c:val"), kidOf(ser, "c:yVal"));
    const categories = cat !== null ? cachePts(first(kidOf(cat, "c:strRef"), kidOf(cat, "c:numRef"), kidOf(cat, "c:multiLvlStrRef"))) : null;
    const valuesRaw = val !== null ? cachePts(kidOf(val, "c:numRef")) : null;
    const s = {};
    if (name !== null && name !== "") s.name = name;
    if (categories) s.categories = categories;
    const values = valuesRaw ? valuesRaw.map(_toNum) : [];
    if (values.length) s.values = values;
    series.push(s);
    const serSpPr = kidOf(ser, "c:spPr");
    const serSolid = serSpPr !== null ? kidOf(serSpPr, "a:solidFill") : null;
    const c = serSolid !== null ? parseColor(serSolid, clrMap, theme) : null;
    if (c && c.hex) colors.push(c.hex);
  }
  const titleNode = kidOf(chart, "c:title");
  let title = null;
  if (titleNode !== null) {
    const parts = [];
    const walkT = (n2) => {
      for (const c of childrenOf(n2)) {
        if (tagOf(c) === "a:t") parts.push(textOf(c));
        else walkT(c);
      }
    };
    walkT(titleNode);
    title = parts.join("").trim() || null;
  }
  const out = { kind };
  if (series.length) out.series = series;
  if (colors.length) out.colors = colors;
  if (findDesc(chart, "c:legend") !== null) out.legend = true;
  if (title) out.title = title;
  return out;
}

function parseElements(spTreeNode, t, scale, rels, partDir, ctx, counters, mediaUsage, slideNum, partName) {
  const elements = [];
  let recognized = 0;
  const unrecognized = [];
  for (const child of childrenOf(spTreeNode)) {
    const fullTag = tagOf(child);
    const tag = fullTag && fullTag.startsWith("p:") ? fullTag.slice(2) : fullTag;
    if (!["sp", "pic", "grpSp", "graphicFrame", "cxnSp"].includes(tag)) {
      if (fullTag !== "p:nvGrpSpPr" && fullTag !== "p:grpSpPr") {
        unrecognized.push({ kind: "other", name: fullTag });
      }
      continue;
    }
    if (tag === "grpSp") {
      recognized += 1;
      const gPr = kidOf(child, "p:grpSpPr");
      const xf = gPr !== null ? xfrmOf(gPr) : null;
      let gt = t;
      if (xf && xf.off && xf.ext && xf.chOff && xf.chExt) {
        gt = _composeT(t, xf.off, xf.ext, xf.chOff, xf.chExt);
      }
      if (xf && xf.rot) counters.groupRot = (counters.groupRot || 0) + 1;
      const sub = parseElements(child, gt, scale, rels, partDir, ctx, counters, mediaUsage, slideNum, partName);
      elements.push(...sub.elements);
      recognized += sub.recognized;
      unrecognized.push(...sub.unrecognized);
      continue;
    }

    const cNvPr = findDesc(child, "p:cNvPr");
    const nameA = attrsOf(cNvPr);
    const ph = findDesc(child, "p:ph");
    const phType = ph !== null ? (attrsOf(ph).type || "body") : null;
    const elHlink = cNvPr !== null ? kidOf(cNvPr, "a:hlinkClick") : null;
    const elHlinkId = elHlink !== null ? attrsOf(elHlink)["r:id"] : undefined;
    const elLink = elHlinkId && rels[elHlinkId] ? rels[elHlinkId].Target : null;
    if (elLink) counters.links = (counters.links || 0) + 1;
    const base = {};
    if (nameA.id !== undefined && nameA.id !== null) base.id = nameA.id;
    if (nameA.name !== undefined && nameA.name !== null) base.name = nameA.name;
    if (phType) base.placeholder = phType;
    if (elLink) base.link = elLink;

    if (tag === "pic") {
      recognized += 1;
      const spPr = kidOf(child, "p:spPr");
      const xf = spPr !== null ? xfrmOf(spPr) : null;
      const blipFill = kidOf(child, "p:blipFill");
      const blip = blipFill !== null ? kidOf(blipFill, "a:blip") : null;
      const blipA = attrsOf(blip);
      const svgB = findDesc(child, "asvg:svgBlip");
      const svgEmbed = svgB !== null ? attrsOf(svgB)["r:embed"] : undefined;
      const alphaN = blipFill !== null ? findDesc(blipFill, "a:alphaModFix") : null;
      const srcRectN = blipFill !== null ? kidOf(blipFill, "a:srcRect") : null;
      const rId = blipA["r:embed"];
      const link = blipA["r:link"];
      const media = rId && rels[rId] ? resolveTarget(partDir, rels[rId].Target) : null;
      const svgMedia = svgEmbed && rels[svgEmbed] ? resolveTarget(partDir, rels[svgEmbed].Target) : null;
      const b = boundsPx(xf, t, scale);
      const shadow = spPr !== null ? parseShadow(spPr, ctx.clrMap, ctx.theme, (scale.kx + scale.ky) / 2) : null;
      const line = spPr !== null ? parseLn(spPr, ctx.clrMap, ctx.theme) : null;
      const el = { ...base, type: "image" };
      if (media) {
        el.src = path.posix.basename(media);
      } else if (svgMedia) {
        el.src = path.posix.basename(svgMedia);
        el.svgOnly = true;
      } else if (link) {
        el.linked = true;
      }
      if (b) el.bounds = b;
      Object.assign(el, geoFacts(b));
      if (xf && xf.rot) el.rotation = r2(xf.rot);
      if (xf && (xf.flipH || xf.flipV)) {
        el.flip = [xf.flipH ? "h" : null, xf.flipV ? "v" : null].filter(Boolean);
      }
      if (alphaN !== null && attrsOf(alphaN).amt !== undefined) {
        el.opacity = r2(parseFloat(attrsOf(alphaN).amt) / 100000);
      }
      if (srcRectN !== null) {
        el.srcRect = Object.fromEntries(Object.entries(attrsOf(srcRectN)).map(([k, v]) => [k, parseFloat(v) / 100000]));
      }
      if (line) el.line = line;
      if (shadow) el.shadow = shadow;
      const usage = { slide: slideNum, part: partName, role: "picture" };
      if (b) usage.bounds = b;
      if (el.rotation) usage.rotation = el.rotation;
      if (el.opacity !== undefined && el.opacity !== null) usage.opacity = el.opacity;
      if (media) mediaUsage.push({ media: path.posix.basename(media), ...usage });
      if (svgMedia) mediaUsage.push({ media: path.posix.basename(svgMedia), ...usage, via: "svgBlip" });
      elements.push(el);
      continue;
    }

    if (tag === "graphicFrame") {
      const gd = findDesc(child, "a:graphicData");
      const uri = gd !== null ? (attrsOf(gd).uri || "") : "";
      const xf = xfrmOf(child, "p:xfrm");
      const b = boundsPx(xf, t, scale);
      if (uri.includes("table")) {
        const tbl = gd !== null ? findDesc(gd, "a:tbl") : null;
        if (tbl !== null) {
          recognized += 1;
          const el = { ...base, type: "table" };
          if (b) el.bounds = b;
          Object.assign(el, geoFacts(b));
          el.table = parseTable(tbl, scale, ctx, counters);
          elements.push(el);
          continue;
        }
      }
      if (uri.includes("chart")) {
        const chartRef = gd !== null ? findDesc(gd, "c:chart") : null;
        const rId = chartRef !== null ? attrsOf(chartRef)["r:id"] : undefined;
        const chartPart = rId && rels[rId] ? resolveTarget(partDir, rels[rId].Target) : null;
        let chart = { kind: "other" };
        if (chartPart && ctx.partNode) {
          const root = ctx.partNode(chartPart);
          if (root !== null) {
            try {
              chart = parseChartPart(root, ctx.clrMap, ctx.theme);
            } catch {
              chart = { kind: "other" };
            }
          }
        }
        const el = { ...base, type: "chart" };
        if (chartPart) el.part = chartPart;
        if (b) el.bounds = b;
        Object.assign(el, geoFacts(b));
        el.chart = chart;
        elements.push(el);
        if (chart.kind === "other") {
          unrecognized.push({ kind: "chart", name: base.name || base.id });
        } else {
          recognized += 1;
        }
        continue;
      }
      unrecognized.push({ kind: kindOfUri(uri), name: base.name || base.id });
      continue;
    }

    recognized += 1;
    const spPr = kidOf(child, "p:spPr");
    const xf = spPr !== null ? xfrmOf(spPr) : null;
    const prstGeom = spPr !== null ? kidOf(spPr, "a:prstGeom") : null;
    const prst = prstGeom !== null ? attrsOf(prstGeom).prst : undefined;
    let avLst = [];
    if (prstGeom !== null) {
      for (const g of kidsOf(kidOf(prstGeom, "a:avLst"), "a:gd")) {
        const m = /^val\s+(.+)$/.exec(attrsOf(g).fmla || "");
        if (m) avLst.push(parseFloat(m[1]));
      }
    }
    const fill = spPr !== null ? parseFill(spPr, ctx.clrMap, ctx.theme) : null;
    if (fill && fill.solid) counters.fills[fill.solid] = (counters.fills[fill.solid] || 0) + 1;
    if (fill && fill.gradient) {
      // Python: json.dumps(..., separators=(",", ":")) — компактный ключ
      const gk = pyJsonDumps(jsNum(fill.gradient), undefined, true);
      counters.gradients[gk] = (counters.gradients[gk] || 0) + 1;
    }
    if (fill && fill.blip) {
      const rel = rels[fill.blip];
      if (rel) {
        const media = path.posix.basename(resolveTarget(partDir, rel.Target));
        fill.blip = media;
        const b = boundsPx(xf, t, scale);
        const u = { media, slide: slideNum, part: partName, role: "shape-fill" };
        if (b) u.bounds = b;
        mediaUsage.push(u);
      }
    }
    const line = spPr !== null ? parseLn(spPr, ctx.clrMap, ctx.theme) : null;
    const txBody = kidOf(child, "p:txBody");
    const lstStyle = txBody !== null ? kidOf(txBody, "a:lstStyle") : null;
    const chain = [
      lstStyle !== null ? parseLvlStyles(lstStyle) : null,
      phType ? (ctx.layoutPh || {})[phType] : null,
      phType ? (ctx.masterPh || {})[phType] : null,
      ctx.txStyles ? ctx.txStyles[txStyleClass(phType)] : null,
    ].filter(Boolean);
    const paragraphs = txBody !== null ? parseText(txBody, { ...ctx, chain }, counters) : [];
    const bodyPr = txBody !== null ? parseBodyPr(txBody) : {};
    const b = boundsPx(xf, t, scale);
    const shadow = spPr !== null ? parseShadow(spPr, ctx.clrMap, ctx.theme, (scale.kx + scale.ky) / 2) : null;
    const el = { ...base };
    el.type = paragraphs.length && (!prst || prst === "rect") && !fill && !line ? "text" : "shape";
    if (prst) el.shape = prst;
    if (avLst.length) el.adjustments = avLst;
    if (b) el.bounds = b;
    Object.assign(el, geoFacts(b));
    if (xf && xf.rot) el.rotation = r2(xf.rot);
    if (fill) el.fill = fill;
    if (line) el.line = line;
    if (shadow) el.shadow = shadow;
    if (bodyPr.anchor) el.anchor = bodyPr.anchor;
    if (bodyPr.autofit) el.autofit = bodyPr.autofit;
    if (paragraphs.length) el.text = paragraphs;
    elements.push(el);
  }
  return { elements: atlasToPageGrammar(elements), recognized, unrecognized };
}

function parseBgPart(partRoot, rels, partDir) {
  if (partRoot === null) return null;
  const bg = findDesc(partRoot, "p:bg");
  if (bg === null) return null;
  const blipFill = findDesc(bg, "a:blipFill");
  const blip = blipFill !== null ? kidOf(blipFill, "a:blip") : null;
  const embed = blip !== null ? attrsOf(blip)["r:embed"] : undefined;
  if (embed && rels[embed]) {
    return { type: "image", media: path.posix.basename(resolveTarget(partDir, rels[embed].Target)) };
  }
  const bgPr = kidOf(bg, "p:bgPr");
  if (bgPr !== null) {
    const fill = parseFill(bgPr, {}, {});
    if (fill && fill.solid) return { type: "solid", color: fill.solid };
    if (fill && fill.gradient) return { type: "gradient", gradient: fill.gradient };
  }
  const bgRef = kidOf(bg, "p:bgRef");
  if (bgRef !== null) {
    const sc = kidOf(bgRef, "a:schemeClr");
    const out = { type: "theme", idx: parseInt(attrsOf(bgRef).idx, 10) };
    if (sc !== null) out.scheme = attrsOf(sc).val;
    return out;
  }
  return { type: "unknown" };
}

module.exports = {
  XFORM_ID, xfrmOf, boundsPx, kindOfUri, parseTable, cachePts, parseChartPart, parseElements, parseBgPart,
};
