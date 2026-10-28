// grammar.cjs — нормализация unpack-элементов в DSL страниц (порт grammar.py v3.2.1).
'use strict';
const { BUILD_SHAPES } = require("../consts.cjs");
const { r2 } = require("./ooxml.cjs");
const { pyRound } = require("../numfmt.cjs");

const PAGE_ALIGN = new Set(["l", "ctr", "r", "just"]);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;

const _list = (x) => (Array.isArray(x) ? x : []);
const _obj = (x) => (x !== null && typeof x === "object" && !Array.isArray(x));

function pageRun(r) {
  if (!r || typeof r.text !== "string") return null;
  const out = { text: r.text };
  if (r.sz !== undefined && r.sz !== null) out.sz = r.sz;
  if (r.b) out.b = true;
  if (r.i) out.i = true;
  if (r.font) out.font = r.font;
  const c = r.color;
  if (typeof c === "string") {
    if (HEX_COLOR_RE.test(c)) out.color = c;
  } else if (c && Array.isArray(c.stops)) {
    out.color = c;
  }
  return out;
}

function pagePara(p) {
  const runs = _list((p || {}).runs).map(pageRun).filter(Boolean);
  if (!runs.length) return null;
  const out = { runs };
  if (PAGE_ALIGN.has(p.align)) out.align = p.align;
  if (p.bullet === "none") {
    out.bullet = "none";
  } else if (typeof p.bullet === "string" && p.bullet !== "auto") {
    out.bullet = "char";
    out.bulletChar = p.bullet;
  }
  const lhRaw = p.lineHeight;
  let lh;
  if (typeof lhRaw === "number") {
    lh = lhRaw;
  } else if (lhRaw) {
    // Python float(x): полная строка, иначе ValueError → nan
    lh = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(String(lhRaw)) ? parseFloat(lhRaw) : NaN;
  } else {
    lh = NaN;
  }
  if (!Number.isNaN(lh) && lh > 0) out.lineHeight = r2(lh);
  for (const k of ["spcBef", "spcAft"]) {
    const v = p[k] && typeof p[k] === "object" ? p[k].valueOf() : p[k];
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

function pageParas(raw) {
  return _list(raw).map(pagePara).filter(Boolean);
}

function _normalize(el) {
  delete el.autofit;
  let b = el.bounds;
  if (Array.isArray(b) && b.length === 4 && b.some((v) => !Number.isInteger(v))) {
    el.bounds = b.map((v) => pyRound(v));
  }
  const sh = el.shape;
  if (el.type === "shape" && typeof sh === "string" && !BUILD_SHAPES.has(sh) &&
      (sh.includes("onnector") || sh.toLowerCase().includes("line"))) {
    b = el.bounds;
    if (Array.isArray(b) && b.length === 4) {
      if (b[3] <= 2 && b[2] > 0) b[3] = 2;
      else if (b[2] <= 2 && b[3] > 0) b[2] = 2;
    }
    el.shape = "rect";
  }
}

function atlasToPageGrammar(elements) {
  for (const el of elements) _normalize(el);
  const out = [];
  for (const el of elements) {
    if (el.table) {
      const tb = el.table;
      tb.colW = tb.cols || [];
      delete tb.cols;
      const newRows = [];
      for (const row of _list(tb.rows)) {
        const cells = [];
        for (const cell of _list(row.cells)) {
          if (Array.isArray(cell.text)) {
            const s = cell.text.map((p) => _list(p.runs).map((r) => r.text || "").join("")).join("\n").trim();
            if (s) cell.text = s;
            else delete cell.text;
          }
          delete cell.anchor;
          delete cell.merged;
          cells.push(cell);
        }
        newRows.push(cells);
      }
      tb.rows = newRows;
      out.push(el);
      continue;
    }
    if (el.type === "image" && Array.isArray(el.flip)) {
      el.flip = { h: el.flip.includes("h"), v: el.flip.includes("v") };
      out.push(el);
      continue;
    }
    if (el.type !== "text" && el.type !== "shape") {
      out.push(el);
      continue;
    }
    const paras = pageParas(el.text);
    delete el.text;
    if (el.type === "text") {
      if (paras.length) el.paragraphs = paras;
      out.push(el);
      continue;
    }
    const anchor = el.anchor;
    const autofit = el.autofit;
    delete el.anchor;
    delete el.autofit;
    out.push(el);
    if (paras.length) {
      const t = { type: "text" };
      if (el.id !== undefined && el.id !== null) t.id = `${el.id}-t`;
      if (el.name) t.name = `${el.name} — текст`;
      if (el.placeholder) t.placeholder = el.placeholder;
      if (el.bounds) t.bounds = el.bounds;
      if (el.rotation !== undefined && el.rotation !== null) t.rotation = el.rotation;
      if (el.opacity !== undefined && el.opacity !== null) t.opacity = el.opacity;
      if (el.bleed) t.bleed = true;
      if (anchor) t.anchor = anchor;
      if (autofit) t.autofit = autofit;
      t.paragraphs = paras;
      if (el.coverage !== undefined && el.coverage !== null) t.coverage = el.coverage;
      out.push(t);
    }
  }
  return out;
}

module.exports = { pageRun, pagePara, pageParas, atlasToPageGrammar };
