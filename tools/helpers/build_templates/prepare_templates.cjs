// prepare_templates.cjs — подготовка шаблонов скилла (порт prepare_templates.py v3.2.1).
'use strict';
const fs = require("fs");
const path = require("path");
const unpackCli = require("../unpack/cli.cjs");
const { pyJsonDumps, pyRound } = require("../numfmt.cjs");
const { typicalExample, dumpExampleLines } = require("../typical.cjs");
const labels = require("./labels.cjs");
const { cluster, iconSvg, slideShapes } = require("./picto_svg.cjs");
const { Package, RT } = require("../builder/opc.cjs");
const { El } = require("../xml.cjs");
const { findL } = require("../builder/xmlbuild.cjs");

const { KEEP_SLIDES, SLIDE_KIND, DARK_KEEP, LIGHT_KEEP, LIGHT_RENAME, LABELS,
        MEDIA_LABELS, REJECTS_MEDIA, PICTO_KEEP, PICTO_LABELS, PICTOGRAM_TITLE, TYPICAL_SLIDES } = labels;

const SKILL = path.resolve(__dirname, "..", "..", "..");
const THEMES = ["dark", "light"];
const SHARED = path.join(SKILL, "templates", "default-ref");
const FAMILY_ORDER = ["icons3d", "illustrations", "blobs", "other"];
const FAMILY_TITLES = {
  icons3d: "3D icons",
  illustrations: "Illustrations",
  blobs: "Decor blobs/rings (background)",
  other: "Other",
};
const CLUSTER_PAD_EMU = 50000;

function ensureUnpack(theme, force) {
  const pptx = path.join(SKILL, "templates", `default_${theme}.pptx`);
  const ref = path.join(SKILL, "templates", `default_${theme}-ref`);
  const src = path.join(ref, "_source.json");
  let fresh = false;
  if (fs.existsSync(src)) {
    try {
      fresh = JSON.parse(fs.readFileSync(src, "utf8")).bytes === fs.statSync(pptx).size;
    } catch { fresh = false; }
  }
  if (fresh && !force) {
    console.log(`${theme}: атлас свежий, unpack пропущен`);
    return [ref, pptx];
  }
  // cwd=SKILL: _source.json фиксирует стабильный относительный путь (checkout не пачкается)
  const cwd = process.cwd();
  process.chdir(SKILL);
  try {
    unpackCli.run([pptx, "--out", ref, "--with-pages", "--no-decor-thumbs"]);
  } finally {
    process.chdir(cwd);
  }
  return [ref, pptx];
}

function _mediaMap(ref) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ref, "media-map.json"), "utf8")).files || {};
  } catch {
    return {};
  }
}

