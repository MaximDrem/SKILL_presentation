// proto.cjs — разрешение прототипов страниц (порт builder/proto.py v3.2.1).
'use strict';

const _list = (x) => (Array.isArray(x) ? x : []);
const _obj = (x) => (x !== null && typeof x === "object" && !Array.isArray(x));

function atlasArchKey(p) {
  const el = _list(p.elements).find((e) => _obj(e) && e.mediaClass === "background" && (e.coverage || 0) >= 0.95 && e.src);
  if (el) return el.src;
  const b = p.background || {};
  if (b.media) return b.media;
  if (b.type === "solid") return `solid ${b.color || b.scheme || ""}`.trim();
  return b.type || "none";
}

function pagesProtoInfo(atlasByNo) {
  const info = {};
  for (const [n, p] of Object.entries(atlasByNo)) {
    const types = new Set(_list(p.elements).map((e) => e && e.type));
    const un = (p.coverageReport || {}).unrecognized;
    info[n] = {
      arch: atlasArchKey(p),
      degraded: Array.isArray(un) && un.length ? un : null,
      table: types.has("table"),
      chart: types.has("chart"),
    };
  }
  return info;
}

function resolveProtos(a, pages, info, auto) {
  const avail = Object.keys(info).map(Number).sort((x, y) => x - y);
  auto = auto || {};

  const withEl = (t) => {
    for (const n of avail) {
      if (info[n] && info[n][t]) return n;
    }
    return 0;
  };

  const byPageType = (pt) => {
    const m = auto.byPageType || {};
    if (m[pt]) return m[pt];
    const nMax = avail.length ? avail[avail.length - 1] : 0;
    const map = { cover: 1, divider: Math.min(2, nMax), content: Math.min(3, nMax), closing: nMax };
    return map[pt] !== undefined ? map[pt] : Math.min(3, nMax);
  };

  const out = [], failures = [];
  for (const item of pages) {
    const spec = item.spec;
    let proto = spec.proto, how = "явный";
    if (proto === undefined || proto === null) {
      const has = (t) => _list(spec.elements).some((e) => _obj(e) && e.type === t);
      if (has("table") && (auto.table || withEl("table"))) {
        proto = auto.table || withEl("table");
        how = "таблица-матч";
      } else if (has("chart") && (auto.chart || withEl("chart"))) {
        proto = auto.chart || withEl("chart");
        how = "чарт-матч";
      } else {
        proto = byPageType(spec.pageType);
        how = "pageType";
      }
    }
    if (!Object.prototype.hasOwnProperty.call(info, proto)) {
      const toc = a.mode === "clone" ? "STYLE.md" : "slides.md";
      let dflt = byPageType(spec.pageType);
      if (!Object.prototype.hasOwnProperty.call(info, dflt)) {
        const cleanAny = avail.filter((n) => !(info[n] || {}).degraded);
        dflt = cleanAny.length ? cleanAny[0] : (avail.length ? avail[0] : 0);
      }
      const dfltTxt = Object.prototype.hasOwnProperty.call(info, dflt) ? `; default: proto ${dflt} (pageType-матч)` : "";
      failures.push({
        page: item.file,
        ...(Object.prototype.hasOwnProperty.call(info, dflt) ? { action: `proto→${dflt}` } : {}),
        msg: `[HARD] прототип ${proto} недоступен: такого proto в атласе нет (витрина или несуществующий слайд); доступные proto: ${avail.join(", ")} — укажите proto из списка (типы — в ${toc} «## Contents»)${dfltTxt}`,
      });
      continue;
    }
    const d = info[proto].degraded;
    if (d) {
      const clean = avail.filter((n) => n !== proto && (info[n] || {}).arch === (info[proto] || {}).arch && !(info[n] || {}).degraded);
      const others = clean.length > 1 ? `; другие: ${clean.slice(1).join(", ")}` : "";
      const hint = clean.length ? `; default: proto ${clean[0]} (чистый, тот же архетип${others})` : "";
      failures.push({
        page: item.file,
        ...(clean.length ? { action: `proto→${clean[0]}` } : {}),
        msg: `[HARD] прототип ${proto} degraded (нераспознано: ${d.map((u) => (u || {}).kind || "?").join(", ")})${hint}`,
      });
      continue;
    }
    out.push({ file: item.file, page: item, proto, how });
  }
  return [out, failures];
}

module.exports = { atlasArchKey, pagesProtoInfo, resolveProtos };
