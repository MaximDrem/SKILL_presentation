// textfit.cjs — оценка вместимости текста (порт builder/textfit.py v3.2.1).
'use strict';
const { pyFixed, pySum } = require("../numfmt.cjs");
const { WIDTHS } = require("./charwidths.cjs");

const PT_PER_PX = 0.75;
const LINE_FACTOR = 1.25;
const WRAP_SLACK = 0.96;
const WARN_TOL = 1.05;
const HARD_TOL = 1.08;
const HARD_1LINE = 1.4;
const BOLD_K = 1.08;
const PX_PER_PT = 1 / PT_PER_PX;

const W_CYR_HI = 0.74;
const W_CYR_LO = 0.62;
const W_LAT_HI = 0.67;
const W_LAT_LO = 0.55;
const W_DIGIT = 0.59;
const W_SYMBOL = 0.53;
const W_PUNCT = 0.54;
const W_SPACE = 0.30;

const FONT_K = { "century gothic": 1.13, "bookman": 1.10, "verdana": 1.10, "arial black": 1.10, "trebuchet": 1.06 };

// longest-first: «sb sans display» не должен съедать «sb sans display semibold»
const _FAMILIES = [...new Set(Object.keys(WIDTHS).map((k) => k.slice(0, -2)))].sort((a, b) => b.length - a.length);

// Python str.isdigit(): \p{Nd} + цифры No/other (superscripts, circled, эфиопские и пр.)
const PY_DIGIT_EXTRA = [[0xB2, 0xB3], [0xB9, 0xB9], [0x1369, 0x1371], [0x19DA, 0x19DA], [0x2070, 0x2070],
  [0x2074, 0x2079], [0x2080, 0x2089], [0x2460, 0x2468], [0x2474, 0x247C], [0x2488, 0x2490], [0x24EA, 0x24EA],
  [0x24F5, 0x24FD], [0x24FF, 0x24FF], [0x2776, 0x277E], [0x2780, 0x2788], [0x278A, 0x2792],
  [0x10A40, 0x10A43], [0x10E60, 0x10E68], [0x11052, 0x1105A], [0x1F100, 0x1F10A]];
const isDigit = (ch) => {
  if (/^\p{Nd}$/u.test(ch)) return true;
  const cp = ch.codePointAt(0);
  return PY_DIGIT_EXTRA.some(([a, b]) => cp >= a && cp <= b);
};
const isAlpha = (ch) => /^\p{L}$/u.test(ch);
const isUpper = (ch) => /^\p{Lu}$/u.test(ch);
const cpLen = (s) => [...s].length;
const cpSlice = (s, n) => [...s].slice(0, n).join("");
const _list = (x) => (Array.isArray(x) ? x : []);

function _fontK(name) {
  const n = (name || "").toLowerCase();
  for (const [key, k] of Object.entries(FONT_K)) {
    if (n.includes(key)) return k;
  }
  return 1.0;
}

function _familyKey(name, bold) {
  const n = (name || "").toLowerCase();
  const fam = _FAMILIES.find((f) => n.includes(f));
  if (fam === undefined) return null;
  const b = bold ? "1" : "0";
  if (WIDTHS[`${fam}|${b}`]) return [fam, !!bold];
  if (WIDTHS[`${fam}|0`]) return [fam, false];
  return null;
}

function _charW(ch, font, bold) {
  bold = !!bold;
  const key = _familyKey(font, bold);
  if (key !== null) {
    const w = WIDTHS[`${key[0]}|${key[1] ? "1" : "0"}`][ch];
    if (w !== undefined) return w * (bold && !key[1] ? BOLD_K : 1.0);
  }
  let w;
  if (ch === " ") w = W_SPACE;
  else if (isDigit(ch)) w = W_DIGIT;
  else if (isAlpha(ch)) {
    const code = ch.codePointAt(0);
    const cyr = code >= 0x400 && code <= 0x4ff;
    w = isUpper(ch) ? (cyr ? W_CYR_HI : W_LAT_HI) : (cyr ? W_CYR_LO : W_LAT_LO);
  } else if ("%+@#№$€₽&".includes(ch)) w = W_SYMBOL;
  else w = W_PUNCT;
  if (key === null) {
    w *= _fontK(font);
    if (bold) w *= BOLD_K;
  } else if (bold && !key[1]) w *= BOLD_K;
  return w;
}

