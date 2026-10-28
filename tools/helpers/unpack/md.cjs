// md.cjs — форматирование строк STYLE.md/атласа (порт unpack/md.py v3.2.1).
'use strict';
const path = require("path");
const { _jsRound } = require("./ooxml.cjs");

const _round0 = (v) => _jsRound(v);
const _n = (v) => (typeof v === "number" && Number.isInteger(v) ? String(Math.trunc(v)) : String(v));

function fmtBounds(b) {
  return "[" + b.map((v) => String(_round0(v))).join(",") + "]";
}

function fmtFill(fill) {
  if (!fill) return "";
  if (fill.solid) return `fill ${fill.solid}`;
  if (fill.gradient) {
    const g = fill.gradient;
    const stops = (g.stops || []).map((s) => (s.color && (s.color.hex || s.color.scheme)) || "?").join("→");
    return `grad ${g.angle !== null && g.angle !== undefined ? g.angle : "?"}° ${stops}`;
  }
  if (fill.none) return "noFill";
  if (fill.blip) return `fill img:${fill.blip}`;
  return "";
}

function elLine(el) {
  const parts = [`- ${el.type}`];
  if (el.type === "image") {
    parts.push(el.src ? `\`${el.src}\`` : el.linked ? "(linked)" : "(?)");
    if (el.svgOnly) parts.push("svg-only");
  }
  if (el.shape) parts.push(el.shape);
  if (el.adjustments) parts.push(`adj(${el.adjustments.map(_n).join(",")})`);
  if (el.type === "table" && el.table) {
    parts.push(`${el.table.rows.length}×${el.table.colW.length}`);
    const cells = [];
    for (const r of el.table.rows) {
      const line = r.map((c2) => String(c2.text || "").trim()).filter((x) => x).join(" | ");
      if (line) cells.push(line);
    }
    const plain = cells.join(" ¶ ");
    if (plain) parts.push(`«${[...plain].length > 80 ? [...plain].slice(0, 77).join("") + "…" : plain}»`);
  } else if (el.type === "chart") {
    if (el.part) parts.push(`→ \`${el.part}\``);
    if (el.chart) {
      parts.push(`chart ${el.chart.kind}` + (el.chart.series ? ` (${el.chart.series.length} сер.)` : ""));
    }
  }
  if (el.bounds) parts.push(fmtBounds(el.bounds));
  if (el.rotation) parts.push(`rot ${el.rotation}°`);
  if (el.opacity !== undefined && el.opacity !== null) parts.push(`op ${el.opacity}`);
  const f = fmtFill(el.fill);
  if (f) parts.push(f);
  if (el.line) parts.push(`line ${el.line.w !== undefined ? el.line.w : "?"}px ${el.line.color || ""}`.trim());
  if (el.paragraphs) {
    const first = el.paragraphs[0] && el.paragraphs[0].runs && el.paragraphs[0].runs[0] ? el.paragraphs[0].runs[0] : null;
    const plain = el.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join(" ¶ ").trim();
    if (plain) parts.push(`«${[...plain].length > 80 ? [...plain].slice(0, 77).join("") + "…" : plain}»`);
    if (first) {
      let col;
      if (typeof first.color === "string") col = first.color;
      else if (first.color && first.color.stops) {
        const fc = first.color;
        col = `grad ${fc.angle !== null && fc.angle !== undefined ? fc.angle : "?"}° ` +
          fc.stops.map((s) => (s.color && s.color.hex) || "?").join("→");
      } else col = null;
      const st = [first.sz ? `${_n(first.sz)}pt` : null, first.b ? "bold" : null, first.font, col].filter(Boolean).join(" ");
      if (st) parts.push(`(${st})`);
    }
  }
  if (el.shadow) parts.push(`shadow ${el.shadow.token}`);
  return parts.filter((x) => x).join(" ");
}

function usageStr(u) {
  let who;
  if (u.slide !== undefined && u.slide !== null) {
    who = `слайд ${u.slide}`;
  } else {
    who = path.posix.basename(u.part) + (u.slides ? ` (→ слайды ${u.slides.join(",")})` : "");
  }
  const det = [u.bounds ? fmtBounds(u.bounds) : null,
               u.rotation ? `rot ${u.rotation}°` : null,
               u.opacity !== undefined && u.opacity !== null ? `op ${u.opacity}` : null,
               u.via,
               u.role === "shape-fill" ? "shape-fill" : null].filter(Boolean).join(" ");
  return det ? `${who} ${det}` : who;
}

module.exports = { fmtBounds, fmtFill, elLine, usageStr };
