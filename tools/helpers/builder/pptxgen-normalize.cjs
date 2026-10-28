// pptxgen-normalize.cjs — generic OOXML normalizer: DOM PptxGenJS → python-pptx canon.
// Работает по дереву El (xml.cjs), правила по (тип элемента DSL, local/ns контекст).
'use strict';
const { El } = require("../xml.cjs");
const { NS_A, NS_P, NS_R, mk, sub, findL, removeL, parseFrag } = require("./xmlbuild.cjs");
const { asNum } = require("../jsonpy.cjs");
const { pyRound } = require("../numfmt.cjs");
const { splitHex, solidFillXml, gradFillXml } = require("./xmlbuild.cjs");
const { SHADOW_TOKENS } = require("../consts.cjs");


// rotation/flip из source model (PptxGenJS надёжно пишет их только для images)
function applyRotFlip(shapeEl, el) {
  const { setRotation, setFlip } = require("./xmlbuild.cjs");
  const spPr = findL(shapeEl, "spPr");
  const xf = spPr ? findL(spPr, "xfrm") : null;
  if (xf) {
    xf.attrs.delete("rot");
    xf.attrs.delete("flipH");
    xf.attrs.delete("flipV");
  }
  if (el.rotation) setRotation(shapeEl, asNum(el.rotation));
  setFlip(shapeEl, el.flip);
}

function kids(n, local) { return n.children.filter((c) => c instanceof El && c.local === local); }
function stripAttrs(n, names) { for (const a of names) n.attrs.delete(a); }
function isEmptyEl(n) { return n.children.length === 0 && n.attrs.size === 0; }

// python sz: floor(trunc(sz*12700)/127)
function pySz(sz) { return String(Math.floor(Math.trunc(asNum(sz) * 12700) / 127)); }
// python spcPts: int(pt*100) trunc
function pySpcPts(pt) { return String(Math.trunc(asNum(pt) * 100)); }
// python spcPct: int(round(lh*100000)) ties-to-even
function pySpcPct(lh) { return String(Math.trunc(pyRound(asNum(lh) * 100000))); }

// ---------- text ----------