function textW(text, sz, bold = false, font = null) {
  const widths = [];
  for (const c of text) widths.push(_charW(c, font, bold));
  return pySum(widths) * sz;
}

function _tokens(text) {
  const out = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (ch === " " || "—–-".includes(ch)) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

function _wrap(text, sz, bold, availPt, font = null) {
  let lines = 0, cur = 0.0, widest = 0.0;
  for (const seg of text.split("\n")) {
    lines += 1;
    cur = 0.0;
    for (const t of _tokens(seg)) {
      const w = textW(t, sz, bold, font);
      widest = Math.max(widest, w);
      if (cur > 0 && cur + w > availPt) {
        lines += 1;
        cur = w;
      } else {
        cur += w;
      }
    }
  }
  return [lines, widest];
}

function estimateNeed(el) {
  const wPx = el.bounds[2], hPx = el.bounds[3];
  const availPt = wPx * PT_PER_PX * WRAP_SLACK;
  const boxH = hPx * PT_PER_PX;
  let need = 0.0, widest = 0.0, totalLines = 0;
  for (const p of _list(el.paragraphs)) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) continue;
    const runs = _list(p.runs).filter((r) => typeof r === "object" && r !== null && !Array.isArray(r) && String(r.text || "").trim());
    if (!runs.length) continue;
    const sz = Math.max(...runs.map((r) => r.sz || 14));
    const bold = runs.some((r) => r.b);
    const lh = p.lineHeight && typeof p.lineHeight === "object" ? p.lineHeight.valueOf() : p.lineHeight;
    const lineH = sz * (typeof lh === "number" ? lh : LINE_FACTOR);
    for (const r of runs) {
      const [lines, tw] = _wrap(String(r.text), r.sz || sz, !!(r.b) || bold, availPt, r.font);
      need += lines * lineH * ((r.sz || sz) / sz);
      totalLines += lines;
      widest = Math.max(widest, tw);
    }
    need += (p.spcBef || 0) + (p.spcAft || 0);
  }
  return [need, boxH, widest, totalLines];
}

function minHeightPx(need, tol) {
  return -Math.floor(-((need / tol) * PX_PER_PT));
}

function _scaled(el, k) {
  const out = { ...el };
  const paras = [];
  for (const p of _list(el.paragraphs)) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) continue;
    const p2 = { ...p };
    p2.runs = _list(p.runs).filter((r) => typeof r === "object" && r !== null && !Array.isArray(r))
      .map((r) => ({ ...r, sz: pyRoundHalf((r.sz || 14) * k) }));
    paras.push(p2);
  }
  out.paragraphs = paras;
  return out;
}

// Python round() ties-to-even для _scaled
function pyRoundHalf(v) {
  const f = Math.floor(v);
  const diff = v - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

function maxFontPt(el, boxH, hardTol) {
  const [need] = estimateNeed(el);
  if (need <= 0) return null;
  const sizes = [];
  for (const p of _list(el.paragraphs)) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) continue;
    for (const r of _list(p.runs)) {
      if (typeof r === "object" && r !== null && !Array.isArray(r) && r.sz) sizes.push(r.sz);
    }
  }
  const base = sizes.length ? Math.max(...sizes) : 14;
  const probe = Math.trunc(base * (boxH * hardTol) / need);
  for (let cand = Math.min(probe, Math.trunc(base)); cand > 5; cand--) {
    if (estimateNeed(_scaled(el, cand / base))[0] <= boxH * hardTol + 1) return cand;
  }
  return null;
}

