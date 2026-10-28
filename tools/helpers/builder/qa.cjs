// qa.cjs — advisory WARN при build (порт builder/qa.py v3.2.1).
'use strict';
const fs = require("fs");
const path = require("path");
const { pyFixed, pyPercent0, pyRound, pySum } = require("../numfmt.cjs");
const { imageInfo } = require("../unpack/image.cjs");
const { CH255 } = require("./srgb_luma_table.cjs");

const WARN_ALPHA = 0.06;
const GRAD_ALPHA_OK = 0.90;
const CONTRAST_MIN = 2.5;

function _parse(hexs) {
  if (typeof hexs !== "string") return null;
  let h = hexs.replace(/^#/, "");
  if (h.length === 6) h += "FF";
  if (h.length !== 8) return null;
  if (!/^[0-9A-Fa-f]{8}$/.test(h)) return null;
  return [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function _lum(rgb) {
  // каналы у нас всегда целые 0..255 → бит-точная таблица вместо V8 pow
  const [r, g, b] = rgb;
  return 0.2126 * CH255[r] + 0.7152 * CH255[g] + 0.0722 * CH255[b];
}

function _composite(fg, bg) {
  const [fr, fg_, fb, fa] = fg;
  const a = fa / 255;
  return [fr, fg_, fb].map((f, i) => pyRound(f * a + bg[i] * (1 - a)));
}

function _contrast(c1, c2) {
  let l1 = _lum(c1), l2 = _lum(c2);
  if (l1 < l2) [l1, l2] = [l2, l1];
  return (l1 + 0.05) / (l2 + 0.05);
}

function* _fills(el) {
  const f = el.fill;
  if (!f || f.none) return;
  if (f.solid) yield ["solid", f.solid];
  const g = f.gradient;
  if (g) {
    for (const s of g.stops || []) {
      yield ["gradient", Array.isArray(s) ? s[1] : null];
    }
  }
}

function _textUnderlay(el, shapes, bgRgb) {
  if (!el.bounds) return bgRgb;
  const [x, y, w, h] = el.bounds;
  let best = null, bestArea = null;
  for (const [b, rgb] of shapes) {
    const [sx, sy, sw, sh] = b;
    if (sx <= x + 2 && sy <= y + 2 && sx + sw >= x + w - 2 && sy + sh >= y + h - 2) {
      const area = sw * sh;
      if (bestArea === null || area < bestArea) {
        best = rgb;
        bestArea = area;
      }
    }
  }
  return best !== null ? best : bgRgb;
}

function _fixColor(rgb, under) {
  const pivot = _lum(under) > 0.2 ? [0, 0, 0] : [255, 255, 255];
  let best = pivot;
  for (let i = 1; i <= 20; i++) {
    const f = i / 20;
    const cand = rgb.map((c, j) => pyRound(c + (pivot[j] - c) * f));
    if (_contrast(cand, under) >= CONTRAST_MIN) {
      best = cand;
      break;
    }
  }
  return ["#" + best.map((v) => v.toString(16).toUpperCase().padStart(2, "0")).join(""), _contrast(best, under)];
}

function _imageSize(p) {
  // Python: PIL.Image.open — svg/нерастровые не открываются → None
  const ext = path.extname(p).slice(1).toLowerCase();
  if (!["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return null;
  try {
    const buf = fs.readFileSync(p);
    const info = imageInfo(buf, ext);
    return info.width != null && info.height != null ? [info.width, info.height] : null;
  } catch {
    return null;
  }
}

const _list = (x) => (Array.isArray(x) ? x : []);
const _obj = (x) => (x !== null && typeof x === "object" && !Array.isArray(x));

function qaWarnings(pages, underlays = null, projectDir = null) {
  const hard = [], warns = [];
  const gradAlphas = new Map(); // alpha -> {pages: [], n: int}
  for (const item of pages) {
    const spec = item.spec;
    const bg = spec.background || {};
    let bgRgb = null;
    if (bg.type === "solid" && typeof bg.color === "string") {
      const p = _parse(bg.color);
      if (p) bgRgb = _composite(p, [0, 0, 0]);
    }
    if (bgRgb === null && underlays) bgRgb = underlays[item.file] ?? null;
    const shapes = [];
    if (bgRgb !== null && bgRgb !== undefined) {
      for (const el of _list(spec.elements)) {
        if (!_obj(el) || el.type !== "shape" || !el.bounds) continue;
        const comp = [];
        for (const [, hexs] of _fills(el)) {
          if (typeof hexs !== "string") continue;
          const p = _parse(hexs);
          if (p) comp.push(_composite(p, bgRgb));
        }
        if (comp.length) {
          const avg = [0, 1, 2].map((i) => pyRound(pySum(comp.map((c) => c[i])) / comp.length));
          shapes.push([el.bounds, avg]);
        }
      }
    }
    const invisible = [];
    for (const el of _list(spec.elements)) {
      if (!_obj(el)) continue;
      const eid = el.id || `bounds=[${(el.bounds || []).map(String).join(", ")}]`;
      if (el.type === "shape") {
        let broke = false;
        for (const [kind, hexs] of _fills(el)) {
          if (typeof hexs !== "string") continue;
          const p = _parse(hexs);
          if (!p) continue;
          if (kind === "gradient" && p[3] < GRAD_ALPHA_OK * 255) {
            let g = gradAlphas.get(p[3]);
            if (!g) { g = { pages: [], n: 0 }; gradAlphas.set(p[3], g); }
            if (!g.pages.includes(item.file)) g.pages.push(item.file);
            g.n += 1;
            broke = true;
            break;
          }
          if (kind === "solid" && p[3] < WARN_ALPHA * 255) invisible.push([eid, p[3]]);
        }
        void broke;
      } else if (el.type === "text") {
        const under = _textUnderlay(el, shapes, bgRgb);
        if (under === null || under === undefined) continue;
        for (const para of _list(el.paragraphs)) {
          if (!_obj(para)) continue;
          for (const r of _list(para.runs)) {
            if (!_obj(r)) continue;
            const c = r.color;
            if (typeof c !== "string") continue;
            const p = _parse(c);
            if (!p) continue;
            const eff = _composite(p, under);
            if (_contrast(eff, under) < CONTRAST_MIN) {
              const txt = [...String(r.text || "")].slice(0, 25).join("");
              const [fix, ratio] = _fixColor(p.slice(0, 3), under);
              warns.push(`${item.file} ${eid}: текст «${txt}» цвета ${c} сливается с подложкой (контраст ${pyFixed(_contrast(eff, under), 1)} < ${pyFixed(CONTRAST_MIN, 1)}) — default: замените на ${fix} (контраст ${pyFixed(ratio, 1)}) или другой с контрастом ≥${pyFixed(CONTRAST_MIN, 1)} (править не обязательно)`);
            }
          }
        }
      } else if (el.type === "image" && projectDir && typeof el.src === "string" && el.bounds) {
        const size = _imageSize(path.join(projectDir, el.src));
        if (size) {
          const sr = el.srcRect || {};
          const iw = size[0] * (1 - (sr.l || 0) - (sr.r || 0));
          const ih = size[1] * (1 - (sr.t || 0) - (sr.b || 0));
          const [bw, bh] = [el.bounds[2], el.bounds[3]];
          if (iw > 0 && ih > 0 && bh > 0) {
            const aImg = iw / ih, aB = bw / bh;
            const dev = Math.max(aImg, aB) / Math.min(aImg, aB) - 1;
            const fix = `default: h→${pyRound(bw / aImg)}px (или w→${pyRound(bh * aImg)}px, либо srcRect)`;
            if (dev > 0.30) {
              hard.push({ page: item.file, el: eid,
                          action: `h→${pyRound(bw / aImg)}px`,
                          msg: `[HARD] картинка «${el.src}» растянута (${Math.trunc(dev * 100)}%): кадр ${Math.trunc(iw)}×${Math.trunc(ih)} в bounds ${bw}×${bh} — пропорции менять нельзя; ${fix.replace("default: ", "")}` });
            } else if (dev > 0.08) {
              warns.push(`${item.file} ${eid}: картинка «${el.src}» растянута (${Math.trunc(dev * 100)}%): кадр ${Math.trunc(iw)}×${Math.trunc(ih)} в bounds ${bw}×${bh} — ${fix} (нужно исправить)`);
            }
            if (Object.keys(sr).length === 0 && (bw > size[0] * 1.5 || bh > size[1] * 1.5)) {
              warns.push(`${item.file} ${eid}: картинка «${el.src}» растянута крупнее исходника (${size[0]}×${size[1]}px → ${bw}×${bh}px на слайде) — будет мыло; default: bounds ≤ ${size[0]}×${size[1]}px, либо это иконка-слот, не главный визуал (нужно исправить)`);
            }
          }
        }
      }
    }
    for (const [eid, a] of invisible) {
      warns.push(`${item.file} ${eid}: фигура почти невидима (alpha ${pyPercent0(a / 255)}) — default: alpha→10%; если фигура не нужна — уберите (править не обязательно)`);
    }
  }
  for (const [alpha, g] of gradAlphas) {
    const pagesList = g.pages.slice(0, 8).join(", ") + (g.pages.length > 8 ? ", …" : "");
    warns.push(`alpha ${pyPercent0(alpha / 255)} в градиентных стопах: ${g.n} эл. на страницах ${pagesList} — LO/P7/приложение рендерят по-разному; default: solid с alpha или непрозрачный градиент к цвету фона (править не обязательно)`);
  }
  return [hard, warns];
}

module.exports = { WARN_ALPHA, GRAD_ALPHA_OK, CONTRAST_MIN, qaWarnings, _parse, _lum, _composite, _contrast, _fixColor, _textUnderlay, _fills, _imageSize };