function normalizeTextShape(sp, el) {
  const nvSpPr = findL(sp, "nvSpPr");
  const cNvSpPr = findL(nvSpPr, "cNvSpPr");
  if (cNvSpPr) cNvSpPr.attrs.set("txBox", "1");
  const spPr = findL(sp, "spPr");
  const ln = findL(spPr, "ln");
  if (ln && isEmptyEl(ln)) removeL(spPr, "ln");
  const txBody = findL(sp, "txBody");
  const bodyPr = findL(txBody, "bodyPr");
  stripAttrs(bodyPr, ["rtlCol"]);
  if (el.anchor) bodyPr.attrs.set("anchor", el.anchor);
  else bodyPr.attrs.delete("anchor");
  // autofit: дефолт шаблона — spAutoFit
  for (const t of ["spAutoFit", "normAutofit", "noAutofit"]) removeL(bodyPr, t);
  if (el.autofit === "norm") sub(bodyPr, NS_A, "normAutofit");
  else sub(bodyPr, NS_A, "spAutoFit");
  const paras = kids(txBody, "p");
  const specParas = el.paragraphs || [];
  paras.forEach((p, pi) => {
    const specP = specParas[pi] || {};
    // PptxGenJS пишет pPr перед КАЖДЫМ run с para-опциями — оставляем первый,
    // остальные удаляем (python-pptx: один pPr на параграф)
    const pPrs = kids(p, "pPr");
    const pPr = pPrs[0] || null;
    for (let x = 1; x < pPrs.length; x++) p.children.splice(p.children.indexOf(pPrs[x]), 1);
    if (pPr) {
      if (pPr.attrs.get("indent") === "0") pPr.attrs.delete("indent");
      if (pPr.attrs.get("marL") === "0") pPr.attrs.delete("marL");
      if (specP.align) pPr.attrs.set("algn", specP.align);
      else pPr.attrs.delete("algn");
      // lineHeight / spacing — точные значения из source model
      if (specP.lineHeight !== undefined && specP.lineHeight !== null) {
        removeL(pPr, "lnSpc");
        const e = sub(pPr, NS_A, "lnSpc");
        sub(e, NS_A, "spcPct", { val: pySpcPct(specP.lineHeight) });
      }
      for (const [tag, key] of [["spcBef", "spcBef"], ["spcAft", "spcAft"]]) {
        if (specP[key] !== undefined && specP[key] !== null) {
          removeL(pPr, tag);
          const e = sub(pPr, NS_A, tag);
          sub(e, NS_A, "spcPts", { val: pySpcPts(specP[key]) });
        }
      }
      // bullets
      for (const t of ["buNone", "buChar", "buAutoNum", "buFont", "buSzPct", "buSzPts", "buClr", "buClrTx"]) removeL(pPr, t);
      if (specP.bullet === "char") {
        pPr.attrs.set("marL", "228600");
        pPr.attrs.set("indent", "-228600");
        sub(pPr, NS_A, "buFont", { typeface: "Arial", panose: "020B0604020202020204", pitchFamily: "34", charset: "0" });
        sub(pPr, NS_A, "buChar", { char: specP.bulletChar || "•" });
      } else if (specP.bullet === "none") {
        sub(pPr, NS_A, "buNone");
      }
    }
    // runs
    const specRuns = specP.runs || [];
    kids(p, "r").forEach((r, ri) => {
      const specR = specRuns[ri] || {};
      const rPr = findL(r, "rPr");
      if (!rPr) return;
      stripAttrs(rPr, ["lang", "dirty"]);
      if (specR.sz !== undefined && specR.sz !== null) rPr.attrs.set("sz", pySz(specR.sz));
      else rPr.attrs.delete("sz");
      if (specR.b) rPr.attrs.set("b", "1"); else rPr.attrs.delete("b");
      if (specR.i) rPr.attrs.set("i", "1"); else rPr.attrs.delete("i");
      if (specR.u) rPr.attrs.set("u", specR.u === true ? "sng" : String(specR.u)); else rPr.attrs.delete("u");
      // цвет: из source model (alpha → alpha child)
      for (const t of ["solidFill", "gradFill", "noFill"]) removeL(rPr, t);
      if (typeof specR.color === "string") {
        // обычные text runs — только RGB из #RRGGBBAA (alpha не пишется);
        // gradients обрабатываются отдельной веткой ниже
        const sf = solidFillXml(mk(NS_A, "_tmp"), splitHex(specR.color)[0]);
        // порядок rPr children: ln, fills…, latin… — вставить после ln если есть
        const lnN = findL(rPr, "ln");
        if (lnN) rPr.children.splice(rPr.children.indexOf(lnN) + 1, 0, sf);
        else rPr.children.unshift(sf);
      } else if (specR.color && Array.isArray(specR.color.stops)) {
        const g = gradFillXml(mk(NS_A, "_tmp"), specR.color);
        rPr.children.unshift(g);
      }
      // font → latin в правильной позиции (после fill, до ea)
      for (const t of ["latin", "ea", "cs"]) removeL(rPr, t);
      if (specR.font) {
        rPr.children.push(mk(NS_A, "latin", { typeface: specR.font }));
      }
    });
    // endParaRPr удаляем
    removeL(p, "endParaRPr");
  });
  applyRotFlip(sp, el);
  return sp;
}

// ---------- shape ----------