function _widestToken(el) {
  let best = "", bestW = 0.0, base = null;
  for (const p of _list(el.paragraphs)) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) continue;
    const runs = _list(p.runs).filter((r) => typeof r === "object" && r !== null && !Array.isArray(r) && String(r.text || "").trim());
    if (!runs.length) continue;
    const sz = Math.max(...runs.map((r) => r.sz || 14));
    base = base === null ? sz : Math.max(base, sz);
    const bold = runs.some((r) => r.b);
    for (const r of runs) {
      const multSz = r.sz || sz;
      const rBold = !!r.b || bold;
      for (const t of _tokens(String(r.text))) {
        const w = textW(t, multSz, rBold, r.font);
        if (w > bestW) {
          best = t.trim();
          bestW = w;
        }
      }
    }
  }
  return [best, bestW, base === null ? 14 : base];
}

function _fullLineW(el) {
  let best = 0.0;
  for (const p of _list(el.paragraphs)) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) continue;
    const runs = _list(p.runs).filter((r) => typeof r === "object" && r !== null && !Array.isArray(r) && String(r.text || "").trim());
    if (!runs.length) continue;
    const sz = Math.max(...runs.map((r) => r.sz || 14));
    const bold = runs.some((r) => r.b);
    let w = 0.0;
    for (const r of runs) {
      w += textW(String(r.text), r.sz || sz, !!r.b || bold, r.font);
    }
    best = Math.max(best, w);
  }
  return best;
}

function _totalChars(el) {
  let n = 0;
  for (const p of _list(el.paragraphs)) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) continue;
    for (const r of _list(p.runs)) {
      if (typeof r === "object" && r !== null && !Array.isArray(r)) n += cpLen(String(r.text || ""));
    }
  }
  return n;
}

function labelOf(el, n = 30) {
  for (const p of _list(el.paragraphs)) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) continue;
    const t = _list(p.runs).map((r) => (typeof r === "object" && r !== null && !Array.isArray(r)) ? String(r.text ?? "") : "").join("").trim();
    if (t) return cpSlice(t, n);
  }
  return "";
}

