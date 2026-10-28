// overlap.cjs — HARD-детекция перекрытий (порт builder/overlap.py v3.2.1).
'use strict';
const { pyFixed, pyRound, pySum } = require("../numfmt.cjs");
const { _composite, _contrast, _parse } = require("./qa.cjs");
const { BOLD_K, HARD_1LINE, HARD_TOL, PT_PER_PX, _charW, _fontK, estimateNeed, _list } = require("./textfit.cjs");

const MIN_AREA = 400;
const MIN_FRAC = 0.05;
const IMG_MIN_FRAC = 0.25;
const CANVAS_BG = 0.60;

const _obj = (x) => (x !== null && typeof x === "object" && !Array.isArray(x));

function _spillOver(el) {
  const [needPt, boxPt] = estimateNeed(el);
  const sizes = [];
  for (const p of _list(el.paragraphs)) {
    if (!_obj(p)) continue;
    for (const r of _list(p.runs)) {
      if (_obj(r)) sizes.push(r.sz || 14);
    }
  }
  if (!sizes.length) return false;
  const lineH = Math.max(...sizes) * 1.25;
  const lines = Math.max(1, pyRound(needPt / lineH));
  const tol = lines <= 1 ? HARD_1LINE : HARD_TOL;
  return needPt > boxPt * tol + 1;
}

function _effBox(el) {
  const [x, y, w, h] = el.bounds;
  if (el.type !== "text") return [x, y, x + w, y + h];
  const paras = _list(el.paragraphs).filter(_obj);
  const runsAll = [];
  for (const p of paras) {
    for (const r of _list(p.runs)) {
      if (_obj(r) && String(r.text || "").trim()) runsAll.push(r);
    }
  }
  if (!runsAll.length) return [x, y, x, y];
  const maxSz = Math.max(...runsAll.map((r) => r.sz || 14));
  const [needPt, , , nLines] = estimateNeed(el);
  let glyphH;
  if (_spillOver(el)) {
    glyphH = needPt / PT_PER_PX;
  } else {
    const lineH = maxSz * 1.25;
    glyphH = ((Math.max(nLines, 1) - 1) * lineH + maxSz * 0.85) / PT_PER_PX;
  }
  const effH = glyphH < h ? Math.min(h, glyphH) : h + (glyphH - h);
  const anchor = el.anchor || "t";
  let y0;
  if (anchor === "ctr") y0 = y + (h - effH) / 2;
  else if (anchor === "b") y0 = y + h - effH;
  else y0 = y;
  let gx0 = null, gx1 = null;
  for (const p of paras) {
    const runs = _list(p.runs).filter((r) => _obj(r) && String(r.text || "").trim());
    if (!runs.length) continue;
    const sz = Math.max(...runs.map((r) => r.sz || 14));
    const bold = runs.some((r) => r.b);
    let pwPt = 0.0;
    for (const r of runs) {
      const mult = (r.sz || sz) * ((r.b || bold) ? BOLD_K : 1.0) * _fontK(r.font);
      pwPt += pySum([...String(r.text)].map((c) => _charW(c))) * mult;
    }
    const pw = Math.min(w, pwPt / PT_PER_PX) + 10;
    const align = p.align || "l";
    let px0;
    if (align === "ctr") px0 = x + (w - pw) / 2;
    else if (align === "r") px0 = x + w - pw;
    else px0 = x;
    gx0 = gx0 === null ? px0 : Math.min(gx0, px0);
    gx1 = gx1 === null ? px0 + pw : Math.max(gx1, px0 + pw);
  }
  return [gx0, y0, gx1, y0 + effH];
}

function _label(el) {
  for (const p of _list(el.paragraphs)) {
    if (!_obj(p)) continue;
    const t = _list(p.runs).map((r) => (_obj(r) ? String(r.text ?? "") : "")).join("").trim();
    if (t) return [...t].slice(0, 30).join("");
  }
  return "";
}

function _isBgImage(el) {
  const [x, y, w, h] = el.bounds;
  return el.bleed === true || (w * h) >= 1280 * 720 * CANVAS_BG;
}

