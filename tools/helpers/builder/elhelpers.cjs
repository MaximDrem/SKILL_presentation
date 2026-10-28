// elhelpers.cjs — общие element-хелперы нормализатора (порт builder/elements.py
// v3.2.1, helper-часть). Legacy production writers удалены (§5.6/§6.4):
// генерация элементов — PptxGenJS adapter + pptxgen-normalize.
'use strict';
const path = require("path");
const { pyRound } = require("../numfmt.cjs");
const { asNum } = require("../jsonpy.cjs");
const { El } = require("../xml.cjs");
const { NS_A, mk, sub, findL, removeL, solidFillXml, splitHex } = require("./xmlbuild.cjs");

// Предефолтные adjustment-таблицы python-pptx (pptx/spec.py)
const AVLST_DEFAULTS = {
  chevron: [["adj", 50000]], diamond: [], donut: [["adj", 25000]],
  downArrow: [["adj1", 50000], ["adj2", 50000]], heptagon: [["hf", 102572], ["vf", 105210]],
  hexagon: [["adj", 25000], ["vf", 115470]], triangle: [["adj", 50000]],
  leftArrow: [["adj1", 50000], ["adj2", 50000]], octagon: [["adj", 29289]],
  ellipse: [], parallelogram: [["adj", 25000]], homePlate: [["adj", 50000]],
  pie: [["adj1", 0], ["adj2", 16200000]], rect: [], pentagon: [["hf", 105146], ["vf", 110557]],
  rightArrow: [["adj1", 50000], ["adj2", 50000]], rtTriangle: [], roundRect: [["adj", 16667]],
  star5: [["adj", 19098], ["hf", 105146], ["vf", 110557]], star6: [["adj", 28868], ["hf", 115470]],
  trapezoid: [["adj", 25000]], upArrow: [["adj1", 50000], ["adj2", 50000]],
};

function px(v, k) { return pyRound(asNum(v) * k); } // Emu(round()) — целое

function mediaRel(projectDir, src) {
  const s = src.startsWith("media/") ? src.slice(6) : src;
  return path.join(projectDir, "media", s);
}

function escapeCtrlText(s) {
  return [...String(s)].map((ch) => {
    const c = ch.codePointAt(0);
    if ((c < 0x09) || (c >= 0x0b && c <= 0x1f)) return `_x${c.toString(16).toUpperCase().padStart(4, "0")}_`;
    return ch;
  }).join("");
}

// ---- rPr/pPr order-aware helpers (python-pptx CT_* insert_element_before) ----

const RPR_CHILD_ORDER = ["ln", "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill",
  "effectLst", "effectDag", "highlight", "uLnTx", "uLn", "uFillTx", "uFill",
  "latin", "ea", "cs", "sym", "hlinkClick", "hlinkMouseOver", "rtl", "extLst"];

function insertRPrChild(rPr, node) {
  const order = RPR_CHILD_ORDER;
  const myIdx = order.indexOf(node.local);
  for (let i = 0; i < rPr.children.length; i++) {
    const c = rPr.children[i];
    if (c instanceof El && order.indexOf(c.local) > myIdx) {
      rPr.children.splice(i, 0, node);
      return;
    }
  }
  rPr.children.push(node);
}

function getOrAddRPr(r) {
  let rPr = findL(r, "rPr");
  if (!rPr) {
    rPr = mk(NS_A, "rPr");
    r.children.splice(0, 0, rPr);
  }
  return rPr;
}

function getOrAddPPr(p) {
  let pPr = findL(p, "pPr");
  if (!pPr) {
    pPr = mk(NS_A, "pPr");
    p.children.splice(0, 0, pPr);
  }
  return pPr;
}

// ---- table cell borders ----

function cellBorderXml(tcPr, side, spec) {
  const tag = { l: "lnL", r: "lnR", t: "lnT", b: "lnB" }[side];
  removeL(tcPr, tag);
  const ln = mk(NS_A, tag);
  const order = ["lnL", "lnR", "lnT", "lnB"];
  const myI = order.indexOf(tag);
  let inserted = false;
  for (const child of tcPr.children) {
    if (!(child instanceof El)) continue;
    const full = child.local;
    if (order.includes(full) && order.indexOf(full) > myI) {
      tcPr.children.splice(tcPr.children.indexOf(child), 0, ln);
      inserted = true;
      break;
    }
    if (!order.includes(full)) {
      tcPr.children.splice(tcPr.children.indexOf(child), 0, ln);
      inserted = true;
      break;
    }
  }
  if (!inserted) tcPr.children.push(ln);
  const w = spec && spec.w !== undefined && spec.w !== null ? spec.w : 1;
  ln.attrs.set("w", String(pyRound(asNum(w) * 12700)));
  ln.attrs.set("cap", "flat");
  solidFillXml(ln, (spec && spec.color) || "#DDE3E8");
  sub(ln, NS_A, "prstDash", { val: "solid" });
}

module.exports = { px, mediaRel, escapeCtrlText, insertRPrChild, getOrAddRPr, getOrAddPPr, cellBorderXml, AVLST_DEFAULTS };
