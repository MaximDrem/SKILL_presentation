// ooxml.cjs — OPC-утилиты unpack (порт unpack/ooxml.py v3.2.1).
'use strict';
const path = require("path");
const { El, parseXml, docRoot } = require("../xml.cjs");
const { jsRound, num } = require("../numfmt.cjs");

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  c: "http://schemas.openxmlformats.org/drawingml/2006/chart",
  asvg: "http://schemas.microsoft.com/office/drawing/2016/SVG/main",
};
const NS_REV = Object.fromEntries(Object.entries(NS).map(([k, v]) => [v, k]));

const UNRENDERABLE = new Set(["svg", "wmf", "emf", "wdp", "jxr", "tif", "tiff"]);

function qn(tag) {
  const [prefix, local] = tag.split(":", 2);
  return `{${NS[prefix]}}${local}`;
}

function parse(data) {
  if (data === null || data === undefined) return null;
  return docRoot(parseXml(data));
}

function tagOf(el) {
  if (!el || typeof el.local !== "string") return null;
  const prefix = NS_REV[el.ns];
  return prefix ? `${prefix}:${el.local}` : el.local;
}

function childrenOf(el) {
  if (!el) return [];
  return el.children.filter((c) => c instanceof El);
}

function localOf(el) { return el.local; }

function _matches(el, tag) {
  if (tag.includes(":")) return el.tag === qn(tag);
  return el.local === tag;
}

function kidsOf(el, tag) {
  return childrenOf(el).filter((c) => _matches(c, tag));
}

function kidOf(el, tag) {
  for (const c of childrenOf(el)) {
    if (_matches(c, tag)) return c;
  }
  return null;
}

function first(...els) {
  for (const el of els) if (el !== null && el !== undefined) return el;
  return null;
}

function attrsOf(el) {
  const out = {};
  if (!el) return out;
  for (const [k, v] of el.attrs) {
    const m = k.match(/^\{([^}]*)\}(.*)$/);
    if (m) {
      const prefix = NS_REV[m[1]];
      out[prefix ? `${prefix}:${m[2]}` : m[2]] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function textOf(el) {
  if (!el) return "";
  let out = "";
  for (const node of el.iter()) {
    void node;
  }
  // itertext: все текстовые узлы поддерева в document order
  const walk = (n) => {
    for (const c of n.children) {
      if (typeof c === "string") out += c;
      else walk(c);
    }
  };
  walk(el);
  return out;
}

function findDesc(el, tag) {
  if (!el) return null;
  for (const c of el.iter()) {
    if (c === el) continue;
    if (_matches(c, tag)) return c;
  }
  return null;
}

function parseRels(xml) {
  const out = {};
  if (!xml) return out;
  const root = parse(xml);
  for (const el of root.iter()) {
    if (el.local === "Relationship") {
      const a = attrsOf(el);
      out[a.Id] = a;
    }
  }
  return out;
}

function resolveTarget(baseDir, target) {
  return path.posix.normalize(path.posix.join(baseDir, target));
}

const _jsRound = jsRound;
const _num = num;

function r1(v) { return _num(_jsRound(v * 10) / 10); }
function r2(v) { return _num(_jsRound(v * 100) / 100); }

function jsNum(o) {
  if (typeof o === "number" && Number.isInteger(o) && Math.abs(o) < 2 ** 53) {
    const t = Math.trunc(o);
    return t === 0 ? 0 : t; // -0 → 0 (Python int(-0.0) == 0)
  }
  if (Array.isArray(o)) return o.map(jsNum);
  if (o !== null && typeof o === "object") {
    const out = {};
    for (const [k, v] of Object.entries(o)) out[k] = jsNum(v);
    return out;
  }
  return o;
}

module.exports = {
  NS, NS_REV, UNRENDERABLE, qn, parseXml: parse, tagOf, childrenOf, kidsOf, kidOf, first,
  attrsOf, textOf, findDesc, parseRels, resolveTarget, r1, r2, jsNum, _jsRound, _num, localOf,
  jsRound, num,
};
