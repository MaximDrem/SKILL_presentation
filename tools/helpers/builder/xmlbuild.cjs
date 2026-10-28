// xmlbuild.cjs — DOM-хелперы build-стороны (порт helpers/xmlutil.py v3.2.1, точный).
'use strict';
const { El, parseXml, docRoot } = require("../xml.cjs");
const { pyRound } = require("../numfmt.cjs");
const { SHADOW_TOKENS } = require("../consts.cjs");

const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";

const qnA = (l) => `{${NS_A}}${l}`;
const qnP = (l) => `{${NS_P}}${l}`;
const qnR = (l) => `{${NS_R}}${l}`;
const qnC = (l) => `{${NS_C}}${l}`;

function parseFrag(xml) { return docRoot(parseXml(xml)); }

function mk(ns, local, attrs) {
  const el = new El(ns, local);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.attrs.set(k, String(v));
  return el;
}

function sub(parent, ns, local, attrs, text) {
  const el = mk(ns, local, attrs);
  if (text !== undefined && text !== null) el.children.push(String(text));
  parent.children.push(el);
  return el;
}

const findL = (el, local) => (el ? el.children.find((c) => c instanceof El && c.local === local) || null : null);
const findAllL = (el, local) => (el ? el.children.filter((c) => c instanceof El && c.local === local) : []);
function removeL(el, local) { if (el) el.children = el.children.filter((c) => !(c instanceof El && c.local === local)); }
function deepCopy(node) {
  if (typeof node === "string") return node;
  const out = new El(node.ns, node.local);
  if (node.nsScope) out.nsScope = { ...node.nsScope };
  for (const [k, v] of node.attrs) out.attrs.set(k, v);
  for (const c of node.children) out.children.push(deepCopy(c));
  return out;
}

function parseAlpha(aa) {
  return pyRound(parseInt(aa, 16) / 255 * 100000); // Python round() ties-to-even
}