function _fixHint(elA, elB, aid, bid, ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
  const bLower = elB.bounds[1] > elA.bounds[1];
  let shift = Math.trunc(bLower ? (ay1 - by0) : (by1 - ay0));
  if (shift <= 0) shift = Math.trunc(ay1 - ay0);
  const spillA = _spillOver(elA), spillB = _spillOver(elB);
  if (spillA || spillB) {
    const uid = spillA ? aid : bid;
    return `у «${uid}» глифы вылезают за бокс: НЕ растите h вниз — default: сдвиньте верхний бокс ВВЕРХ на ${shift}px (y → y−${shift}) или уменьшите sz верхнего текста`;
  }
  return `default: сдвиньте верхний бокс ВВЕРХ на ≥${shift}px (y → y−${shift}) или уменьшите его sz`;
}

function _shapeFillRgb(el, bgRgb) {
  const f = el.fill;
  if (!_obj(f) || f.none === true) return null;
  let cols = [];
  if (typeof f.solid === "string") cols = [f.solid];
  else if (_obj(f.gradient)) {
    cols = _list(f.gradient.stops).filter((s) => Array.isArray(s) && s.length === 2 && typeof s[1] === "string").map((s) => s[1]);
  }
  const parsed = cols.map(_parse).filter(Boolean);
  if (!parsed.length) return null;
  if (Math.max(...parsed.map((p) => p[3])) < 0.20 * 255) return null;
  const comp = parsed.map((p) => _composite(p, bgRgb));
  return [0, 1, 2].map((i) => pyRound(pySum(comp.map((c) => c[i])) / comp.length));
}

function _pageBgRgb(item, underlays) {
  const bg = item.spec.background || {};
  if (bg.type === "solid" && typeof bg.color === "string") {
    const p = _parse(bg.color);
    if (p) return _composite(p, [0, 0, 0]);
  }
  if (bg.type === "gradient") {
    let cols = _list((bg.gradient || {}).stops).filter((s) => Array.isArray(s) && s.length === 2 && typeof s[1] === "string").map((s) => _parse(s[1]));
    cols = cols.filter(Boolean);
    if (cols.length) {
      const comp = cols.map((c) => _composite(c, [0, 0, 0]));
      return [0, 1, 2].map((i) => pyRound(pySum(comp.map((c) => c[i])) / comp.length));
    }
  }
  if (underlays && underlays[item.file] !== undefined) return underlays[item.file];
  return [255, 255, 255];
}

function _firstTextRgb(el) {
  for (const p of _list(el.paragraphs)) {
    if (!_obj(p)) continue;
    for (const r of _list(p.runs)) {
      if (_obj(r) && String(r.text || "").trim()) {
        const c = r.color;
        if (typeof c === "string") return _parse(c);
      }
    }
  }
  return null;
}