function normalizeShape(sp, el) {
  const spPr = findL(sp, "spPr");
  // fill: PptxGenJS при fill:none не пишет fill-элемент — добавить noFill ниже
  const hasFill = ["noFill", "solidFill", "gradFill"].some((t) => findL(spPr, t));
  // prstGeom: adjustments из source model (AVLST_DEFAULTS-семантика python-pptx)
  const prstGeom = findL(spPr, "prstGeom");
  if (el.adjustments && Array.isArray(el.adjustments) && prstGeom) {
    const { AVLST_DEFAULTS } = require("./elhelpers.cjs");
    const prst = prstGeom.attrs.get("prst");
    const defs = (AVLST_DEFAULTS[prst] || []).map(([name, defVal]) => ({ name, defVal, actual: null }));
    el.adjustments.forEach((v, i) => {
      if (i < defs.length) defs[i].actual = Math.trunc(asNum(v));
    });
    if (el.adjustments.some((v, i) => i < defs.length)) {
      const avLst = findL(prstGeom, "avLst") || sub(prstGeom, NS_A, "avLst");
      avLst.children = [];
      for (const adj of defs) {
        sub(avLst, NS_A, "gd", { name: adj.name, fmla: `val ${adj.actual !== null ? adj.actual : adj.defVal}` });
      }
    }
  }
  // fill из source model (python порядок: noFill/solidFill/gradFill после prstGeom)
  for (const t of ["noFill", "solidFill", "gradFill"]) removeL(spPr, t);
  const f = el.fill;
  let fillEl = null;
  if (f && typeof f === "object") {
    if (f.none) fillEl = mk(NS_A, "noFill");
    else if (typeof f.solid === "string") fillEl = solidFillXml(mk(NS_A, "_tmp"), f.solid);
    else if (f.gradient && Array.isArray(f.gradient.stops)) fillEl = gradFillXml(mk(NS_A, "_tmp"), f.gradient);
  }
  // отсутствующий/null fill → белый solidFill; noFill только для {none:true}
  if (!fillEl) fillEl = solidFillXml(mk(NS_A, "_tmp"), "FFFFFF");
  {
    // после prstGeom
    const gi = spPr.children.indexOf(prstGeom);
    spPr.children.splice(gi + 1, 0, fillEl);
  }
  void hasFill;
  // line
  const lnOld = findL(spPr, "ln");
  if (lnOld) removeL(spPr, "ln");
  if (el.line && typeof el.line === "object" && (el.line.w || el.line.color)) {
    const { setLine } = require("./xmlbuild.cjs");
    setLine(sp, el.line);
  } else {
    const { setLineNoFill } = require("./xmlbuild.cjs");
    setLineNoFill(sp);
  }
  // shadow (токен soft/lift из source)
  const effOld = findL(spPr, "effectLst");
  if (effOld) removeL(spPr, "effectLst");
  if (el.shadow && el.shadow !== "none") {
    const { setShadow } = require("./xmlbuild.cjs");
    setShadow(sp, el.shadow);
  }
  if (!findL(spPr, "effectLst")) sub(spPr, NS_A, "effectLst");
  applyRotFlip(sp, el);
  // p:style как у python-pptx add_shape
  const styleOld = findL(sp, "style");
  if (styleOld) removeL(sp, "style");
  const style = parseFrag(`<p:style xmlns:p="${NS_P}" xmlns:a="${NS_A}">` +
    `<a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef>` +
    `<a:fillRef idx="3"><a:schemeClr val="accent1"/></a:fillRef>` +
    `<a:effectRef idx="2"><a:schemeClr val="accent1"/></a:effectRef>` +
    `<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>`);
  // style после spPr, перед txBody
  let txBody = findL(sp, "txBody");
  if (!txBody) {
    sp.children.push(style);
  } else {
    sp.children.splice(sp.children.indexOf(txBody), 0, style);
  }
  // txBody: дефолт shape — пустой центрированный параграф
  let txBodyEl = txBody;
  if (!txBodyEl) {
    txBodyEl = mk(NS_P, "txBody");
    sp.children.push(txBodyEl);
  }
  txBody = txBodyEl;
  txBody.children = [];
  const bp = mk(NS_A, "bodyPr", { rtlCol: "0", anchor: "ctr" });
  txBody.children.push(bp, mk(NS_A, "lstStyle"));
  const para = mk(NS_A, "p");
  para.children.push(mk(NS_A, "pPr", { algn: "ctr" }));
  txBody.children.push(para);
  return sp;
}

// ---------- image ----------

