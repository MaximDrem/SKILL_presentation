// typical.cjs — компактные JSON-примеры слайдов (порт helpers/typical.py v3.2.1).
'use strict';
const path = require("path");
const { PT_PER_PX, WRAP_SLACK, textW, _list } = require("./builder/textfit.cjs");
const { pyJsonString } = require("./numfmt.cjs");

const _obj = (x) => (x !== null && typeof x === "object" && !Array.isArray(x));

function _fitsWidth(text, sz, bold, wPx, font = null) {
  return textW(text, sz, bold, font) <= wPx * PT_PER_PX * WRAP_SLACK;
}

function _placeholder(bounds, sz, bold, font = null) {
  const w = Array.isArray(bounds) && bounds.length === 4 ? bounds[2] : 1280;
  for (const cand of ["Заголовок", "Заг.", "Aa"]) {
    if (_fitsWidth(cand, sz, bold, w, font)) return cand;
  }
  return "Aa";
}

function dslColor(c) {
  if (typeof c === "string") return c;
  if (_obj(c)) {
    if (typeof c.hex === "string") return c.hex;
    const st = c.stops;
    if (Array.isArray(st)) {
      const out = [];
      for (const s of st) {
        if (_obj(s)) {
          const col = (s.color || {}).hex;
          if (typeof col === "string") out.push([s.pos ?? 0, col]);
        } else if (Array.isArray(s) && s.length === 2 && typeof s[1] === "string") {
          out.push([s[0], s[1]]);
        }
      }
      if (out.length) return { angle: c.angle ?? 45, stops: out };
    }
  }
  return null;
}

function dslFill(fill) {
  if (!_obj(fill)) return null;
  if (fill.none === true) return { none: true };
  if (typeof fill.solid === "string") return { solid: fill.solid };
  const g = dslColor(fill.gradient);
  return _obj(g) ? { gradient: g } : null;
}

function clampCanvas(bounds) {
  let [x, y, w, h] = bounds;
  w = Math.min(w, 1280);
  h = Math.min(h, 720);
  return [Math.min(Math.max(0, x), 1280 - w), Math.min(Math.max(0, y), 720 - h), w, h];
}

const isAsciiPrintable = (s) => [...s].every((c) => {
  const code = c.codePointAt(0);
  return code >= 0x20 && code < 0x7f;
});

