// styles.cjs — стили плейсхолдеров/txStyles unpack (порт unpack/styles.py v3.2.1).
'use strict';
const { attrsOf, childrenOf, findDesc, kidOf, tagOf } = require("./ooxml.cjs");

function parseLvlStyles(lstStyleNode) {
  const out = {};
  if (!lstStyleNode) return out;
  for (const lvlNode of childrenOf(lstStyleNode)) {
    const m = /^a:lvl(\d)pPr$/.exec(tagOf(lvlNode) || "");
    if (!m) continue;
    const defNode = kidOf(lvlNode, "a:defRPr");
    if (!defNode) continue;
    const a = attrsOf(defNode);
    const latin = kidOf(defNode, "a:latin");
    const solid = kidOf(defNode, "a:solidFill");
    const entry = {};
    if (a.sz !== undefined && a.sz !== null) entry.sz = parseFloat(a.sz) / 100;
    if (a.b !== undefined && a.b !== null) entry.b = a.b === "1";
    if (latin !== null && attrsOf(latin).typeface !== undefined) entry.fontRaw = attrsOf(latin).typeface;
    if (solid !== null) entry.colorNode = solid;
    out[parseInt(m[1], 10)] = entry;
  }
  return out;
}

function parseTxStyles(masterRoot) {
  const res = {};
  const txStylesNode = findDesc(masterRoot, "p:txStyles");
  for (const cls of ["titleStyle", "bodyStyle", "otherStyle"]) {
    res[cls] = parseLvlStyles(txStylesNode !== null ? kidOf(txStylesNode, "p:" + cls) : null);
  }
  return res;
}

function parsePhLstStyles(partRoot) {
  const out = {};
  const walk = (n) => {
    for (const c of childrenOf(n)) {
      if (tagOf(c) === "p:sp") {
        const ph = findDesc(c, "p:ph");
        if (ph !== null) {
          const typ = attrsOf(ph).type || "body";
          const lst = findDesc(c, "a:lstStyle");
          if (lst !== null && !(typ in out)) out[typ] = parseLvlStyles(lst);
        }
      } else {
        walk(c);
      }
    }
  };
  if (partRoot) walk(partRoot);
  return out;
}

function txStyleClass(phType) {
  if (phType === "title" || phType === "ctrTitle") return "titleStyle";
  if (phType === "body" || phType === "subTitle") return "bodyStyle";
  return "otherStyle";
}

function resolveChain(chain, lvl, key, resolveVal) {
  for (const styles of chain) {
    const s = styles && (styles[lvl] || styles[1]);
    if (s && s[key] !== undefined && s[key] !== null) {
      return resolveVal ? resolveVal(s[key], s) : s[key];
    }
  }
  return null;
}

module.exports = { parseLvlStyles, parseTxStyles, parsePhLstStyles, txStyleClass, resolveChain };
