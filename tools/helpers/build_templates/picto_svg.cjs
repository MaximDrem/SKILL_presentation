// picto_svg.cjs — извлечение векторных пиктограмм из слайдов шаблона (порт picto_svg.py).
'use strict';
const fs = require("fs");
const { unzipSync } = require("../../../vendor/fflate/lib/node.cjs");
const { El, parseXml, docRoot } = require("../xml.cjs");
const { pyRound } = require("../numfmt.cjs");

const SCHEME_DEFAULTS = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };

function _themeColors(pptxPath) {
  const parts = unzipSync(new Uint8Array(fs.readFileSync(pptxPath)));
  const root = docRoot(parseXml(Buffer.from(parts["ppt/theme/theme1.xml"])));
  const out = {};
  let scheme = null;
  for (const n of root.iter()) if (n instanceof El && n.local === "clrScheme") { scheme = n; break; }
  if (!scheme) return out;
  for (const slot of scheme.children) {
    if (!(slot instanceof El)) continue;
    const name = slot.local;
    const srgb = slot.children.find((c) => c instanceof El && c.local === "srgbClr");
    const sysc = slot.children.find((c) => c instanceof El && c.local === "sysClr");
    if (srgb) out[name] = "#" + (srgb.attrs.get("val") || "").toUpperCase();
    else if (sysc) out[name] = "#" + (sysc.attrs.get("lastClr") || "000000").toUpperCase();
  }
  return out;
}

function _adjust(hexcolor, el) {
  let r = parseInt(hexcolor.slice(1, 3), 16), g = parseInt(hexcolor.slice(3, 5), 16), b = parseInt(hexcolor.slice(5, 7), 16);
  let lumMod = null, lumOff = null, opacity = null;
  for (const t of el.children) {
    if (!(t instanceof El)) continue;
    const tag = t.local;
    const v = parseInt(t.attrs.get("val") || "100000", 10) / 100000;
    if (tag === "lumMod") lumMod = v;
    else if (tag === "lumOff") lumOff = v;
    else if (tag === "alpha") opacity = v;
  }
  if (lumMod !== null || lumOff !== null) {
    const m = lumMod !== null ? lumMod : 1.0, o = lumOff || 0.0;
    [r, g, b] = [r, g, b].map((c) => Math.min(255, Math.max(0, pyRound(c * m + 255 * o))));
    hexcolor = "#" + [r, g, b].map((v) => v.toString(16).toUpperCase().padStart(2, "0")).join("");
  }
  return [hexcolor, opacity];
}

function _resolveFill(spPr, colors) {
  if (!spPr) return [null, null];
  const kids = (l) => spPr.children.find((c) => c instanceof El && c.local === l) || null;
  if (kids("noFill")) return ["NONE", null];
  const sf = kids("solidFill");
  if (!sf) return [null, null];
  const srgb = sf.children.find((c) => c instanceof El && c.local === "srgbClr");
  const scheme = sf.children.find((c) => c instanceof El && c.local === "schemeClr");
  if (srgb) return _adjust("#" + (srgb.attrs.get("val") || "").toUpperCase(), srgb);
  if (scheme) {
    const val = scheme.attrs.get("val");
    const slot = SCHEME_DEFAULTS[val] !== undefined ? SCHEME_DEFAULTS[val] : val;
    const base = colors[slot] || colors[val];
    if (base) return _adjust(base, scheme);
  }
  return [null, null];
}