function typicalExample(page, ptype, protoNo, mediaClass, srcResolver) {
  const els = [];
  for (let el of _list(page.elements)) {
    if (!_obj(el)) continue;
    if (el.bleed !== true && Array.isArray(el.bounds)) {
      el = { ...el, bounds: clampCanvas(el.bounds) };
    }
    const t = el.type;
    if (t === "text") {
      const paras = [];
      for (const p of _list(el.paragraphs)) {
        const runs = [];
        for (const r of _list(p.runs).slice(0, 1)) {
          let txt = String(r.text || "").trim();
          const sz = r.sz || 14;
          if (!(/^\d+$/.test(txt) || ([...txt].length <= 4 && isAsciiPrintable(txt)))) {
            const bold = !!r.b;
            if (sz >= 24 || bold) {
              txt = _placeholder(el.bounds, sz, bold, r.font);
            } else {
              txt = _fitsWidth("Текст", sz, bold, (el.bounds || [0, 0, 1280, 0])[2], r.font) ? "Текст" : "Аа";
            }
          }
          const run = { text: txt };
          for (const k of ["sz", "b", "i", "font"]) {
            if (r[k] !== undefined) run[k] = r[k];
          }
          const col = dslColor(r.color);
          if (col) run.color = col;
          runs.push(run);
        }
        if (runs.length) {
          const np = { runs };
          for (const k of ["align", "bullet", "bulletChar", "lineHeight", "spcBef", "spcAft"]) {
            if (p[k] !== undefined) np[k] = p[k];
          }
          paras.push(np);
        }
      }
      if (!paras.length) continue;
      const out = { type: "text", id: el.id, bounds: el.bounds };
      for (const k of ["anchor", "autofit", "bleed"]) {
        if (el[k] !== undefined) out[k] = el[k];
      }
      out.paragraphs = paras;
      els.push(out);
    } else if (t === "shape") {
      if (!el.shape) continue;
      const fill = dslFill(el.fill);
      let line = el.line;
      if (_obj(line)) {
        const col = dslColor(line.color);
        line = { w: line.w ?? 1, ...(col ? { color: col } : {}) };
      }
      if ((!fill || fill.none === true) && !line && !el.shadow) continue;
      let adj = el.adjustments;
      if (Array.isArray(adj)) adj = adj.map((a) => Math.round(a));
      const entries = [["type", "shape"], ["id", el.id], ["shape", el.shape], ["adjustments", adj],
                       ["bounds", el.bounds], ["fill", fill], ["line", line], ["shadow", el.shadow],
                       ["bleed", el.bleed], ["rotation", el.rotation], ["opacity", el.opacity]];
      els.push(Object.fromEntries(entries.filter(([, v]) => v !== undefined && v !== null)));
    } else if (t === "image") {
      const base = path.posix.basename(el.src || "");
      if (!base || mediaClass[base] !== "decor") continue;
      const rel = srcResolver(base);
      if (rel) {
        const out = { type: "image", src: rel, bounds: el.bounds };
        for (const k of ["bleed", "rotation", "opacity", "shadow", "srcRect"]) {
          if (el[k] !== undefined) out[k] = el[k];
        }
        els.push(out);
      }
    } else if (t === "table") {
      const tb = { ...el.table };
      tb.rows = (tb.rows || []).slice(0, 3);
      els.push({ type: "table", bounds: el.bounds, table: tb });
    } else if (t === "chart") {
      const ch = { ...el.chart };
      ch.series = _list(ch.series).slice(0, 2).map((s) => ({
        ...s,
        categories: _list(s.categories).slice(0, 4),
        values: _list(s.values).slice(0, 4),
      }));
      els.push({ type: "chart", bounds: el.bounds, chart: ch });
    }
  }
  return { pageType: ptype, proto: protoNo, elements: els };
}

// Компактный дамп: элемент на строку — json.dumps(el, ensure_ascii=False) из
// Python: separators (", ", ": "), float с «.0». Float-поля по схеме DSL:
// sz/lineHeight/rotation/opacity всегда float в unpack-выходе; значения chart
// series.values — float; остальные числа прошли _num (int если целое).
const FLOAT_KEYS = new Set(["sz"]);
const FLOAT_ARRAY_KEYS = new Set(["values"]);

function _dumpNum(v, floaty) {
  if (floaty && Number.isInteger(v) && Math.abs(v) < 1e21) return String(v) + ".0";
  if (Number.isInteger(v) && Math.abs(v) < 1e21) return String(v);
  return String(v);
}

function _dumpVal(v, floaty) {
  const { isPyFloat, pyFloatStr } = require("./jsonpy.cjs");
  if (isPyFloat(v)) return pyFloatStr(v.v);
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return _dumpNum(v, floaty);
  if (typeof v === "string") return pyJsonString(v);
  if (Array.isArray(v)) return "[" + v.map((x) => _dumpVal(x, floaty)).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) =>
    pyJsonString(String(k)) + ": " + _dumpVal(x, FLOAT_ARRAY_KEYS.has(k))).join(", ") + "}";
}

function dumpExampleLines(ex) {
  const lines = [`{"pageType": ${pyJsonString(ex.pageType)}, "proto": ${ex.proto},`, ' "elements": ['];
  ex.elements.forEach((el, i) => {
    lines.push("  " + _dumpVal(el) + (i < ex.elements.length - 1 ? "," : ""));
  });
  lines.push(" ]}");
  return lines;
}

module.exports = { typicalExample, dumpExampleLines, dslColor, dslFill, clampCanvas, _placeholder, _fitsWidth, _dumpVal };