function overlapCheck(pages, underlays = null) {
  const hard = [], warn = [];
  for (const item of pages) {
    const els = _list(item.spec.elements).filter((e) => _obj(e) && Array.isArray(e.bounds) && e.bounds.length === 4);
    const texts = els.map((e, en) => [`el${en}`, e]).filter(([, e]) => e.type === "text");
    const images = els.map((e, en) => [`el${en}`, e]).filter(([, e]) => e.type === "image" && !_isBgImage(e));
    const boxes = els.map((el, en) => [el.id || `#${en + 1}`, el, _effBox(el)]);
    const textSet = new Set(texts.map(([, e]) => e));
    const imageSet = new Set(images.map(([, e]) => e));

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [aid, elA, a] = boxes[i];
        const [bid, elB, b] = boxes[j];
        if (elA.bleed === true || elB.bleed === true) continue;
        const isTextPair = textSet.has(elA) && textSet.has(elB);
        const isTextImage = (textSet.has(elA) !== textSet.has(elB)) && (imageSet.has(elA) || imageSet.has(elB));
        const isImagePair = imageSet.has(elA) && imageSet.has(elB);
        if (!(isTextPair || isTextImage || isImagePair)) continue;
        const ix0 = Math.max(a[0], b[0]), iy0 = Math.max(a[1], b[1]);
        const ix1 = Math.min(a[2], b[2]), iy1 = Math.min(a[3], b[3]);
        const iw = ix1 - ix0, ih = iy1 - iy0;
        if (iw <= 0 || ih <= 0) continue;
        const inter = iw * ih;
        const areaA = (a[2] - a[0]) * (a[3] - a[1]);
        const areaB = (b[2] - b[0]) * (b[3] - b[1]);
        const small = Math.min(areaA, areaB);
        const frac = small ? inter / small : 0;
        if (isImagePair) {
          const contain = frac >= 0.90;
          if (!contain && frac >= IMG_MIN_FRAC && inter >= MIN_AREA) {
            warn.push(`${item.file}: декор «${aid}» частично наезжает на «${bid}» (${pyFixed(iw, 0)}×${pyFixed(ih, 0)}px, ${pyFixed(frac * 100, 0)}% меньшего) — если это не задуманная композиция, разведите (править не обязательно)`);
          }
          continue;
        }
        if (inter < MIN_AREA || frac < MIN_FRAC) continue;
        const alab = _label(elA), blab = _label(elB);
        const hint = _fixHint(elA, elB, aid, bid, ...a, ...b);
        if (isTextImage) {
          const imgId = imageSet.has(elA) ? aid : bid;
          const txtId = imageSet.has(elA) ? bid : aid;
          hard.push({ page: item.file, el: txtId,
                      action: "разведите текст и картинку",
                      msg: `[HARD] текст «${alab || blab}» (${txtId}) перекрыт картинкой (${imgId}) на ${pyFixed(iw, 0)}×${pyFixed(ih, 0)}px (${pyFixed(frac * 100, 0)}% меньшего) — ${hint}` });
        } else {
          hard.push({ page: item.file, el: aid,
                      action: "разведите боксы",
                      msg: `[HARD] текст «${alab}» (${aid}) наезжает на «${blab}» (${bid}) — пересечение ${pyFixed(iw, 0)}×${pyFixed(ih, 0)}px (${pyFixed(frac * 100, 0)}% меньшего); ${hint}` });
        }
      }
    }

    for (const [si, sh] of els.map((e, en) => [en, e]).filter(([, e]) => e.type === "shape")) {
      const frgb = _shapeFillRgb(sh, _pageBgRgb(item, underlays));
      if (frgb === null || sh.bleed === true) continue;
      const [sx, sy, sw, shh] = sh.bounds;
      for (const [ti, t] of els.map((e, en) => [en, e]).filter(([, e]) => e.type === "text")) {
        if (t.bleed === true) continue;
        const tb = _effBox(t);
        if (tb[0] === tb[2]) continue;
        const ix0 = Math.max(sx, tb[0]), iy0 = Math.max(sy, tb[1]);
        const ix1 = Math.min(sx + sw, tb[2]), iy1 = Math.min(sy + shh, tb[3]);
        const iw = ix1 - ix0, ih = iy1 - iy0;
        if (iw <= 0 || ih <= 0) continue;
        const inter = iw * ih;
        const garea = (tb[2] - tb[0]) * (tb[3] - tb[1]);
        if (garea <= 0 || inter < MIN_AREA || inter / garea < MIN_FRAC) continue;
        const tid = t.id || `#${ti + 1}`;
        const sid = sh.id || `#${si + 1}`;
        if (si > ti) {
          hard.push({ page: item.file, el: tid,
                      action: "отодвиньте фигуру от текста",
                      msg: `[HARD] текст «${_label(t)}» (${tid}) накрыт фигурой (${sid}) на ${pyFixed(iw, 0)}×${pyFixed(ih, 0)}px — фигура поверх текста; default: сдвиньте фигуру вправо/вниз за глифы текста (x ≥ ${pyRound(tb[2]) + 8} или y ≥ ${pyRound(tb[3]) + 8})` });
        } else {
          const trgb = _firstTextRgb(t);
          if (trgb !== null && trgb !== undefined) {
            const ratio = _contrast(frgb, trgb.slice(0, 3));
            if (ratio < 2.5) {
              const lum = 0.2126 * frgb[0] + 0.7152 * frgb[1] + 0.0722 * frgb[2];
              const anti = lum > 140 ? "#1A1A1A" : "#FFFFFF";
              hard.push({ page: item.file, el: tid,
                          action: `color→${anti}`,
                          msg: `[HARD] текст «${_label(t)}» (${tid}) сливается с фигурой под ним (${sid}, контраст ${pyFixed(ratio, 1)} < 2.5) — default: цвет текста → ${anti} или уберите/перекрасьте фигуру` });
            }
          }
        }
      }
    }
  }
  return [hard, warn];
}

function overlapWarnings(pages) {
  return overlapCheck(pages)[1];
}

module.exports = { MIN_AREA, MIN_FRAC, IMG_MIN_FRAC, CANVAS_BG, overlapCheck, overlapWarnings, _effBox, _spillOver, _shapeFillRgb, _pageBgRgb };