function _pathD(pathEl, kx, ky, ox, oy) {
  const w = parseInt(pathEl.attrs.get("w") || "0", 10) || 1;
  const h = parseInt(pathEl.attrs.get("h") || "0", 10) || 1;
  const parts = [];
  for (const cmd of pathEl.children) {
    if (!(cmd instanceof El)) continue;
    const tag = cmd.local;
    const pts = cmd.children.filter((p) => p instanceof El && p.local === "pt")
      .map((p) => [parseFloat(p.attrs.get("x")) * kx + ox, parseFloat(p.attrs.get("y")) * ky + oy]);
    if (tag === "moveTo" && pts.length) {
      parts.push(`M ${pyRound(pts[0][0])} ${pyRound(pts[0][1])}`);
    } else if (tag === "lnTo" && pts.length) {
      parts.push(`L ${pyRound(pts[0][0])} ${pyRound(pts[0][1])}`);
    } else if (tag === "cubicBezTo" && pts.length === 3) {
      parts.push("C " + pts.map((p) => `${pyRound(p[0])} ${pyRound(p[1])}`).join(" "));
    } else if (tag === "close") {
      parts.push("Z");
    }
  }
  return parts.join(" ");
}

function slideShapes(pptxPath, page) {
  const colors = _themeColors(pptxPath);
  const parts = unzipSync(new Uint8Array(fs.readFileSync(pptxPath)));
  const root = docRoot(parseXml(Buffer.from(parts[`ppt/slides/slide${page}.xml`])));
  const shapes = [];

  function walk(el, ox, oy, sx, sy, inherited = [null, null]) {
    for (const child of el.children) {
      if (!(child instanceof El)) continue;
      const tag = child.local;
      if (tag === "sp") {
        let txt = "";
        for (const t of child.iter()) {
          if (t instanceof El && t.local === "t") {
            txt += t.children.filter((c) => typeof c === "string").join("");
          }
        }
        if (txt.trim()) continue;
        const spPr = child.children.find((c) => c instanceof El && c.local === "spPr");
        const xf = spPr ? spPr.children.find((c) => c instanceof El && c.local === "xfrm") : null;
        const geom = spPr ? spPr.children.find((c) => c instanceof El && c.local === "custGeom") : null;
        if (!xf || !geom) continue;
        const off = xf.children.find((c) => c.local === "off"), ext = xf.children.find((c) => c.local === "ext");
        if (!off || !ext) continue;
        const bx = ox + parseInt(off.attrs.get("x"), 10) * sx;
        const by = oy + parseInt(off.attrs.get("y"), 10) * sy;
        const bcx = parseInt(ext.attrs.get("cx"), 10) * sx;
        const bcy = parseInt(ext.attrs.get("cy"), 10) * sy;
        let [fill, opacity] = _resolveFill(spPr, colors);
        if (fill === null) [fill, opacity] = inherited;
        const pathLst = geom.children.find((c) => c instanceof El && c.local === "pathLst");
        const ds = [];
        if (pathLst) {
          for (const pEl of pathLst.children) {
            if (!(pEl instanceof El) || pEl.local !== "path") continue;
            const w = parseInt(pEl.attrs.get("w") || "0", 10) || parseInt(ext.attrs.get("cx"), 10);
            const h = parseInt(pEl.attrs.get("h") || "0", 10) || parseInt(ext.attrs.get("cy"), 10);
            ds.push(_pathD(pEl, bcx / w, bcy / h, bx, by));
          }
        }
        if (ds.length) {
          shapes.push({ box: [bx, by, bcx, bcy], d: ds.join(" "), fill, opacity });
        }
      } else if (tag === "grpSp") {
        const grpPr = child.children.find((c) => c instanceof El && c.local === "grpSpPr");
        let grpFill = grpPr ? _resolveFill(grpPr, colors) : [null, null];
        if (grpFill[0] === null) grpFill = inherited;
        const xf = grpPr ? grpPr.children.find((c) => c instanceof El && c.local === "xfrm") : null;
        const get = (n) => (xf ? xf.children.find((c) => c instanceof El && c.local === n) : null);
        const off = get("off"), ext = get("ext"), cho = get("chOff"), che = get("chExt");
        if (!off || !ext || !cho || !che || !parseInt(che.attrs.get("cx"), 10) || !parseInt(che.attrs.get("cy"), 10)) {
          walk(child, ox, oy, sx, sy, grpFill);
          continue;
        }
        const gsx = parseInt(ext.attrs.get("cx"), 10) / parseInt(che.attrs.get("cx"), 10);
        const gsy = parseInt(ext.attrs.get("cy"), 10) / parseInt(che.attrs.get("cy"), 10);
        const nox = ox + (parseInt(off.attrs.get("x"), 10) - parseInt(cho.attrs.get("x"), 10) * gsx) * sx;
        const noy = oy + (parseInt(off.attrs.get("y"), 10) - parseInt(cho.attrs.get("y"), 10) * gsy) * sy;
        walk(child, nox, noy, gsx * sx, gsy * sy, grpFill);
      }
    }
  }

  let spTree = null;
  for (const n of root.iter()) {
    if (n instanceof El && n.local === "spTree") { spTree = n; break; }
  }
  if (spTree) walk(spTree, 0.0, 0.0, 1.0, 1.0);
  return shapes;
}

