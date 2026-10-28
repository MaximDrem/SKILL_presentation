// text.cjs — разбор txBody unpack (порт unpack/text.py v3.2.1).
'use strict';
const { parseColor, parseGradXml } = require("./colors.cjs");
const { attrsOf, childrenOf, first, kidOf, kidsOf, r2, tagOf, textOf } = require("./ooxml.cjs");
const { resolveChain } = require("./styles.cjs");

const _list = (x) => (Array.isArray(x) ? x : []);

function _bump(d, k) {
  if (d instanceof Map) { d.set(k, (d.get(k) || 0) + 1); return; }
  d[k] = (d[k] || 0) + 1;
}

function parseText(txBodyNode, ctx, counters) {
  const { clrMap, theme, themeFonts } = ctx;
  const rels = ctx.rels;
  const chain = ctx.chain || [];
  // lstStyle фигуры: a:lvlNpPr/a:defRPr несёт цвет по умолчанию
  const lstFills = {};
  const lst = kidOf(txBodyNode, "a:lstStyle");
  if (lst !== null) {
    for (let l = 1; l <= 9; l++) {
      const lp = kidOf(lst, `a:lvl${l}pPr`);
      const dr = lp !== null ? kidOf(lp, "a:defRPr") : null;
      if (dr === null) continue;
      const solid = kidOf(dr, "a:solidFill");
      const grad = kidOf(dr, "a:gradFill");
      if (solid !== null) lstFills[l] = parseColor(solid, clrMap, theme);
      else if (grad !== null) lstFills[l] = { gradient: parseGradXml(grad, clrMap, theme) };
    }
  }
  const paragraphs = [];
  for (const pNode of kidsOf(txBodyNode, "a:p")) {
    const pPr = kidOf(pNode, "a:pPr");
    const pPrA = attrsOf(pPr);
    const lvl = (pPrA.lvl !== undefined && pPrA.lvl !== null ? parseInt(pPrA.lvl, 10) : 0) + 1;
    const defNode = pPr !== null ? kidOf(pPr, "a:defRPr") : null;
    const defA = attrsOf(defNode);
    const runs = [];
    for (const rNode of childrenOf(pNode)) {
      const rTag = tagOf(rNode);
      if (rTag !== "a:r" && rTag !== "a:fld") continue;
      const fldA = rTag === "a:fld" ? attrsOf(rNode) : null;
      const rPr = kidOf(rNode, "a:rPr");
      const rA = attrsOf(rPr);
      const text = kidsOf(rNode, "a:t").map((t) => textOf(t)).join("");
      if (!text && !fldA) continue;
      const latin = first(rPr !== null ? kidOf(rPr, "a:latin") : null,
                          defNode !== null ? kidOf(defNode, "a:latin") : null);
      const fontRaw = latin !== null ? attrsOf(latin).typeface : undefined;
      const solid = first(rPr !== null ? kidOf(rPr, "a:solidFill") : null,
                          defNode !== null ? kidOf(defNode, "a:solidFill") : null);
      const grad = first(rPr !== null ? kidOf(rPr, "a:gradFill") : null,
                         defNode !== null ? kidOf(defNode, "a:gradFill") : null);
      let color = solid !== null ? parseColor(solid, clrMap, theme)
        : grad !== null ? { gradient: parseGradXml(grad, clrMap, theme) } : null;
      const hlink = rPr !== null ? kidOf(rPr, "a:hlinkClick") : null;
      const hlinkId = hlink !== null ? attrsOf(hlink)["r:id"] : undefined;
      const link = hlinkId && rels && rels[hlinkId] ? rels[hlinkId].Target : null;
      const szV = rA.sz !== undefined && rA.sz !== null ? rA.sz : defA.sz;
      const inherited = [];
      let sz = szV !== undefined && szV !== null ? parseFloat(szV) / 100 : null;
      if (sz === null) {
        sz = resolveChain(chain, lvl, "sz");
        if (sz !== null && sz !== undefined) inherited.push("sz");
      }
      let font = fontRaw || null;
      if (!font) {
        font = resolveChain(chain, lvl, "fontRaw");
        if (font) inherited.push("font");
      }
      if (font === "+mj-lt") font = themeFonts.major || font;
      if (font === "+mn-lt") font = themeFonts.minor || font;
      let colHex = color && color.hex ? color.hex : null;
      if (colHex === null && !(color && (color.scheme || color.gradient))) {
        const lf = lstFills[lvl];
        if (lf && lf.hex) {
          colHex = lf.hex;
          inherited.push("color");
        } else if (lf && lf.gradient) {
          color = { gradient: lf.gradient };
          inherited.push("color");
        }
      }
      if (colHex === null && !(color && (color.scheme || color.gradient))) {
        const c = resolveChain(chain, lvl, "colorNode", (n2) => parseColor(n2, clrMap, theme));
        if (c && c.hex) {
          colHex = c.hex;
          inherited.push("color");
        }
      }
      let runColor;
      if (colHex !== null) runColor = colHex;
      else if (color && color.gradient) runColor = color.gradient;
      else if (color && color.scheme) runColor = color.scheme;
      else runColor = null;
      const run = { text };
      if (fldA) run.field = fldA.type || true;
      if (sz !== null && sz !== undefined) run.sz = new (require("../jsonpy.cjs").PyFloat)(sz); // Python float
      if (rA.b === "1" || (rA.b === undefined && defA.b === "1")) run.b = true;
      if (rA.i === "1") run.i = true;
      if (font) run.font = font;
      if (runColor !== null) run.color = runColor;
      if (link) run.link = link;
      if (inherited.length) run.inherited = inherited;
      if (link) counters.links = (counters.links || 0) + 1;
      if (run.font) _bump(counters.fonts, run.font);
      if (run.sz) _bump(counters.sizes, sz); // Python dict key — float value, не объект
      if (typeof run.color === "string" && run.color.startsWith("#")) _bump(counters.colors, run.color);
      runs.push(run);
    }
    const lnSpcN = pPr !== null ? kidOf(pPr, "a:lnSpc") : null;
    const spcPct = lnSpcN !== null ? kidOf(lnSpcN, "a:spcPct") : null;
    const spcPtsN = lnSpcN !== null ? kidOf(lnSpcN, "a:spcPts") : null;
    let lnSpc = null;
    if (spcPct !== null) {
      lnSpc = parseFloat(attrsOf(spcPct).val) / 100000;
    } else if (spcPtsN !== null) {
      lnSpc = String(r2(parseFloat(attrsOf(spcPtsN).val) / 100)) + "pt";
    }
    const spcBefN = pPr !== null ? kidOf(kidOf(pPr, "a:spcBef"), "a:spcPts") : null;
    const spcAftN = pPr !== null ? kidOf(kidOf(pPr, "a:spcAft"), "a:spcPts") : null;
    const buChar = pPr !== null ? kidOf(pPr, "a:buChar") : null;
    const para = { runs };
    if (pPrA.algn) para.align = pPrA.algn;
    if (lvl > 1) para.lvl = lvl;
    if (lnSpc !== null) para.lineHeight = lnSpc;
    if (spcBefN !== null) para.spcBef = r2(parseFloat(attrsOf(spcBefN).val) / 100);
    if (spcAftN !== null) para.spcAft = r2(parseFloat(attrsOf(spcAftN).val) / 100);
    if (buChar !== null && attrsOf(buChar).char !== undefined) {
      para.bullet = attrsOf(buChar).char;
    } else if (pPr !== null && kidOf(pPr, "a:buAutoNum") !== null) {
      para.bullet = "auto";
    } else if (pPr !== null && kidOf(pPr, "a:buNone") !== null) {
      para.bullet = "none";
    }
    paragraphs.push(para);
  }
  return paragraphs.filter((p) => p.runs.length);
}

function parseBodyPr(txBodyNode) {
  const m = kidOf(txBodyNode, "a:bodyPr");
  if (m === null) return {};
  const a = attrsOf(m);
  const out = {};
  if (a.anchor && a.anchor !== "t") out.anchor = a.anchor;
  if (kidOf(m, "a:normAutofit") !== null) out.autofit = "norm";
  else if (kidOf(m, "a:spAutoFit") !== null) out.autofit = "spAutoFit";
  return out;
}

module.exports = { parseText, parseBodyPr };