function purgeRejects(theme, ref) {
  const keep = theme === "dark" ? DARK_KEEP : LIGHT_KEEP;
  const rejects = new Set(REJECTS_MEDIA[theme] || []);
  for (const [fname, e] of Object.entries(_mediaMap(ref))) {
    if (e.class === "decor" && !keep.includes(fname)) rejects.add(fname);
  }
  for (const fname of rejects) {
    const name = fname.startsWith("media/") ? fname.slice(6) : fname;
    for (const d of [path.join(ref, "media"), ...FAMILY_ORDER.map((f) => path.join(ref, "decor", f))]) {
      const p = path.join(d, name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
}

function layoutSharedDecor(refs) {
  const decorDir = path.join(SHARED, "decor");
  fs.mkdirSync(decorDir, { recursive: true });
  const rows = Object.fromEntries(FAMILY_ORDER.map((f) => [f, []]));
  const missing = [];

  const place = (src, dstName, w, h) => {
    const ld = LABELS[dstName];
    const family = ld ? ld[0] : null;
    const desc = ld ? ld[1] : null;
    if (family === null) {
      missing.push(dstName);
      return;
    }
    const famDir = path.join(decorDir, family);
    fs.mkdirSync(famDir, { recursive: true });
    const dstPath = path.join(famDir, dstName);
    if (!fs.existsSync(dstPath)) {
      if (src && fs.existsSync(src)) {
        fs.copyFileSync(src, dstPath);
      } else {
        missing.push(dstName + " (нет файла)");
        return;
      }
    }
    rows[family].push([dstName, w, h, desc]);
  };

  const darkMm = _mediaMap(refs.dark[0]);
  for (const fname of [...DARK_KEEP].sort((a, b) => parseInt(a.replace(/\D/g, "") || "0", 10) - parseInt(b.replace(/\D/g, "") || "0", 10))) {
    const e = darkMm[fname] || {};
    place(path.join(refs.dark[0], "media", fname), fname, e.width, e.height);
  }
  const lightMm = _mediaMap(refs.light[0]);
  for (const fname of [...LIGHT_KEEP].sort()) {
    const e = lightMm[fname] || {};
    place(path.join(refs.light[0], "media", fname), LIGHT_RENAME[fname] || fname, e.width, e.height);
  }
  const valid = new Set();
  for (const fam of FAMILY_ORDER) for (const [f] of rows[fam]) valid.add(`${fam}/${f}`);
  for (const fam of FAMILY_ORDER) {
    const famDir = path.join(decorDir, fam);
    if (!fs.existsSync(famDir)) continue;
    for (const f of fs.readdirSync(famDir)) {
      const rel = `${fam}/${f}`;
      if (!valid.has(rel)) fs.unlinkSync(path.join(famDir, f));
    }
    if (fs.readdirSync(famDir).length === 0) fs.rmdirSync(famDir);
  }
  if (missing.length) console.log(`  WARN: нет разметки/файла: ${missing.join(" ")}`);
  return rows;
}

// picto-index.json — кеш pictogram metadata: pages/ удаляются в конце прогона,
// повторный запуск (fresh atlas, unpack пропущен) читает кеш, CATALOG не теряется.
function pictoIndexPath() {
  return path.join(SHARED, "decor", "pictograms", "picto-index.json");
}

function loadPictoIndex() {
  try { return JSON.parse(fs.readFileSync(pictoIndexPath(), "utf8")); } catch { return null; }
}

function pictogramPages(ref) {
  const pages = [];
  const pagesDir = path.join(ref, "pages");
  if (!fs.existsSync(pagesDir)) {
    const cached = loadPictoIndex();
    return cached && Array.isArray(cached.pages) ? cached.pages : [];
  }
  for (const p of fs.readdirSync(pagesDir).filter((f) => /^slide-\d+\.json$/.test(f)).sort()) {
    let d;
    try {
      d = JSON.parse(fs.readFileSync(path.join(pagesDir, p), "utf8"));
    } catch { continue; }
    for (const e of d.elements || []) {
      if (e.type !== "text") continue;
      const txt = (e.paragraphs || []).map((para) => (para.runs || []).map((r) => r.text || "").join("")).join(" ");
      if (txt.includes(PICTOGRAM_TITLE)) {
        pages.push(parseInt(p.slice(6, 8), 10));
        break;
      }
    }
  }
  return pages;
}

function extractPictograms(ref, pptx, pgPages) {
  const pictoDir = path.join(SHARED, "decor", "pictograms");
  fs.mkdirSync(pictoDir, { recursive: true });
  // pages/ уже удалены прошлым прогоном → extraction невозможен: берём кеш
  if (!fs.existsSync(path.join(ref, "pages"))) {
    const cached = loadPictoIndex();
    if (cached && Array.isArray(cached.rows)) return cached.rows;
  }
  for (const stale of fs.readdirSync(pictoDir).filter((f) => /^picto-.*\.svg$/.test(f))) {
    if (!PICTO_KEEP.includes(stale.slice(0, -4))) fs.unlinkSync(path.join(pictoDir, stale));
  }
  const todo = [];
  for (const page of pgPages) {
    const prefix = `picto-${String(page).padStart(2, "0")}-`;
    const want = new Set(PICTO_KEEP.filter((s) => s.startsWith(prefix)));
    const have = new Set(fs.readdirSync(pictoDir).filter((f) => f.startsWith(prefix)).map((f) => f.slice(0, -4)));
    const missing = [...want].filter((w) => !have.has(w));
    if (missing.length) todo.push(page);
  }
  for (const page of todo) {
    const shapes = slideShapes(pptx, page);
    const icons = cluster(shapes, CLUSTER_PAD_EMU);
    let n = 0;
    for (let i = 0; i < icons.length; i++) {
      const [box, idxs] = icons[i];
      const stem = `picto-${String(page).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`;
      if (!PICTO_KEEP.includes(stem)) continue;
      fs.writeFileSync(path.join(pictoDir, stem + ".svg"), iconSvg(shapes, idxs, box));
      n += 1;
    }
    console.log(`  slide ${page}: извлечено ${n} пиктограмм (svg)`);
  }
  const rows = [];
  for (const f of fs.readdirSync(pictoDir).filter((x) => /^picto-.*\.svg$/.test(x)).sort()) {
    const stem = f.slice(0, -4);
    const svg = fs.readFileSync(path.join(pictoDir, f), "utf8");
    const m = /width="(\d+)" height="(\d+)"/.exec(svg);
    const [w, h] = m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [null, null];
    rows.push([stem + ".svg", w, h, PICTO_LABELS[stem] || ""]);
  }
  // кеш для повторных прогонов (pages/ удаляются в конце main)
  if (fs.existsSync(path.join(ref, "pages"))) {
    fs.writeFileSync(pictoIndexPath(), JSON.stringify({ pages: pgPages, rows }, null, 1) + "\n");
  }
  return rows;
}

function writeCatalog(rows, pgPages, pictoRows) {
  const totalDecor = Object.values(rows).reduce((s, v) => s + v.length, 0) + pictoRows.length;
  const lines = [`# Decor of the SU-2026 templates (shared by dark and light) — ${totalDecor} files`, "",
    "Files live in `decor/<family>/`. Copy the ones you need into your project's",
    "`media/` (renaming is fine) and reference them from image elements. The",
    "descriptions and px sizes below are final — files are never opened one by one.", ""];
  for (const fam of FAMILY_ORDER) {
    if (!rows[fam].length) continue;
    lines.push(`## ${FAMILY_TITLES[fam]} (${rows[fam].length}) — \`decor/${fam}/\``, "", "| file | px | description |", "|---|---|---|");
    for (const [fname, w, h, desc] of rows[fam]) {
      lines.push(`| ${fname} | ${w || "?"}×${h || "?"} | ${desc || "—"} |`);
    }
    lines.push("");
  }
  if (pgPages.length) {
    const nums = pgPages.join(", ");
    lines.push(`## Pictograms (${pictoRows.length}) — \`decor/pictograms/\``, "",
      `Vector icons (SVG) extracted from shapes on source slides ${nums}`,
      "of the template. Color is set by build: the icon is recolored to the",
      "antonym of the page's effective background (light icon on dark, dark on light).",
      "Reference `picto-NN-MMM.svg` as an image element — build embeds the",
      "icon as NATIVE vector shapes (recolorable in PowerPoint).",
      "Copy only the .svg into your project media/. Preview: open the file;",
      "choose by the descriptions below.", "");
    if (pictoRows.length) {
      lines.push("| file | px | description |", "|---|---|---|");
      for (const [fname, w, h, desc] of pictoRows) {
        lines.push(`| ${fname} | ${w || "?"}×${h || "?"} | ${desc || "—"} |`);
      }
      lines.push("");
    } else {
      lines.push("(не извлечены)", "");
    }
  }
  fs.writeFileSync(path.join(SHARED, "decor", "CATALOG.md"), lines.join("\n"));
}

function _layoutInfo(pptx) {
  const pkg = Package.load(fs.readFileSync(pptx));
  const EMU = 9525.0;
  const layouts = {};
  const pres = pkg.parts.get("/ppt/presentation.xml");
  // masters → layouts
  for (const part of pkg.parts.values()) {
    if (!/slideLayouts\/slideLayout\d+\.xml$/.test(part.partname)) continue;
    const stem = part.partname.split("/").pop().replace(".xml", "");
    let bg = null, zone = null;
    const spTree = findL(findL(part.xmlEl, "cSld"), "spTree");
    if (spTree) {
      for (const sh of spTree.children) {
        if (!(sh instanceof El) || sh.local !== "pic") continue;
        const spPr = findL(sh, "spPr");
        const xf = spPr ? findL(spPr, "xfrm") : null;
        if (!xf) continue;
        const off = findL(xf, "off"), ext = findL(xf, "ext");
        if (!off || !ext) continue;
        const x = parseFloat(off.attrs.get("x")) / EMU, y = parseFloat(off.attrs.get("y")) / EMU;
        const w = parseFloat(ext.attrs.get("cx")) / EMU, h = parseFloat(ext.attrs.get("cy")) / EMU;
        // pic_media_name
        const blipFill = findL(sh, "blipFill");
        const blip = blipFill ? findL(blipFill, "blip") : null;
        const rid = blip ? (blip.attrs.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed") || blip.attrs.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}link")) : null;
        const rel = rid ? part.rels.get(rid) : null;
        const name = rel ? rel.target.split("/").pop() : null;
        if (w >= 0.95 * 1280 && h >= 0.95 * 720 && x <= 5 && y <= 5) {
          if (bg === null) bg = name;
        } else if (w <= 400 && h <= 120 && y <= 120 && name) {
          if (zone === null) zone = [pyRound(x), pyRound(y), pyRound(w), pyRound(h)];
        }
      }
    }
    layouts[stem] = { bg, zone };
  }
  const slide2layout = {};
  const sldIdLst = (() => { for (const n of pres.xmlEl.iter()) if (n.local === "sldIdLst") return n; return null; })();
  let slideNo = 0;
  for (const c of sldIdLst.children) {
    if (!(c instanceof El) || c.local !== "sldId") continue;
    slideNo++;
    const rid = c.attrs.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id");
    const rel = pres.rels.get(rid);
    const slidePart = rel ? pkg.parts.get(rel.target) : null;
    const lRel = slidePart ? slidePart.rels.findByReltype("slideLayout") : null;
    const layoutPart = lRel ? pkg.parts.get(lRel.target) : null;
    if (layoutPart) slide2layout[slideNo] = layoutPart.partname.split("/").pop().replace(".xml", "");
  }
  return [slide2layout, layouts];
}

function collapseShots(theme, ref) {
  const existing = () => fs.readdirSync(SHARED).some((f) => f.startsWith(`protos-${theme}`) && f.endsWith(".png"));
  const shotsDir = path.join(ref, "shots");
  if (!fs.existsSync(shotsDir)) return existing();
  const { natKeyCmp, natKey, thumbsFromShots } = require("../render.cjs");
  const shots = fs.readdirSync(shotsDir).filter((f) => f.endsWith(".png"))
    .map((f) => path.join(shotsDir, f))
    .sort((a, b) => natKeyCmp(natKey(a), natKey(b)));
  const keep = KEEP_SLIDES[theme] || [];
  const keepSet = new Set(keep);
  const kept = shots.filter((s, i) => keepSet.has(i + 1));
  let created = false;
  if (keep.length > 0 && kept.length === keep.length) {
    // сначала replacements; старые sheets удаляются только после успешного создания
    const names = thumbsFromShots(kept, ref);
    for (const old of fs.readdirSync(SHARED).filter((f) => f.startsWith(`protos-${theme}`) && f.endsWith(".png"))) {
      fs.unlinkSync(path.join(SHARED, old));
    }
    names.forEach((nm, i) => {
      const suffix = i === 0 ? "" : `-${i + 1}`;
      fs.renameSync(path.join(ref, nm), path.join(SHARED, `protos-${theme}${suffix}.png`));
    });
    created = true;
  }
  fs.rmSync(shotsDir, { recursive: true, force: true });
  // пустые/неполные shots → прежние sheets и ссылки в slides.md сохраняются
  return created || existing();
}

function dropPages(ref) {
  fs.rmSync(path.join(ref, "pages"), { recursive: true, force: true });
}

function _autoProto(theme, ref) {
  const keep = KEEP_SLIDES[theme] || [];
  const kinds = SLIDE_KIND[theme] || {};
  const firstKind = (...ks) => keep.find((n) => ks.includes(kinds[n])) ?? null;
  const firstEl = (t) => {
    for (const n of keep) {
      let p;
      try {
        p = JSON.parse(fs.readFileSync(path.join(ref, "pages", `slide-${String(n).padStart(2, "0")}.json`), "utf8"));
      } catch { continue; }
      if ((p.elements || []).some((e) => e.type === t)) return n;
    }
    return null;
  };
  const byPt = {
    cover: firstKind("cover"),
    divider: firstKind("divider"),
    content: firstKind("text", "section", "data", "cards-3", "cards-4", "quote", "photo", "stat", "team"),
    closing: firstKind("closing") || (keep.length ? keep[keep.length - 1] : null),
  };
  return {
    byPageType: Object.fromEntries(Object.entries(byPt).filter(([, v]) => v)),
    table: firstEl("table"),
    chart: firstEl("chart"),
  };
}

function _protoMeta(theme, ref, layouts, slide2layout) {
  const keep = KEEP_SLIDES[theme] || [];
  const meta = {}, zones = {}, tc = {};
  for (const sn of keep) {
    const lay = layouts[slide2layout[sn]] || {};
    zones[String(sn)] = lay.zone ?? null;
    const m = { arch: lay.bg || "solid", degraded: null, table: false, chart: false };
    try {
      const p = JSON.parse(fs.readFileSync(path.join(ref, "pages", `slide-${String(sn).padStart(2, "0")}.json`), "utf8"));
      const types = new Set((p.elements || []).map((e) => e.type));
      const un = (p.coverageReport || {}).unrecognized;
      m.degraded = Array.isArray(un) && un.length ? un : null;
      m.table = types.has("table");
      m.chart = types.has("chart");
      tc[String(sn)] = ["table", "chart"].filter((c) => types.has(c)).map((c) => c === "table" ? "T" : "C").join("/");
    } catch { /* pass */ }
    meta[String(sn)] = m;
  }
  return [meta, zones, tc];
}

function writeTemplateJson(theme, ref, pptx) {
  const [slide2layout, layouts] = _layoutInfo(pptx);
  let [meta, zones, tc] = _protoMeta(theme, ref, layouts, slide2layout);
  const tplPath = path.join(ref, "template.json");
  let oldTemplate = null;
  if (fs.existsSync(tplPath)) {
    try {
      oldTemplate = JSON.parse(fs.readFileSync(tplPath, "utf8"));
    } catch { oldTemplate = null; }
  }
  const stPath = path.join(ref, "style.json");
  let styleJson, fontsJson;
  if (fs.existsSync(stPath)) {
    styleJson = JSON.parse(fs.readFileSync(stPath, "utf8"));
    fontsJson = JSON.parse(fs.readFileSync(path.join(ref, "fonts.json"), "utf8"));
  } else {
    styleJson = oldTemplate.style;
    fontsJson = oldTemplate.fonts;
  }
  let auto;
  if (!fs.existsSync(path.join(ref, "pages")) && oldTemplate) {
    meta = oldTemplate.protoMeta || meta;
    auto = oldTemplate.autoProto || _autoProto(theme, ref);
  } else {
    auto = _autoProto(theme, ref);
  }
  const template = {
    theme, source: `default_${theme}.pptx`,
    protoSlides: KEEP_SLIDES[theme] || [], autoProto: auto,
    branding: { slides: zones }, protoMeta: meta,
    style: styleJson, fonts: fontsJson,
  };
  fs.writeFileSync(tplPath, pyJsonDumps(template, 1));
  for (const stale of ["branding.json", "style.json", "fonts.json"]) {
    const p = path.join(ref, stale);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  if (!Object.keys(tc).length) {
    tc = Object.fromEntries(Object.keys(meta).map((k) => [k, [["T", "table"], ["C", "chart"]].filter(([, c]) => (meta[k] || {})[c]).map(([t]) => t).join("/")]));
  }
  return [meta, zones, tc];
}

function _styleSection(ref) {
  const mdFile = path.join(ref, "STYLE.md");
  if (!fs.existsSync(mdFile)) return "";
  const src = fs.readFileSync(mdFile, "utf8");
  const m = /(## Style\n[\s\S]*?)(?=\n## |$)/.exec(src + "\n");
  return m ? m[1].replace(/\s+$/, "").slice("## Style\n".length).trim() : "";
}

function _decorRel(basename) {
  const decorDir = path.join(SHARED, "decor");
  for (const fam of fs.readdirSync(decorDir)) {
    const famDir = path.join(decorDir, fam);
    if (fs.statSync(famDir).isDirectory() && fs.existsSync(path.join(famDir, basename))) {
      return `decor/${fam}/${basename}`;
    }
  }
  return null;
}

function buildTypicalLines(theme, ref) {
  const mediaClass = Object.fromEntries(Object.entries(_mediaMap(ref)).map(([n, e]) => [n, e.class]));
  const pagesDir = path.join(ref, "pages");
  const examples = [];
  for (const [sn, caption] of TYPICAL_SLIDES[theme] || []) {
    const pagePath = path.join(pagesDir, `slide-${String(sn).padStart(2, "0")}.json`);
    if (fs.existsSync(pagePath)) {
      const page = JSON.parse(fs.readFileSync(pagePath, "utf8"));
      const kind = (SLIDE_KIND[theme] || {})[sn] || "";
      const ptype = { cover: "cover", divider: "divider", closing: "closing" }[kind] || "content";
      examples.push([sn, caption, typicalExample(page, ptype, sn, mediaClass, _decorRel)]);
    }
  }
  if (!examples.length) {
    const prev = path.join(SHARED, "slides.md");
    const src = fs.existsSync(prev) ? fs.readFileSync(prev, "utf8") : "";
    const m = /^(## Типовые слайды[^\n]*\n[\s\S]*?)(?=\n## |(?![\s\S]))/m.exec(src + "\n");
    return m ? [...m[1].replace(/\s+$/, "").split("\n"), ""] : [];
  }
  const lines = [
    "## Типовые слайды — эталоны стиля и размещения декора",
    "",
    "Реальная геометрия шаблона (общая для обеих тем — примеры собраны на",
    "dark; цвета и фон берите из «## Цвета и фоны» вашей темы). Это эталоны",
    "СТИЛЯ и размещения декора: контент — ваш; композицию можно адаптировать",
    "под контент (check подтвердит вместимость), но позиции декора держите",
    "как здесь. Копия 1:1 с чужими текстами — плохо; повторное размещение — норма.",
    "Номера proto — из таблицы вашей темы (порядок типов совпадает).",
    "",
    "Правила декора, видимые в примерах:",
    "- логотип SberUser всегда левый верхний угол — декор и текст его не перекрывают;",
    "- кольцо/тор (`decor/blobs/…`) — в углу, обрезано краем; на обложке и финале — крупное;",
    "- блобы/свечения — по краям и углам, полупрозрачные, не за текстом и не в центре;",
    "- крупные 3D-объекты (звезда, сердца, робот) — только обложка/разделители/финал, правая половина;",
    "- пиктограммы — только в мелких бейджах слева от текста (32–64px), одним стилем на слайд;",
    "- мелкие акценты (точки/звёздочки) — 1–3 шт рядом с крупным декором;",
    "- файлы каталога — всегда декор, никогда не главный визуал слайда.",
    "",
  ];
  for (const [sn, caption, ex] of examples) {
    lines.push(`### proto ${sn} — ${caption}`, "```json", ...dumpExampleLines(ex), "```", "");
  }
  return lines;
}

function _contentsRows(theme, meta, zones, tc) {
  const kinds = SLIDE_KIND[theme] || {};
  const rows = [];
  for (const sn of KEEP_SLIDES[theme] || []) {
    const zone = zones[String(sn)];
    const zc = zone ? `[${zone[0]},${zone[1]}]` : "";
    rows.push(`| ${sn} | ${kinds[sn] || "?"} | ${zc} | ${tc[String(sn)] || ""} |`);
  }
  return rows;
}

function _colorsLines(theme, meta, zones, styleStats) {
  const ru = theme === "dark" ? "Тёмная" : "Светлая";
  const mlabels = MEDIA_LABELS[theme] || {};
  const lines = [`### ${ru} тема (--theme ${theme})`, ""];
  if (styleStats) lines.push(styleStats, "");
  lines.push("Фоны прототипов (унаследованный фон; явный `background` страницы его",
    "перекрывает):", "", "| proto | фон |", "|---|---|");
  for (const sn of KEEP_SLIDES[theme] || []) {
    const arch = ((meta[String(sn)] || {}).arch) || "solid";
    const desc = mlabels[arch] || arch;
    lines.push(`| ${sn} | ${desc} |`);
  }
  lines.push("");
  const zoneSlides = (KEEP_SLIDES[theme] || []).filter((sn) => zones[String(sn)]).map((sn) => [sn, zones[String(sn)]]);
  if (zoneSlides.length) {
    const zs = zoneSlides.map(([sn, z]) => `${sn}: [${z[0]},${z[1]}]`).join(", ");
    lines.push("Зона логотипа SberUser (x,y левого верхнего угла, ~150×24px) —",
      `не ставить туда текст и декор: proto ${zs}.`, "");
  }
  return lines;
}

function rewriteSharedSlidesMd(themeData, pgPages, pictoRows, protos) {
  const lines = [
    "# slides.md — шаблоны SU 2026 (dark + light), canvas 1280×720",
    "",
    "The bundled templates are the official Sber design system by the SberUser",
    "department (SU 2026). This atlas is SHARED by both themes — the only",
    "difference is which `--theme dark|light` flag you pass to check/build and",
    "which colors/backgrounds you take (see «## Цвета и фоны»).",
    "",
    "The atlas holds only the proto slides listed below — build rejects any proto",
    "outside the table of YOUR theme. Compose slides by the canonical examples in",
    "«## Типовые слайды» below (see create.md). Decor files live in the shared",
    "`decor/` library (full list: `decor/CATALOG.md`).",
    "",
    "The «logo» column marks the SberUser brand-logo zone on the background",
    "(x,y of the top-left corner, ~150×24px): never place text or elements there.",
  ];
  if (protos.dark || protos.light) {
    const sheets = THEMES.filter((t) => protos[t]).map((t) => `\`protos-${t}.png\``).join(", ");
    lines.push(`Visual proto overview: ${sheets} (one contact sheet per theme).`);
  }
  lines.push("");
  for (const theme of THEMES) {
    const ru = theme === "dark" ? "Тёмная тема" : "Светлая тема";
    lines.push(`## Contents — ${ru} (--theme ${theme})`, "",
      "| # | type | logo | T/C |", "|---|---|---|---|",
      ..._contentsRows(theme, ...themeData[theme].ctz), "");
  }
  lines.push(...buildTypicalLines("dark", themeData.dark.ref));
  lines.push("## Цвета и фоны", "");
  for (const theme of THEMES) {
    const td = themeData[theme];
    lines.push(..._colorsLines(theme, td.meta, td.zones, td.style_stats));
  }
  lines.push("## Decor", "",
    "Decor is sorted by family in `decor/` — full list with px sizes and",
    "descriptions: `decor/CATALOG.md`. Pictograms: `decor/pictograms/picto-*.svg`",
    "(native vector shapes; build recolors them to the background's antonym).",
    "");
  fs.writeFileSync(path.join(SHARED, "slides.md"), lines.join("\n"));
}

function cleanupStale(ref) {
  const decorDir = path.join(ref, "decor");
  if (!fs.existsSync(decorDir)) return;
  for (const pat of [/^contact-.*\.png$/, /^pictograms-\d\d\.png$/, /^picto-.*\.png$/, /^picto-.*\.view\.png$/]) {
    const walkDirs = [decorDir, path.join(decorDir, "pictograms")];
    for (const d of walkDirs) {
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (pat.test(f)) fs.unlinkSync(path.join(d, f));
      }
    }
  }
  for (const f of fs.readdirSync(ref).filter((x) => /^decor-thumbs.*\.png$/.test(x))) {
    fs.unlinkSync(path.join(ref, f));
  }
}

function main() {
  const force = process.argv.includes("--force");
  for (const theme of THEMES) {
    const pptx = path.join(SKILL, "templates", `default_${theme}.pptx`);
    if (!fs.existsSync(pptx)) {
      throw new Error(`обязательный fixture отсутствует: templates/default_${theme}.pptx — prepare невозможен`);
    }
  }
  fs.mkdirSync(SHARED, { recursive: true });
  const themeData = {};
  for (const theme of THEMES) {
    const [ref, pptx] = ensureUnpack(theme, force);
    purgeRejects(theme, ref);
    cleanupStale(ref);
    fs.rmSync(path.join(ref, "decor"), { recursive: true, force: true });
    const p = path.join(ref, "slides.md");
    if (fs.existsSync(p)) fs.unlinkSync(p);
    const [meta, zones, tc] = writeTemplateJson(theme, ref, pptx);
    const protosPng = collapseShots(theme, ref);
    themeData[theme] = {
      ref, pptx, meta, zones, ctz: [meta, zones, tc],
      style_stats: _styleSection(ref), protos_png: protosPng,
    };
  }
  const refs = Object.fromEntries(THEMES.map((t) => [t, [themeData[t].ref, themeData[t].pptx]]));
  const rows = layoutSharedDecor(refs);
  const pgPages = pictogramPages(themeData.dark.ref);
  const pictoRows = extractPictograms(themeData.dark.ref, themeData.dark.pptx, pgPages);
  writeCatalog(rows, pgPages, pictoRows);
  const protos = Object.fromEntries(THEMES.map((t) => [t, themeData[t].protos_png]));
  rewriteSharedSlidesMd(themeData, pgPages, pictoRows, protos);
  for (const theme of THEMES) {
    dropPages(themeData[theme].ref);
  }
  console.log("OK: prepare_templates — общий атлас templates/default-ref/ + машинные default_*-ref/");
  return 0;
}

module.exports = { main };

if (require.main === module) {
  try {
    const code = main();
    process.exit(typeof code === "number" ? code : 0);
  } catch (e) {
    process.stderr.write(String((e && e.stack) || e) + "\n");
    process.exit(1);
  }
}
