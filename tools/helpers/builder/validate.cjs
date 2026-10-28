// validate.cjs — валидация page-spec (порт builder/validate.py v3.2.1).
'use strict';
const fs = require("fs");
const path = require("path");
const { pyJsonDumps, pyRepr } = require("../numfmt.cjs");
const { isNumeric: _num } = require("../jsonpy.cjs"); // Python isinstance(v, (int, float)): Number | PyFloat | PyInt
const { ALIGN_MAP, ANCHOR_MAP, BUILD_SHAPES, CHART_KINDS, EMOJI_RE, HEX_RE, IMG_EXT, PLACEHOLDER_RE, UNRENDERABLE } = require("../consts.cjs");

// own-property enum check: prototype-ключи (toString, constructor, __proto__) не проходят
function _ownEnum(map, key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(map, key);
}

const _list = (x) => (Array.isArray(x) ? x : []);
const _obj = (x) => (x !== null && typeof x === "object" && !Array.isArray(x));

function validate(a, pages) {
  const failures = [];
  const fail = (page, el, msg, action) => {
    failures.push({ page, ...(el ? { el } : {}), ...(action ? { action } : {}), msg });
  };

  if (pages.length > 60) fail(null, null, `страниц ${pages.length} > 60`);
  const mediaDir = path.join(a.projectDir, "media");

  const srcEscapes = (src) => path.isAbsolute(src) || src.split("/").includes("..");

  const checkSrc = (tag, en, src, isBg) => {
    src = src.startsWith("media/") ? src.slice(6) : src;
    const ext = src.includes(".") ? src.split(".").pop().toLowerCase() : "";
    if (ext === "svg" && !isBg) {
      const p = path.join(mediaDir, src);
      if (!fs.existsSync(p)) {
        fail(tag, en, `src не найден: media/${src} (скопируйте медиа в media/ проекта как есть)`);
      } else {
        try {
          const { parseSvg } = require("./svgshape.cjs");
          parseSvg(fs.readFileSync(p, "utf8"));
        } catch (e) {
          fail(tag, en, `svg не поддерживается (${e.message}) — только path M/L/C/Z + solidFill (напр. picto-* из decor/pictograms/)`);
        }
      }
    } else if (UNRENDERABLE.has(ext)) {
      fail(tag, en, `формат .${ext} не рендерится движком (svg/wmf/emf/wdp) — используйте png/jpg` + (isBg ? " (правило касается только спеки; фоны шаблона переносятся кодом как есть)" : ""));
    } else if (!IMG_EXT.has(ext)) {
      fail(tag, en, `расширение .${ext} не поддерживается (png|jpg|jpeg|gif|webp|bmp)`);
    } else if (!fs.existsSync(path.join(mediaDir, src))) {
      fail(tag, en, `src не найден: media/${src} (скопируйте медиа в media/ проекта как есть)`);
    }
  };

  const checkGradient = (tag, en, g) => {
    if (!_obj(g) || !Array.isArray(g.stops) || !(g.stops.length >= 2 && g.stops.length <= 4)) {
      fail(tag, en, "gradient: stops — 2..4 пары [pos,цвет]");
      return;
    }
    if (g.angle !== undefined && g.angle !== null && (!_num(g.angle) || g.angle < 0 || g.angle >= 360)) {
      fail(tag, en, "gradient.angle 0..359.9");
    }
    g.stops.forEach((s, i) => {
      if (!(Array.isArray(s) && s.length === 2 && _num(s[0]) && s[0] >= 0 && s[0] <= 1 && typeof s[1] === "string" && HEX_RE.test(s[1]))) {
        fail(tag, en, `gradient.stops[${i}] — [0..1, #RRGGBB(AA)]`);
      }
    });
  };

  const checkFill = (tag, en, f) => {
    if (f === null || f === undefined) return;
    if (f.none === true) {
      if (Object.keys(f).length !== 1) fail(tag, en, "fill {none:true} — без других полей");
      return;
    }
    if (f.solid !== undefined && f.solid !== null) {
      if (!HEX_RE.test(String(f.solid))) fail(tag, en, `fill.solid ${pyJsonDumps(f.solid)} не #RRGGBB(AA)`);
      return;
    }
    if (f.gradient !== undefined && f.gradient !== null) {
      checkGradient(tag, en, f.gradient);
      return;
    }
    fail(tag, en, "fill — {solid}|{gradient}|{none:true}");
  };

  const checkLine = (tag, en, l) => {
    if (l === null || l === undefined) return;
    if (!_obj(l) || (l.w !== undefined && l.w !== null && !_num(l.w)) || (l.color !== undefined && l.color !== null && !HEX_RE.test(String(l.color)))) {
      fail(tag, en, "line — {w?:px float, color?:#RRGGBB(AA)}");
    }
  };

  for (const item of pages) {
    const tag = item.file, spec = item.spec;
    if (!_obj(spec)) {
      fail(tag, null, "страница — не объект");
      continue;
    }
    for (const k of Object.keys(spec)) {
      if (!["pageType", "background", "elements", "proto"].includes(k)) fail(tag, null, `unknown field страницы: ${k}`);
    }
    if (!["cover", "content", "divider", "closing"].includes(spec.pageType)) {
      fail(tag, null, `pageType обязателен: cover|content|divider|closing (сейчас: ${pyJsonDumps(spec.pageType)})`);
    }
    const bg = spec.background;
    if (bg !== undefined && bg !== null) {
      if (!_obj(bg)) {
        fail(tag, "background", "background — объект");
      } else if (bg.type === "solid") {
        if (!HEX_RE.test(String(bg.color || ""))) fail(tag, "background", `solid: color ${pyJsonDumps(bg.color ?? null)} не #RRGGBB(AA)`);
      } else if (bg.type === "image") {
        const src = bg.src;
        if (typeof src !== "string" || srcEscapes(src)) {
          fail(tag, "background", `image: src ${pyJsonDumps(src ?? null)} обязан быть относительным путём внутри media/`);
        } else {
          checkSrc(tag, "background", src, true);
        }
      } else if (bg.type === "gradient") {
        checkGradient(tag, "background", bg.gradient);
      } else {
        fail(tag, "background", `type ${pyJsonDumps(bg.type ?? null)} ∉ solid|image|gradient`);
      }
    }
    const els = spec.elements;
    if (!Array.isArray(els)) {
      fail(tag, null, "elements обязателен (массив)");
      continue;
    }
    if (els.length > 48) fail(tag, null, `элементов ${els.length} > 48`);
    const ids = new Set();
    let imgN = 0;
    const fracBounds = [];
    for (let ei = 0; ei < els.length; ei++) {
      const el = els[ei];
      const en = String(ei + 1);
      if (!_obj(el)) {
        fail(tag, en, "элемент — не объект");
        continue;
      }
      const t = el.type;
      if (!["shape", "text", "image", "chart", "table"].includes(t)) {
        fail(tag, en, `type ${pyJsonDumps(t ?? null)} ∉ shape|text|image|chart|table`);
        continue;
      }
      if (el.id !== undefined && el.id !== null) {
        if (typeof el.id !== "string") fail(tag, en, "id — строка");
        else if (ids.has(el.id)) fail(tag, en, `id «${el.id}» не уникален на странице`);
        ids.add(el.id);
      }
      const b = el.bounds;
      if (!(Array.isArray(b) && b.length === 4 && b.every(_num))) {
        fail(tag, en, `bounds — [x,y,w,h] из 4 чисел (px)${b !== undefined && b !== null ? "" : " — поле обязательно"}`);
      } else if (!b.every((v) => Number.isInteger(v))) {
        fracBounds.push(el.id || en);
      } else {
        if (b[2] <= 0 || b[3] <= 0) fail(tag, en, `bounds w/h должны быть > 0 (${b[2]}×${b[3]})`);
        const out = b[0] < 0 || b[1] < 0 || b[0] + b[2] > 1280 || b[1] + b[3] > 720;
        if (out && el.bleed !== true) {
          const nw = Math.min(b[2], 1280), nh = Math.min(b[3], 720);
          const nb = [Math.min(Math.max(0, b[0]), 1280 - nw), Math.min(Math.max(0, b[1]), 720 - nh), nw, nh];
          const nbStr = `[${nb.join(", ")}]`;
          if (t === "text") {
            fail(tag, en, `выход за канвас 1280×720 (${b.join(",")}) — текст обязан жить в канвасе`, `bounds→${nbStr}`);
          } else {
            const cardLike = t === "shape" && (String(el.shape || "").startsWith("rect") || String(el.shape || "").startsWith("round"));
            if (cardLike) {
              fail(tag, en, `выход за канвас 1280×720 (${b.join(",")}) — default: впишите bounds→${nbStr} (контентная карточка не должна уходить за край; bleed:true — только для фонового декора)`, `bounds→${nbStr}`);
            } else {
              fail(tag, en, `выход за канвас 1280×720 без bleed:true (${b.join(",")}) — default: bleed:true (декор/фон уходит за край осознанно); если это контентный элемент — впишите bounds→${nbStr}`, "bleed:true");
            }
          }
        }
      }
      if (el.rotation !== undefined && el.rotation !== null && !_num(el.rotation)) fail(tag, en, "rotation — число (°)");
      if (el.opacity !== undefined && el.opacity !== null && (!_num(el.opacity) || el.opacity < 0 || el.opacity > 1)) fail(tag, en, "opacity 0..1");
      const fl = el.flip;
      if (fl !== undefined && fl !== null && (!_obj(fl) || (fl.h !== undefined && fl.h !== null && typeof fl.h !== "boolean") || (fl.v !== undefined && fl.v !== null && typeof fl.v !== "boolean"))) {
        fail(tag, en, "flip — {h?:bool,v?:bool}");
      }
      if (el.bleed !== undefined && el.bleed !== null && typeof el.bleed !== "boolean") fail(tag, en, "bleed — boolean");
      if (t === "shape") {
        if (!BUILD_SHAPES.has(el.shape)) {
          const nm = String(el.shape || "");
          let hint = "";
          if (nm.includes("onnector") || nm.toLowerCase().includes("line")) {
            hint = "; линий в пресетах нет — сделайте линию как shape rect с h=1..3px и fill.solid (без line)";
          }
          fail(tag, en, `shape ${pyJsonDumps(el.shape ?? null)} ∉ пресетам (${[...BUILD_SHAPES].sort().join(",")})${hint}`);
        }
        const adj = el.adjustments;
        if (adj !== undefined && adj !== null && (!Array.isArray(adj) || adj.some((v) => !Number.isInteger(v) || v < 0 || v > 100000))) {
          fail(tag, en, "adjustments — целые 0..100000");
        }
        checkFill(tag, en, el.fill);
        checkLine(tag, en, el.line);
        if (el.shadow !== undefined && el.shadow !== null && !["none", "soft", "lift"].includes(el.shadow)) {
          fail(tag, en, "shadow ∈ none|soft|lift (токены; свободные параметры запрещены)");
        }
        for (const k of Object.keys(el)) {
          if (!["type", "shape", "adjustments", "bounds", "fill", "line", "shadow", "rotation", "opacity", "flip", "bleed", "id"].includes(k)) {
            fail(tag, en, `unknown field shape: ${k}`);
          }
        }
      } else if (t === "image") {
        imgN += 1;
        const src = el.src;
        if (typeof src !== "string" || srcEscapes(src)) {
          fail(tag, en, `src ${pyJsonDumps(src ?? null)} — относительный путь внутри media/ проекта`);
        } else {
          checkSrc(tag, en, src, false);
        }
        const r = el.srcRect;
        if (r !== undefined && r !== null && typeof src === "string" && src.toLowerCase().endsWith(".svg")) {
          fail(tag, en, "srcRect для svg не поддерживается (нативные фигуры; обрежь иконку в исходнике)");
        }
        if (r !== undefined && r !== null) {
          if (!_obj(r) || ["l", "t", "r", "b"].some((s) => r[s] !== undefined && r[s] !== null && (!_num(r[s]) || r[s] < 0 || r[s] > 1))) {
            fail(tag, en, "srcRect — доли 0..1 {l,t,r,b}");
          } else if (((r.l || 0) + (r.r || 0)) > 1 || ((r.t || 0) + (r.b || 0)) > 1) {
            fail(tag, en, "srcRect: l+r ≤ 1 и t+b ≤ 1");
          }
        }
        if (el.shadow !== undefined && el.shadow !== null && !["none", "soft", "lift"].includes(el.shadow)) {
          fail(tag, en, "shadow ∈ none|soft|lift (токены; свободные параметры запрещены)");
        }
        if (el.shadow !== undefined && el.shadow !== null && typeof src === "string" && src.toLowerCase().endsWith(".svg")) {
          fail(tag, en, "shadow для svg не поддерживается (нативные фигуры; тень — только у растровых image)");
        }
        for (const k of Object.keys(el)) {
          if (!["type", "src", "srcRect", "bounds", "rotation", "opacity", "flip", "shadow", "bleed", "id"].includes(k)) {
            fail(tag, en, `unknown field image: ${k}`);
          }
        }
      } else if (t === "chart") {
        const c = el.chart;
        if (!_obj(c)) {
          fail(tag, en, "chart обязателен");
        } else {
          if (!_ownEnum(CHART_KINDS, c.kind)) {
            fail(tag, en, `chart.kind ${pyJsonDumps(c.kind ?? null)} ∉ bar|line|pie|doughnut (combo/radar/3D — фаза 2)`);
          }
          if (!Array.isArray(c.series) || !c.series.length) {
            fail(tag, en, "chart.series — непустой массив");
          } else {
            c.series.forEach((s, si) => {
              if (!_obj(s)) {
                fail(tag, en, `series[${si}] — объект`);
                return;
              }
              if (!Array.isArray(s.values) || s.values.some((v) => !_num(v))) {
                fail(tag, en, `series[${si}].values — числа`);
              }
              if (s.categories !== undefined && s.categories !== null && Array.isArray(s.values) && _list(s.categories).length !== s.values.length) {
                fail(tag, en, `series[${si}]: categories (${_list(s.categories).length}) ≠ values (${s.values.length})`);
              }
              if (s.name !== undefined && s.name !== null && typeof s.name !== "string") {
                fail(tag, en, `series[${si}].name — строка`);
              }
            });
          }
          if (c.colors !== undefined && c.colors !== null && (!Array.isArray(c.colors) || c.colors.some((x) => !HEX_RE.test(String(x || ""))))) {
            fail(tag, en, "chart.colors — массив #RRGGBB");
          }
          if (c.legend !== undefined && c.legend !== null && typeof c.legend !== "boolean") fail(tag, en, "chart.legend — boolean");
          if (c.title !== undefined && c.title !== null && typeof c.title !== "string") fail(tag, en, "chart.title — строка");
        }
        for (const k of Object.keys(el)) {
          if (!["type", "chart", "bounds", "rotation", "opacity", "flip", "bleed", "id"].includes(k)) {
            fail(tag, en, `unknown field chart: ${k}`);
          }
        }
      } else if (t === "table") {
        const tb = el.table;
        if (!_obj(tb)) {
          fail(tag, en, "table обязателен");
        } else {
          const rows = tb.rows;
          if (!Array.isArray(rows) || !rows.length) {
            fail(tag, en, "table.rows — непустой массив");
          } else {
            const cols = Array.isArray(tb.colW) ? tb.colW.length : null;
            if (!cols) {
              fail(tag, en, "table.colW обязателен (px, сумма = bounds.w)");
            } else {
              const sumW = tb.colW.reduce((x, y) => x + y, 0);
              if (Math.abs(sumW - b[2]) > 1) fail(tag, en, `сумма colW (${sumW}) ≠ bounds.w (${b[2]})`);
              rows.forEach((row, ri) => {
                if (!Array.isArray(row) || row.length !== cols) {
                  fail(tag, en, `row[${ri}]: ячеек ${Array.isArray(row) ? row.length : row}, по colW ждём ${cols}`);
                  return;
                }
                row.forEach((cell, ci) => {
                  if (!_obj(cell) || typeof cell.text !== "string") {
                    fail(tag, en, `row[${ri}][${ci}] — {text:string,…}`);
                    return;
                  }
                  if (cell.colSpan !== undefined && cell.colSpan !== null && (!Number.isInteger(cell.colSpan) || cell.colSpan < 1 || ci + cell.colSpan > cols)) {
                    fail(tag, en, `row[${ri}][${ci}]: colSpan выходит за сетку`);
                  }
                  if (cell.rowSpan !== undefined && cell.rowSpan !== null && (!Number.isInteger(cell.rowSpan) || cell.rowSpan < 1 || ri + cell.rowSpan > rows.length)) {
                    fail(tag, en, `row[${ri}][${ci}]: rowSpan выходит за сетку`);
                  }
                  if (cell.fill !== undefined && cell.fill !== null && cell.fill !== "none" && !HEX_RE.test(String(cell.fill))) {
                    fail(tag, en, `row[${ri}][${ci}]: fill ${pyJsonDumps(cell.fill)} не #RRGGBB(AA)`);
                  }
                  if (cell.color !== undefined && cell.color !== null && !HEX_RE.test(String(cell.color))) {
                    fail(tag, en, `row[${ri}][${ci}]: color ${pyJsonDumps(cell.color)} не #RRGGBB(AA)`);
                  }
                  if (cell.sz !== undefined && cell.sz !== null && (!_num(cell.sz) || !(cell.sz >= 1 && cell.sz <= 4000))) {
                    fail(tag, en, `row[${ri}][${ci}]: sz — число pt в диапазоне 1–4000`);
                  }
                  if (cell.align !== undefined && cell.align !== null && !_ownEnum(ALIGN_MAP, cell.align)) {
                    fail(tag, en, `row[${ri}][${ci}]: align ∉ l|ctr|r|just`);
                  }
                  if (cell.borders !== undefined && cell.borders !== null) {
                    for (const side of "lrtb") {
                      const x = _obj(cell.borders) ? cell.borders[side] : undefined;
                      if (x !== undefined && x !== null && (!_obj(x) || (x.w !== undefined && x.w !== null && !_num(x.w)) || (x.color !== undefined && x.color !== null && !HEX_RE.test(String(x.color))))) {
                        fail(tag, en, `row[${ri}][${ci}]: borders.${side} — {w?:px,color?:#hex}`);
                      }
                    }
                  }
                  for (const k of Object.keys(cell)) {
                    if (!["text", "b", "i", "sz", "color", "fill", "align", "colSpan", "rowSpan", "borders"].includes(k)) {
                      fail(tag, en, `row[${ri}][${ci}]: unknown field ячейки: ${k}`);
                    }
                  }
                });
              });
            }
            if (tb.font !== undefined && tb.font !== null && typeof tb.font !== "string") fail(tag, en, "table.font — строка");
            if (tb.sz !== undefined && tb.sz !== null && (!_num(tb.sz) || !(tb.sz >= 1 && tb.sz <= 4000))) {
              fail(tag, en, "table.sz — число pt в диапазоне 1–4000");
            }
            if (tb.color !== undefined && tb.color !== null && !HEX_RE.test(String(tb.color))) fail(tag, en, "table.color не #RRGGBB(AA)");
            const brd = tb.border;
            if (brd !== undefined && brd !== null && (!_obj(brd) || (brd.w !== undefined && brd.w !== null && !_num(brd.w)) || (brd.color !== undefined && brd.color !== null && !HEX_RE.test(String(brd.color))))) {
              fail(tag, en, "table.border — {w?:px,color?:#hex}");
            }
            if (tb.inset !== undefined && tb.inset !== null && !_num(tb.inset)) fail(tag, en, "table.inset — число px");
          }
        }
        for (const k of Object.keys(el)) {
          if (!["type", "table", "bounds", "rotation", "opacity", "flip", "bleed", "id"].includes(k)) {
            fail(tag, en, `unknown field table: ${k}`);
          }
        }
      } else if (t === "text") {
        const ps = el.paragraphs;
        if (!Array.isArray(ps) || !ps.length) {
          fail(tag, en, "text.paragraphs — непустой массив");
        } else {
          ps.forEach((p, x) => {
            if (!_obj(p)) {
              fail(tag, en, `paragraphs[${x}] — объект`);
              return;
            }
            if (!Array.isArray(p.runs) || !p.runs.length) {
              fail(tag, en, `paragraphs[${x}].runs — непустой массив`);
              return;
            }
            p.runs.forEach((r, y) => {
              if (!_obj(r) || typeof r.text !== "string") {
                fail(tag, en, `paragraphs[${x}].runs[${y}] — {text:string,…}`);
                return;
              }
              if (r.sz !== undefined && r.sz !== null && (!_num(r.sz) || !(r.sz >= 1 && r.sz <= 4000))) {
                fail(tag, en, `runs[${y}].sz — число pt в диапазоне 1–4000 (${pyRepr(r.sz)} вне его)`);
              }
              if (r.font !== undefined && r.font !== null && typeof r.font !== "string") fail(tag, en, `runs[${y}].font — строка`);
              const col = r.color;
              if (col !== undefined && col !== null && !(typeof col === "string" && HEX_RE.test(col)) && !_obj(col)) {
                fail(tag, en, `runs[${y}].color — #RRGGBB(AA) или gradient-объект`);
              } else if (_obj(col)) {
                checkGradient(tag, en, col);
              }
              if (typeof r.text === "string" && PLACEHOLDER_RE.test(r.text)) {
                fail(tag, en, `плейсхолдер в тексте: «${[...r.text].slice(0, 40).join("")}»`);
              }
              if (typeof r.text === "string" && EMOJI_RE.test(r.text)) {
                fail(tag, en, `emoji/пиктограмма в тексте: «${[...r.text].slice(0, 40).join("")}» — рендерится как «¶»/тофу; поставьте shape-пресет или image вместо символа`);
              }
            });
            if (p.align !== undefined && p.align !== null && !_ownEnum(ALIGN_MAP, p.align)) fail(tag, en, `paragraphs[${x}].align ∉ l|ctr|r|just`);
            if (p.bullet !== undefined && p.bullet !== null && !["none", "char"].includes(p.bullet)) fail(tag, en, `paragraphs[${x}].bullet ∈ none|char`);
            if (p.bulletChar !== undefined && p.bulletChar !== null && typeof p.bulletChar !== "string") fail(tag, en, `paragraphs[${x}].bulletChar — строка`);
            if (p.lineHeight !== undefined && p.lineHeight !== null && (!_num(p.lineHeight) || p.lineHeight <= 0)) fail(tag, en, `paragraphs[${x}].lineHeight — число > 0`);
            for (const sp of ["spcBef", "spcAft"]) {
              if (p[sp] !== undefined && p[sp] !== null && (!_num(p[sp]) || p[sp] < 0)) fail(tag, en, `paragraphs[${x}].${sp} — pt ≥ 0`);
            }
            for (const k of Object.keys(p)) {
              if (!["runs", "align", "bullet", "bulletChar", "lineHeight", "spcBef", "spcAft"].includes(k)) {
                fail(tag, en, `unknown field абзаца: ${k}`);
              }
            }
          });
        }
        if (el.anchor !== undefined && el.anchor !== null && !_ownEnum(ANCHOR_MAP, el.anchor)) fail(tag, en, "anchor ∉ t|ctr|b");
        if (el.autofit === "spAutoFit") {
          fail(tag, en, "autofit=spAutoFit запрещён: PowerPoint/LO раздувают бокс на соседние элементы (наложения). Задайте h с запасом или уменьшите sz");
        } else if (el.autofit !== undefined && el.autofit !== null && !["none", "norm"].includes(el.autofit)) {
          fail(tag, en, "autofit ∉ none|norm");
        }
        for (const k of Object.keys(el)) {
          if (!["type", "paragraphs", "bounds", "anchor", "autofit", "rotation", "opacity", "flip", "bleed", "id"].includes(k)) {
            fail(tag, en, `unknown field text: ${k}`);
          }
        }
      }
    }
    if (imgN > 8) fail(tag, null, `картинок ${imgN} > 8 на странице`);
    if (fracBounds.length) {
      fail(tag, null, `bounds [x,y,w,h] только из целых px — дробные у ${fracBounds.length} эл. (${fracBounds.slice(0, 8).join(", ")}${fracBounds.length > 8 ? ", …" : ""}): округлите до целых`);
    }
    for (const el of els) {
      if (!_obj(el)) continue;
      if (el.type === "table") {
        for (const row of _list((el.table || {}).rows)) {
          for (const c of _list(row)) {
            if (_obj(c) && PLACEHOLDER_RE.test(c.text || "")) {
              fail(tag, null, `плейсхолдер в таблице: «${[...String(c.text)].slice(0, 40).join("")}»`);
            }
          }
        }
      }
      if (el.type === "chart" && (el.chart || {}).title && PLACEHOLDER_RE.test(el.chart.title)) {
        fail(tag, null, `плейсхолдер в заголовке чарта: «${[...el.chart.title].slice(0, 40).join("")}»`);
      }
    }
  }
  return failures;
}

module.exports = { validate };