function cluster(shapes, pad) {
  const n = shapes.length;
  const parent = [...Array(n).keys()];
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const exp = shapes.map((s) => {
    const [x, y, cx, cy] = s.box;
    return [x - pad, y - pad, x + cx + pad, y + cy + pad];
  });
  for (let i = 0; i < n; i++) {
    const [x1, y1, x2, y2] = exp[i];
    for (let j = i + 1; j < n; j++) {
      const [a1, b1, a2, b2] = exp[j];
      if (x1 < a2 && a1 < x2 && y1 < b2 && b1 < y2) {
        const ri = find(i), rj = find(j);
        if (ri !== rj) parent[ri] = rj;
      }
    }
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }
  const out = [];
  for (const idxs of groups.values()) {
    const x1 = Math.min(...idxs.map((i) => shapes[i].box[0]));
    const y1 = Math.min(...idxs.map((i) => shapes[i].box[1]));
    const x2 = Math.max(...idxs.map((i) => shapes[i].box[0] + shapes[i].box[2]));
    const y2 = Math.max(...idxs.map((i) => shapes[i].box[1] + shapes[i].box[3]));
    out.push([[x1, y1, x2 - x1, y2 - y1], [...idxs].sort((a, b) => a - b)]);
  }
  out.sort((t1, t2) => {
    const k1 = Math.trunc(t1[0][1] / 300000), k2 = Math.trunc(t2[0][1] / 300000);
    return k1 - k2 || t1[0][0] - t2[0][0];
  });
  return out;
}

// round(v, 1) Python (ties-to-even по точному double) → строка как в Python
function round1(v) {
  // Python: str(int(round(v,1))) if round(v,1) == int(round(v,1)) else str(round(v,1))
  const { pyFixed } = require("../numfmt.cjs");
  const s = pyFixed(v, 1); // ровно 1 десятичный знак
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function iconSvg(shapes, idxs, box) {
  const [x, y, cx, cy] = box.map(pyRound);
  const k = 24 / Math.max(cx, cy);
  const disp = 384 / Math.max(cx, cy);
  const wp = Math.max(1, pyRound(cx * disp)), hp = Math.max(1, pyRound(cy * disp));
  const fmt = (v) => round1(v);
  const norm = (d) => {
    const vals = (d.match(/-?\d+/g) || []).map((s) => parseInt(s, 10));
    const scaled = vals.map((v, i) => (v - (i % 2 === 0 ? x : y)) * k);
    let idx = 0;
    return d.replace(/-?\d+/g, () => fmt(scaled[idx++]));
  };
  const vw = fmt(cx * k), vh = fmt(cy * k);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${wp}" height="${hp}">`];
  for (const i of idxs) {
    const s = shapes[i];
    const fill = s.fill;
    const attrs = fill && fill.startsWith("#") ? [`fill="${fill}"`] : ['fill="none"'];
    if (s.opacity !== null && s.opacity !== undefined) attrs.push(`fill-opacity="${require("../numfmt.cjs").pyFixed(s.opacity, 3)}"`);
    parts.push(`<path d="${norm(s.d)}" ${attrs.join(" ")} fill-rule="evenodd"/>`);
  }
  parts.push("</svg>");
  return parts.join("\n");
}

module.exports = { slideShapes, cluster, iconSvg, _themeColors };