function normalizePic(pic, el) {
  // nvPicPr/cNvPicPr: picLocks noChangeAspect="1"
  const nvPicPr = findL(pic, "nvPicPr");
  let cNvPicPr = findL(nvPicPr, "cNvPicPr");
  if (!cNvPicPr) {
    cNvPicPr = mk(NS_P, "cNvPicPr");
    nvPicPr.children.push(cNvPicPr);
  }
  if (!findL(cNvPicPr, "picLocks")) {
    cNvPicPr.children.push(mk(NS_A, "picLocks", { noChangeAspect: "1" }));
  }
  // blipFill: stretch/fillRect гарантирован; alphaModFix из source opacity
  const blipFill = findL(pic, "blipFill");
  const blip = findL(blipFill, "blip");
  for (const c of [...blip.children]) {
    if (c instanceof El && c.local === "alphaModFix") blip.children.splice(blip.children.indexOf(c), 1);
  }
  if (el.opacity !== undefined && el.opacity !== null && asNum(el.opacity) < 1) {
    blip.children.push(mk(NS_A, "alphaModFix", { amt: String(Math.trunc(pyRound(asNum(el.opacity) * 100000))) }));
  }
  // stretch/fillRect
  let stretch = findL(blipFill, "stretch");
  if (!stretch) {
    stretch = mk(NS_A, "stretch");
    blipFill.children.push(stretch);
  }
  if (!findL(stretch, "fillRect")) stretch.children.push(mk(NS_A, "fillRect"));
  // srcRect из source model (точные значения)
  const srOld = findL(blipFill, "srcRect");
  if (srOld) removeL(blipFill, "srcRect");
  if (el.srcRect && Object.keys(el.srcRect).length) {
    const attrs = {};
    // legacy/python: нулевые значения не пишутся (if r.l: …)
    for (const key of ["l", "t", "r", "b"]) {
      const v = el.srcRect[key];
      if (v) attrs[key] = String(pyRound(asNum(v) * 100000));
    }
    const sr = mk(NS_A, "srcRect", attrs);
    // python-pptx: srcRect после blip, перед stretch
    blipFill.children.splice(blipFill.children.indexOf(blip) + 1, 0, sr);
  }
  // shadow (токен) + rot/flip из source
  const spPr = findL(pic, "spPr");
  const effOld = findL(spPr, "effectLst");
  if (effOld) removeL(spPr, "effectLst");
  if (el.shadow && el.shadow !== "none") {
    const { setShadow } = require("./xmlbuild.cjs");
    setShadow(pic, el.shadow);
  }
  // legacy: пустой effectLst всегда (shadow.inherit=False)
  if (!findL(spPr, "effectLst")) sub(spPr, NS_A, "effectLst");
  applyRotFlip(pic, el);
  return pic;
}

// ---------- table ----------

const TC_TMPL_N =
  `<a:tc xmlns:a="${NS_A}"><a:txBody><a:bodyPr/><a:lstStyle/><a:p/></a:txBody><a:tcPr/></a:tc>`;