function textfitCheck(pages) {
  const hard = [], warn = [];
  for (const item of pages) {
    const els = _list(item.spec.elements).filter((e) => typeof e === "object" && e !== null && !Array.isArray(e));
    const textBoxes = els.filter((e) => e.type === "text" && Array.isArray(e.bounds) && e.bounds.length === 4).map((e) => e.bounds);
    for (const el of els) {
      if (el.type !== "text" || !el.bounds) continue;
      if (el.autofit === "norm") continue;
      const wPx = el.bounds[2];
      const hPx = el.bounds[3];
      const availPt = wPx * PT_PER_PX * WRAP_SLACK;
      const [need, boxH, widest, totalLines] = estimateNeed(el);
      if (need <= 0) continue;
      const label = labelOf(el);
      const eid = el.id || `bounds=[${el.bounds.map(String).join(", ")}]`;
      const hardTol = totalLines <= 1 ? HARD_1LINE : HARD_TOL;

      const _hitsSibling = (nx, ny, nw, nh) => {
        const x0 = el.bounds[0], y0 = el.bounds[1];
        const rx = x0 + (nx - x0), ry = y0 + (ny - y0);
        for (const tb of textBoxes) {
          if (tb === el.bounds) continue;
          if (Math.min(rx + nw, tb[0] + tb[2]) - Math.max(rx, tb[0]) > 0 &&
              Math.min(ry + nh, tb[1] + tb[3]) - Math.max(ry, tb[1]) > 0) return true;
        }
        return false;
      };

      if (widest > availPt * HARD_TOL) {
        const [tok, , baseSz] = _widestToken(el);
        const needW = -Math.floor(-(widest / WRAP_SLACK / PT_PER_PX));
        const maxSz = Math.trunc(baseSz * availPt / widest);
        const szOk = 8 <= maxSz && maxSz < baseSz;
        const wOk = (el.bounds[0] + needW <= 1280 && !_hitsSibling(el.bounds[0], el.bounds[1], needW, el.bounds[3]));
        const tokLen = cpLen(tok);
        const fitChars = Math.min(Math.trunc(tokLen * availPt / widest), tokLen - 1);
        const shorten = fitChars >= 3
          ? `сократите слово «${tok}» до ≤${fitChars} символов (сейчас ${tokLen})`
          : `замените слово «${tok}» более коротким синонимом`;
        const action = wOk ? `w→${needW}px` : (szOk ? `sz→${maxSz}pt` : shorten);
        const opts = [...(wOk ? [`увеличьте w до ≥${needW}px`] : []),
                      ...(szOk ? [`уменьшите sz до ≤${maxSz}pt`] : []), shorten];
        hard.push({ page: item.file, el: eid, action,
                    detail: `~${pyFixed(widest / PT_PER_PX, 0)}px при w=${wPx}px`,
                    msg: `[HARD] «${label}»: токен «${tok}» не влезает в бокс по ширине (перенос посреди слова); ${opts.join(" или ")}` });
      } else if (widest > availPt * WARN_TOL) {
        warn.push(`${item.file} ${eid}: «${label}» — токен впритык к ширине бокса (~${pyFixed(widest / PT_PER_PX, 0)}px при w=${wPx}px), возможен перенос (править не обязательно)`);
      }
      if (need > boxH * hardTol + 1) {
        const needH = minHeightPx(need, hardTol);
        const szAlt = maxFontPt(el, boxH, hardTol);
        const extra = el.autofit === "spAutoFit" ? "; autofit=spAutoFit запрещён (раздувает бокс на соседей)" : "";
        const hOk = (el.bounds[1] + needH <= 720 && !_hitsSibling(el.bounds[0], el.bounds[1], wPx, needH));
        const szOk = szAlt && szAlt >= 8;
        const total = _totalChars(el);
        const fitChars = Math.min(Math.trunc(total * boxH * hardTol / need), total - 1);
        const shorten = fitChars >= 4
          ? `сократите текст до ≤${fitChars} символов (сейчас ${total}) — фраза обязана остаться грамматичной`
          : "сократите текст — фраза обязана остаться грамматичной";
        let wOpt = null, w1 = 0;
        if (totalLines > 1) {
          w1 = -Math.floor(-(_fullLineW(el) / WRAP_SLACK / PT_PER_PX));
          if (w1 > wPx && el.bounds[0] + w1 <= 1280 && !_hitsSibling(el.bounds[0], el.bounds[1], w1, el.bounds[3])) {
            wOpt = `увеличьте w до ≥${w1}px (перенос на ~${totalLines} строки уйдёт)`;
          }
        }
        const action = hOk ? `h→${needH}px` : ((wOpt && `w→${w1}px`) || (szOk ? `sz→${szAlt}pt` : shorten));
        const opts = [...(hOk ? [`увеличьте h до ≥${needH}px`] : []),
                      ...(wOpt ? [wOpt] : []),
                      ...(szOk ? [`уменьшите sz до ≤${szAlt}pt`] : []), shorten];
        hard.push({ page: item.file, el: eid, action,
                    detail: `~${pyFixed(need / PT_PER_PX, 0)}px при h=${hPx}px, оценка строк: ${totalLines}`,
                    msg: `[HARD] текст «${label}» не влезает в бокс по высоте${extra}${totalLines > 1 ? ` (переносится на ~${totalLines} строки)` : ""} — ${opts.join(" ИЛИ ")}` });
      } else if (need > boxH * WARN_TOL + 1) {
        const needH = minHeightPx(need, WARN_TOL);
        warn.push(`${item.file} ${eid}: текст «${label}» ~${pyFixed(need / PT_PER_PX, 0)}px впритык к h=${hPx}px — default: поднять h до ≥${needH}px (нужно исправить — иначе рендер обрежет)`);
      }
    }
  }
  return [hard, warn];
}

module.exports = {
  PT_PER_PX, LINE_FACTOR, WRAP_SLACK, WARN_TOL, HARD_TOL, HARD_1LINE, BOLD_K, PX_PER_PT,
  textW, estimateNeed, minHeightPx, maxFontPt, labelOf, textfitCheck, _list,
  _charW, _fontK, _familyKey, _tokens, _wrap, _widestToken, _fullLineW, _scaled,
};