function splitHex(c) {
  const h = String(c).replace(/^#/, "").toUpperCase();
  if (h.length === 8) return [h.slice(0, 6), parseAlpha(h.slice(6))];
  return [h, null];
}

function solidFillXml(parent, hexAlpha) {
  const [hexv, alpha] = splitHex(hexAlpha);
  const fill = sub(parent, NS_A, "solidFill");
  const clr = sub(fill, NS_A, "srgbClr", { val: hexv });
  if (alpha !== null) sub(clr, NS_A, "alpha", { val: alpha });
  return fill;
}

function gradFillXml(parent, g) {
  const fill = sub(parent, NS_A, "gradFill");
  const lst = sub(fill, NS_A, "gsLst");
  for (const [pos, col] of g.stops || []) {
    const [hexv, alpha] = splitHex(col);
    const gs = sub(lst, NS_A, "gs", { pos: pyRound(pos * 100000) });
    const clr = sub(gs, NS_A, "srgbClr", { val: hexv });
    if (alpha !== null) sub(clr, NS_A, "alpha", { val: alpha });
  }
  sub(fill, NS_A, "lin", { ang: pyRound(((g.angle || 0) % 360) * 60000), scaled: "1" });
  return fill;
}

const FILL_TAGS = ["solidFill", "gradFill", "noFill", "blipFill", "pattFill", "grpFill"];

function spPrOf(shapeEl) { return findL(shapeEl, "spPr"); }

function setFill(shapeEl, fillSpec) {
  const spPr = spPrOf(shapeEl);
  for (const t of FILL_TAGS) removeL(spPr, t);
  const anchor = findL(spPr, "prstGeom");
  const idx = anchor !== null ? spPr.children.indexOf(anchor) + 1 : spPr.children.length;
  const f = fillSpec || {};
  let node;
  if (f.none) {
    node = mk(NS_A, "noFill");
  } else if (f.gradient) {
    node = gradFillXml(mk(NS_A, "_tmp"), f.gradient);
  } else {
    node = solidFillXml(mk(NS_A, "_tmp"), f.solid || "#FFFFFF");
  }
  spPr.children.splice(idx, 0, node);
}

function setLine(shapeEl, lineSpec) {
  const spPr = spPrOf(shapeEl);
  removeL(spPr, "ln");
  if (!lineSpec) return;
  const ln = mk(NS_A, "ln");
  let after = null;
  for (const t of ["solidFill", "gradFill", "noFill", "blipFill"]) {
    after = findL(spPr, t);
    if (after !== null) break;
  }
  if (after !== null) spPr.children.splice(spPr.children.indexOf(after) + 1, 0, ln);
  else spPr.children.push(ln);
  if (lineSpec.w !== undefined && lineSpec.w !== null) ln.attrs.set("w", String(pyRound(lineSpec.w * 12700)));
  solidFillXml(ln, lineSpec.color || "#000000");
  sub(ln, NS_A, "prstDash", { val: "solid" });
}

// python-pptx line.fill.background(): <a:ln><a:noFill/></a:ln> после fill
function setLineNoFill(shapeEl) {
  const spPr = spPrOf(shapeEl);
  removeL(spPr, "ln");
  const ln = mk(NS_A, "ln");
  let after = null;
  for (const t of ["solidFill", "gradFill", "noFill", "blipFill"]) {
    after = findL(spPr, t);
    if (after !== null) break;
  }
  if (after !== null) spPr.children.splice(spPr.children.indexOf(after) + 1, 0, ln);
  else spPr.children.push(ln);
  sub(ln, NS_A, "noFill");
}

function setShadow(shapeEl, token) {
  if (!token || token === "none") return;
  const p = SHADOW_TOKENS[token];
  const spPr = spPrOf(shapeEl);
  removeL(spPr, "effectLst");
  const eff = sub(spPr, NS_A, "effectLst");
  const shd = sub(eff, NS_A, "outerShdw", { blurRad: p.blurRad, dist: p.dist, dir: p.dir, rotWithShape: "0" });
  const clr = sub(shd, NS_A, "srgbClr", { val: p.color });
  sub(clr, NS_A, "alpha", { val: p.alpha });
}

function setFlip(shapeEl, flip) {
  if (!flip) return;
  const spPr = spPrOf(shapeEl);
  const xf = spPr ? findL(spPr, "xfrm") : null;
  if (!xf) return;
  if (flip.h) xf.attrs.set("flipH", "1");
  if (flip.v) xf.attrs.set("flipV", "1");
}

// python-pptx rotation setter: ST_Angle — round ties-to-even, % 21600000 (позитив)
function angleStr(deg) {
  let rot = pyRound(deg * 60000) % 21600000;
  if (rot < 0) rot += 21600000;
  return String(rot);
}

function setRotation(shapeEl, deg) {
  const spPr = spPrOf(shapeEl);
  let xf = spPr ? findL(spPr, "xfrm") : null;
  if (!xf) {
    // python-pptx get_or_add_xfrm → insert в начало spPr
    xf = mk(NS_A, "xfrm");
    spPr.children.splice(0, 0, xf);
  }
  xf.attrs.set("rot", angleStr(deg));
}

function setPicOpacity(picEl, opacity) {
  if (opacity === undefined || opacity === null || opacity >= 1) return;
  const blipFill = findL(picEl, "blipFill");
  const blip = blipFill ? findL(blipFill, "blip") : null;
  if (!blip) return;
  removeL(blip, "alphaModFix");
  sub(blip, NS_A, "alphaModFix", { amt: pyRound(opacity * 100000) });
}

module.exports = {
  NS_A, NS_P, NS_R, NS_C, qnA, qnP, qnR, qnC, mk, sub, findL, findAllL, removeL, deepCopy,
  parseFrag, splitHex, parseAlpha, solidFillXml, gradFillXml, spPrOf, setFill, setLine,
  setLineNoFill, setShadow, setFlip, setRotation, setPicOpacity, angleStr,
};