// rebuild a:tbl по source model (python-pptx структура: tblPr/tableStyleId,
// tblGrid из colW, tr h=CY/rows, merges gridSpan/rowSpan/hMerge/vMerge)
function rebuildTbl(el, k) {
  const { px, cellBorderXml, escapeCtrlText, getOrAddRPr, getOrAddPPr, insertRPrChild } = require("./elhelpers.cjs");
  const { ALIGN_MAP } = require("../consts.cjs");
  const tb = el.table;
  const rows = tb.rows.length, cols = tb.colW.length;
  const CX = px(el.bounds[2], k), CY = px(el.bounds[3], k);
  const tbl = parseFrag(
    `<a:tbl xmlns:a="${NS_A}"><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr><a:tblGrid/></a:tbl>`);
  const tblPr = findL(tbl, "tblPr");
  tblPr.attrs.delete("firstRow");
  tblPr.attrs.delete("bandRow");
  const tblGrid = findL(tbl, "tblGrid");
  let colwidth = Math.floor(CX / cols);
  for (let col = 0; col < cols; col++) {
    if (col === cols - 1) colwidth = CX - (cols - 1) * colwidth;
    sub(tblGrid, NS_A, "gridCol", { w: colwidth });
  }
  let rowheight = Math.floor(CY / rows);
  for (let row = 0; row < rows; row++) {
    if (row === rows - 1) rowheight = CY - (rows - 1) * rowheight;
    const tr = sub(tbl, NS_A, "tr", { h: rowheight });
    for (let col = 0; col < cols; col++) tr.children.push(parseFrag(TC_TMPL_N));
  }
  const gridCols = tblGrid.children.filter((c) => c instanceof El);
  tb.colW.forEach((w, i) => gridCols[i].attrs.set("w", String(px(w, k))));

  const trs = tbl.children.filter((c) => c instanceof El && c.local === "tr");
  const merged = new Set();
  const cellAt = (r, c) => trs[r].children.filter((x) => x instanceof El && x.local === "tc")[c];

  for (let ri = 0; ri < tb.rows.length; ri++) {
    const row = tb.rows[ri];
    for (let ci = 0; ci < row.length; ci++) {
      if (merged.has(`${ri},${ci}`)) continue;
      const cspec = row[ci];
      const tc = cellAt(ri, ci);
      const cs = cspec.colSpan || 1, rs = cspec.rowSpan || 1;
      if (cs > 1 || rs > 1) {
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (dr || dc) merged.add(`${ri + dr},${ci + dc}`);
          }
        }
        for (let dc = 0; dc < cs; dc++) {
          const c = cellAt(ri, ci + dc);
          if (rs !== 1) c.attrs.set("rowSpan", String(rs));
          else c.attrs.delete("rowSpan");
        }
        for (let dr = 0; dr < rs; dr++) {
          const c = cellAt(ri + dr, ci);
          if (cs !== 1) c.attrs.set("gridSpan", String(cs));
          else c.attrs.delete("gridSpan");
        }
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            const c = cellAt(ri + dr, ci + dc);
            if (dc !== 0) c.attrs.set("hMerge", "1");
            if (dr !== 0) c.attrs.set("vMerge", "1");
          }
        }
      }
      const txBody = findL(tc, "txBody");
      const bodyPr = findL(txBody, "bodyPr");
      bodyPr.attrs.set("wrap", "square");
      const tcPr = findL(tc, "tcPr");
      tcPr.attrs.set("anchor", "ctr");
      const inset = tb.inset;
      const mEmu = inset !== undefined && inset !== null ? Math.trunc(asNum(inset) * 0.75 * 12700) : Math.trunc(3.75 * 12700);
      tcPr.attrs.set("marL", String(mEmu));
      tcPr.attrs.set("marR", String(mEmu));
      const mTb = Math.trunc(1.8 * 12700);
      tcPr.attrs.set("marT", String(mTb));
      tcPr.attrs.set("marB", String(mTb));
      const para = txBody.children.find((c) => c instanceof El && c.local === "p");
      if (cspec.align) getOrAddPPr(para).attrs.set("algn", ALIGN_MAP[cspec.align]);
      const run = mk(NS_A, "r");
      para.children.push(run);
      const t = sub(run, NS_A, "t");
      t.children.push(escapeCtrlText(cspec.text));
      const rPr = getOrAddRPr(run);
      const sz = cspec.sz !== undefined && cspec.sz !== null ? cspec.sz : (tb.sz !== undefined && tb.sz !== null ? tb.sz : 14);
      rPr.attrs.set("sz", String(Math.floor(Math.trunc(asNum(sz) * 12700) / 127)));
      if (cspec.b) rPr.attrs.set("b", "1");
      if (cspec.i) rPr.attrs.set("i", "1");
      if (tb.font) insertRPrChild(rPr, mk(NS_A, "latin", { typeface: tb.font }));
      const col = cspec.color || tb.color;
      if (col) {
        removeL(rPr, "solidFill");
        insertRPrChild(rPr, solidFillXml(mk(NS_A, "_tmp"), splitHex(col)[0]));
      }
      const fill = cspec.fill;
      if (fill === "none") {
        removeL(tcPr, "solidFill");
        removeL(tcPr, "noFill");
        sub(tcPr, NS_A, "noFill");
      } else if (fill) {
        removeL(tcPr, "noFill");
        removeL(tcPr, "solidFill");
        sub(tcPr, NS_A, "solidFill");
        sub(findL(tcPr, "solidFill"), NS_A, "srgbClr", { val: splitHex(fill)[0] });
      }
      const borders = cspec.borders || {};
      for (const side of "lrtb") {
        const specSide = borders[side] !== undefined ? borders[side] : tb.border;
        if (specSide !== undefined && specSide !== null) {
          cellBorderXml(tcPr, side, typeof specSide === "object" ? specSide : {});
        }
      }
    }
  }
  return tbl;
}

function normalizeTable(gf, el, k) {
  // nvPr: strip p14:modId extLst (python-pptx не пишет)
  const nv = findL(gf, "nvGraphicFramePr");
  const nvPr = nv ? findL(nv, "nvPr") : null;
  if (nvPr) removeL(nvPr, "extLst");
  const graphic = findL(gf, "graphic");
  const gd = findL(graphic, "graphicData");
  const oldTbl = findL(gd, "tbl");
  const newTbl = rebuildTbl(el, k);
  gd.children.splice(gd.children.indexOf(oldTbl), 1, newTbl);
  return gf;
}

module.exports = { normalizeTextShape, normalizeShape, normalizePic, normalizeTable, kids, stripAttrs, isEmptyEl };
