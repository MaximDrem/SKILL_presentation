// svgshape.cjs — image src=*.svg → нативные фигуры custGeom (порт svgshape.py v3.2.1).
'use strict';
const { pyRepr, pyRound } = require("../numfmt.cjs");

const VB_RE = /viewBox="(-?[\d.]+)[ ,](-?[\d.]+)[ ,]([\d.]+)[ ,]([\d.]+)"/;
const PATH_RE = /<path\s[^>]*?d="([^"]+)"[^>]*?\/>/g;
const FILL_RE = /fill="(#[0-9A-Fa-f]{6}|none)"/;
const OP_RE = /fill-opacity="([\d.]+)"/;
const CMD_RE = /([MLCZmlcz])\s*((?:-?[\d.eE]+\s*)*)/g;
const UNSUPPORTED_RE = /<\s*(rect|circle|ellipse|line|polyline|polygon|text|image|linearGradient|radialGradient|defs|use|g|tspan)\b|stroke=/;

class SvgError extends Error {
  constructor(msg) { super(msg); this.name = "SvgError"; }
}

function parseSvg(text) {
  if (UNSUPPORTED_RE.test(text)) throw new SvgError("поддерживаются только <path> с solid fill (M/L/C/Z)");
  const vb = VB_RE.exec(text);
  if (!vb) throw new SvgError("нет viewBox");
  const vw = parseFloat(vb[3]), vh = parseFloat(vb[4]);
  if (vw <= 0 || vh <= 0) throw new SvgError("пустой viewBox");
  const paths = [];
  for (const pm of text.matchAll(PATH_RE)) {
    const tag = pm[0];
    const d = pm[1];
    const fm = FILL_RE.exec(tag);
    const om = OP_RE.exec(tag);
    let fill = fm ? fm[1].toUpperCase() : null;
    if (fill === "NONE") fill = null;
    const opacity = om ? parseFloat(om[1]) : 1.0;
    _checkD(d);
    paths.push([d, fill, opacity]);
  }
  if (!paths.length) throw new SvgError("нет <path>");
  return [vw, vh, paths];
}

function _checkD(d) {
  let pos = 0;
  for (const m of d.matchAll(CMD_RE)) {
    const junk = d.slice(pos, m.index).replace(/[ ,\n]/g, "");
    if (junk) throw new SvgError(`мусор в path d: ${pyRepr(d.slice(pos, m.index))}`);
    if (m[1] === m[1].toLowerCase()) throw new SvgError("поддерживаются только absolute-команды (M/L/C/Z)");
    pos = m.index + m[0].length;
  }
  const tail = d.slice(pos).replace(/[ ,\n]/g, "");
  if (tail) throw new SvgError(`мусор в path d: ${pyRepr(d.slice(pos))}`);
}

function _dToOoxml(d, kx, ky) {
  const out = [];
  for (const m of d.matchAll(CMD_RE)) {
    const cmd = m[1].toUpperCase();
    const v = m[2].trim() ? m[2].trim().split(/\s+/).map(parseFloat) : [];
    if (cmd === "M" || cmd === "L") {
      const tag = cmd === "M" ? "moveTo" : "lnTo";
      out.push(`<a:${tag}><a:pt x="${pyRound(v[0] * kx)}" y="${pyRound(v[1] * ky)}"/></a:${tag}>`);
    } else if (cmd === "C") {
      const pts = [0, 2, 4].map((i) => `<a:pt x="${pyRound(v[i] * kx)}" y="${pyRound(v[i + 1] * ky)}"/>`).join("");
      out.push(`<a:cubicBezTo>${pts}</a:cubicBezTo>`);
    } else if (cmd === "Z") {
      out.push("<a:close/>");
    }
  }
  return out.join("");
}

function _spXml(sid, d, fill, opacity, x, y, cx, cy, kx, ky, rot, flips) {
  let fillXml;
  if (fill) {
    const alpha = opacity < 1.0 ? `<a:alpha val="${pyRound(opacity * 100000)}"/>` : "";
    fillXml = `<a:solidFill><a:srgbClr val="${fill.slice(1)}">${alpha}</a:srgbClr></a:solidFill>`;
  } else {
    fillXml = "<a:noFill/>";
  }
  return `<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<p:nvSpPr><p:cNvPr id="${sid}" name="svg ${sid}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm${rot}${flips}>` +
    `<a:off x="${pyRound(x)}" y="${pyRound(y)}"/><a:ext cx="${pyRound(cx)}" cy="${pyRound(cy)}"/>` +
    `</a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>` +
    `<a:rect l="0" t="0" r="0" b="0"/>` +
    `<a:pathLst><a:path w="${pyRound(cx)}" h="${pyRound(cy)}">` +
    `${_dToOoxml(d, kx, ky)}</a:path></a:pathLst></a:custGeom>${fillXml}` +
    `<a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
}

// addSvg работает на нашем DOM (slide.spTree — El) и возвращает первый sp.
function addSvg(spTree, nextId, svgText, x, y, cx, cy, { rotation = null, flip = null, opacity = null, fillOverride = null } = {}) {
  const { parseXml, docRoot } = require("../xml.cjs");
  let [vbW, vbH, paths] = parseSvg(svgText);
  if (fillOverride) paths = paths.map(([d, fill, op]) => [d, fill ? fillOverride : null, op]);
  let sid = nextId;
  const rot = rotation ? ` rot="${pyRound(rotation * 60000)}"` : "";
  let flips = "";
  if (flip) {
    if (flip.h) flips += ' flipH="1"';
    if (flip.v) flips += ' flipV="1"';
  }
  if (opacity !== null && opacity !== undefined && opacity < 1.0) {
    paths = paths.map(([d, fill, op]) => [d, fill, op * opacity]);
  }
  const kx = cx / vbW, ky = cy / vbH;
  let first = null;
  for (const [d, fill, op] of paths) {
    const spEl = docRoot(parseXml(_spXml(sid, d, fill, op, x, y, cx, cy, kx, ky, rot, flips)));
    spTree.children.push(spEl);
    if (first === null) first = spEl;
    sid += 1;
  }
  return { first, nextId: sid };
}

module.exports = { SvgError, parseSvg, _checkD, _dToOoxml, _spXml, addSvg };
