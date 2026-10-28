// cli.cjs — unpack: pptx → атлас (порт unpack/cli.py v3.2.1).
'use strict';
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { unzipSync } = require("../../../vendor/fflate/lib/node.cjs");

const { pagesProtoInfo } = require("../builder/proto.cjs");
const { overlapCheck } = require("../builder/overlap.cjs");
const { textfitCheck } = require("../builder/textfit.cjs");
const { bFail, deckCmd } = require("../errors.cjs");
const { pyJsonString, jsNumStr, pyJsonDumps, pyStrNum } = require("../numfmt.cjs");
const { isPyFloat, isPyInt } = require("../jsonpy.cjs");
const { XFORM_ID, parseBgPart, parseElements } = require("./elements.cjs");
const { imageInfo } = require("./image.cjs");
const { UNRENDERABLE, attrsOf, childrenOf, findDesc, jsNum, kidOf, kidsOf, parseRels, parseXml, resolveTarget, tagOf } = require("./ooxml.cjs");
const { parsePhLstStyles, parseTxStyles } = require("./styles.cjs");
const { typicalExample, dumpExampleLines } = require("../typical.cjs");

const USAGE_UNPACK = "usage: deck.cjs unpack <ref.pptx> --out <dir> [--render | --shots <dir>] [--with-pages]";

// --- JS-like JSON dump (порт _dump/_dumps/_dumps_pretty) ---
function _dump(obj, level = 0, indent = null) {
  const pad = indent ? " ".repeat(indent * (level + 1)) : "";
  const padEnd = indent ? " ".repeat(indent * level) : "";
  const kvSep = indent ? ": " : ":";
  const joiner = indent ? ",\n" : ",";
  if (isPyInt(obj)) return obj.token; // Python str(int) — точная запись big int
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    const keys = Object.keys(obj);
    if (!keys.length) return "{}";
    const items = keys.map((k) => pad + pyJsonString(String(k)) + kvSep + _dump(obj[k], level + 1, indent));
    return "{" + (indent ? "\n" : "") + items.join(joiner) + (indent ? "\n" + padEnd : "") + "}";
  }
  if (Array.isArray(obj)) {
    if (!obj.length) return "[]";
    const items = obj.map((v) => pad + _dump(v, level + 1, indent));
    return "[" + (indent ? "\n" : "") + items.join(joiner) + (indent ? "\n" + padEnd : "") + "]";
  }
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "number") return Number.isInteger(obj) ? String(obj) : jsNumStr(obj);
  return pyJsonString(String(obj));
}

function _unwrapPyFloat(o) {
  if (isPyInt(o)) return o; // big int не трогаем: точность в token
  if (isPyFloat(o)) return o.v;
  if (Array.isArray(o)) return o.map(_unwrapPyFloat);
  if (o !== null && typeof o === "object") {
    const out = {};
    for (const [k, v] of Object.entries(o)) out[k] = _unwrapPyFloat(v);
    return out;
  }
  return o;
}
const _dumps = (obj) => _dump(jsNum(_unwrapPyFloat(obj)));
const _dumpsPretty = (obj) => _dump(jsNum(_unwrapPyFloat(obj)), 0, 2);

function _jsKey(k) {
  return (typeof k === "number" && Number.isInteger(k)) ? String(Math.trunc(k)) : String(k);
}

function _jsObjOrder(pairs) {
  const ints = [];
  const rest = [];
  for (let [k, v] of pairs) {
    const s = String(k);
    if (/^\d+$/.test(s)) {
      const i = parseInt(s, 10);
      if (i >= 0 && i < 2 ** 32 - 1 && String(i) === s) {
        ints.push([i, v]);
        continue;
      }
    }
    rest.push([String(k), v]);
  }
  ints.sort((a, b) => a[0] - b[0]);
  return [...ints.map(([i, v]) => [String(i), v]), ...rest];
}

const _sortedHist = (d) => (d instanceof Map ? [...d.entries()] : Object.entries(d)).sort((a, b) => b[1] - a[1]);

function run(args) {
  const inFile = args.length ? args[0] : null;
  const opt = (n, d = null) => args.includes(n) ? args[args.indexOf(n) + 1] : d;
  const outDir = opt("--out") ? path.resolve(opt("--out")) : null;
  const doRender = args.includes("--render") ||
    (!args.includes("--shots") && !!(process.env.GIGATOOL_NODE || process.env.MULTITOOL_NODE));
  const withPages = args.includes("--with-pages");
  const noDecorThumbs = args.includes("--no-decor-thumbs");
  const shotsDir = opt("--shots") ? path.resolve(opt("--shots")) : null;
  if (!inFile || !outDir) {
    bFail(2, { error: USAGE_UNPACK, suggestion: deckCmd("unpack", "<ref.pptx>", "--out", "<name>-ref") });
  }
  if (doRender && shotsDir) {
    bFail(2, { error: "--render и --shots взаимоисключающи", suggestion: "--render: unpack сам вызывает --pptx-verify приложения; --shots: шоты уже готовы" });
  }
  if (!fs.existsSync(inFile)) {
    bFail(2, { error: `file not found: ${inFile}`, suggestion: "проверьте путь к pptx" });
  }

  let parts;
  try {
    parts = unzipSync(new Uint8Array(fs.readFileSync(inFile)));
  } catch {
    bFail(2, { error: `не pptx или файл повреждён: ${inFile}`,
               suggestion: "нужен читаемый .pptx/.zip; проверьте файл и повторите" });
  }
  const names = Object.keys(parts);
  const namesSet = new Set(names);
  const partRead = (p) => (namesSet.has(p) ? Buffer.from(parts[p]) : null);

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, "media"), { recursive: true });
  for (const stale of [path.join(outDir, "atlas.json"), path.join(outDir, "media", "manifest.json")]) {
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }

  // --- тема + clrMap ---
  const masterPaths = names.filter((n) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(n)).sort();
  const master1 = masterPaths.length ? partRead(masterPaths[0]) : null;
  const master1Root = master1 ? parseXml(master1) : null;
  const clrMapNode = master1Root !== null ? findDesc(master1Root, "p:clrMap") : null;
  const clrMap = {};
  if (clrMapNode !== null) {
    const a = attrsOf(clrMapNode);
    for (const [k, v] of Object.entries(a)) clrMap[k] = v;
    clrMap.tx1 = a.tx1 || "dk1";
    clrMap.tx2 = a.tx2 || "dk2";
    clrMap.bg1 = a.bg1 || "lt1";
    clrMap.bg2 = a.bg2 || "lt2";
  }
  let themePath = null;
  const masterRelsPath = masterPaths.length
    ? path.posix.dirname(masterPaths[0]) + "/_rels/" + path.posix.basename(masterPaths[0]) + ".rels" : null;
  if (masterRelsPath && partRead(masterRelsPath)) {
    const mr = parseRels(partRead(masterRelsPath));
    const tRel = Object.values(mr).find((r) => (r.Type || "").includes("/theme"));
    if (tRel) themePath = resolveTarget(path.posix.dirname(masterPaths[0]), tRel.Target);
  }
  if (!themePath) {
    themePath = names.find((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n)) || null;
  }
  const theme = {};
  const themeFonts = { major: null, minor: null };
  if (themePath) {
    const themeRoot = parseXml(partRead(themePath));
    const scheme = findDesc(themeRoot, "a:clrScheme");
    if (scheme !== null) {
      for (const c of childrenOf(scheme)) {
        const name = (tagOf(c) || "").replace(/^a:/, "");
        const srgb = kidOf(c, "a:srgbClr");
        const sys_ = kidOf(c, "a:sysClr");
        const v = srgb !== null ? attrsOf(srgb).val : (sys_ !== null ? attrsOf(sys_).lastClr : null);
        if (v && /^[0-9A-Fa-f]{6}$/.test(v)) theme[name] = v.toUpperCase();
      }
    }
    const mj = kidOf(findDesc(themeRoot, "a:majorFont"), "a:latin");
    const mn = kidOf(findDesc(themeRoot, "a:minorFont"), "a:latin");
    themeFonts.major = mj !== null ? attrsOf(mj).typeface : null;
    themeFonts.minor = mn !== null ? attrsOf(mn).typeface : null;
  }
  const txStyles = parseTxStyles(master1Root);
  const masterPh = parsePhLstStyles(master1Root);

  // --- размер и порядок слайдов ---
  if (!namesSet.has("ppt/presentation.xml")) {
    bFail(2, { error: `не похоже на pptx (нет ppt/presentation.xml): ${inFile}`,
               suggestion: "нужен читаемый .pptx; проверьте файл и повторите" });
  }
  const presRoot = parseXml(partRead("ppt/presentation.xml"));
  const presRels = parseRels(partRead("ppt/_rels/presentation.xml.rels"));
  const sldSzNode = findDesc(presRoot, "p:sldSz");
  const sldSzA = sldSzNode !== null ? attrsOf(sldSzNode) : { cx: "12192000", cy: "6858000" };
  const sldSz = { cx: parseFloat(sldSzA.cx), cy: parseFloat(sldSzA.cy) };
  const scale = { kx: 1280 / sldSz.cx, ky: 720 / sldSz.cy };
  const sldIdLst = findDesc(presRoot, "p:sldIdLst");
  const slideOrder = [];
  for (const s of kidsOf(sldIdLst, "p:sldId")) {
    const rel = presRels[attrsOf(s)["r:id"] || ""];
    const p = resolveTarget("ppt", rel ? rel.Target : "");
    if (namesSet.has(p)) slideOrder.push(p);
  }

  // --- медиа: извлечение бит-в-бит + инфо ---
  const mediaFiles = names.filter((n) => n.startsWith("ppt/media/") && !n.endsWith("/"));
  const mediaMap = {};
  for (const mPath of mediaFiles) {
    const data = Buffer.from(parts[mPath]);
    const base = path.posix.basename(mPath);
    const ext = base.includes(".") ? base.split(".").pop().toLowerCase() : "";
    fs.writeFileSync(path.join(outDir, "media", base), data);
    const entry = { ...imageInfo(data, ext) };
    entry.md5 = crypto.createHash("md5").update(data).digest("hex");
    entry.bytes = data.length;
    entry.class = UNRENDERABLE.has(ext) ? "unrenderable" : null;
    entry.usedBy = [];
    mediaMap[base] = entry;
  }

  // --- цепочки layout/master ---
  const layoutSlides = {};
  const partCache = {};
  const cachedRead = (p) => {
    if (!(p in partCache)) partCache[p] = partRead(p);
    return partCache[p];
  };
  const nodeCache = {};
  const partNode = (p) => {
    if (!(p in nodeCache)) {
      const data = cachedRead(p);
      nodeCache[p] = data !== null ? parseXml(data) : null;
    }
    return nodeCache[p];
  };
  const partRelsFn = (p) => {
    const rp = path.posix.dirname(p) + "/_rels/" + path.posix.basename(p) + ".rels";
    const data = partRead(rp);
    return data ? parseRels(data) : {};
  };
  const layoutOfSlide = (sp) => {
    const r = Object.values(partRelsFn(sp)).find((x) => (x.Type || "").includes("slideLayout"));
    return r ? resolveTarget(path.posix.dirname(sp), r.Target) : null;
  };
  const masterOfLayout = (lp) => {
    const r = Object.values(partRelsFn(lp)).find((x) => (x.Type || "").includes("slideMaster"));
    return r ? resolveTarget(path.posix.dirname(lp), r.Target) : null;
  };

  const mediaUsage = [];
  const counters = { fonts: {}, sizes: new Map(), colors: {}, fills: {}, gradients: {} };

  // --- слайды ---
  const pages = [];
  const mdSections = [];
  for (let idx = 0; idx < slideOrder.length; idx++) {
    const slidePath = slideOrder[idx];
    const n = idx + 1;
    const rels = partRelsFn(slidePath);
    const partDir = path.posix.dirname(slidePath);
    const layoutPath = layoutOfSlide(slidePath);
    if (layoutPath) {
      (layoutSlides[layoutPath] = layoutSlides[layoutPath] || []).push(n);
    }

    let bg = parseBgPart(partNode(slidePath), rels, partDir);
    let bgSource = bg ? "slide" : null;
    if (!bg && layoutPath) {
      bg = parseBgPart(partNode(layoutPath), partRelsFn(layoutPath), path.posix.dirname(layoutPath));
      if (bg) bgSource = "layout";
    }
    if (!bg && layoutPath) {
      const mp = masterOfLayout(layoutPath);
      if (mp) {
        bg = parseBgPart(partNode(mp), partRelsFn(mp), path.posix.dirname(mp));
        if (bg) bgSource = "master";
      }
    }
    if (bg && bg.media) {
      mediaUsage.push({ media: bg.media, slide: n, part: slidePath, role: "background",
                        via: bgSource === "slide" ? "p:bg" : `p:bg ← ${bgSource}` });
    }

    const usageBefore = mediaUsage.length;
    const spTree = findDesc(partNode(slidePath), "p:spTree");
    const layoutPh = layoutPath ? parsePhLstStyles(partNode(layoutPath)) : {};
    const ctx = { clrMap, theme, themeFonts, txStyles, masterPh, layoutPh,
                  tableChain: [txStyles.otherStyle], rels, partNode };
    const res = parseElements(spTree, XFORM_ID, scale, rels, partDir, ctx, counters, mediaUsage, n, slidePath);
    const elements = res.elements;
    const coverageReport = { recognized: res.recognized, unrecognized: res.unrecognized };

    let bgPicIdx = -1;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (bgPicIdx >= 0 || el.type !== "image" || !el.bounds || !el.src) continue;
      const [x, y, w, h] = el.bounds;
      if (x <= 8 && y <= 8 && w >= 1280 * 0.95 && h >= 720 * 0.95) bgPicIdx = i;
    }
    if (bgPicIdx >= 0) {
      const u = mediaUsage.slice(usageBefore).find((uu) =>
        uu.media === elements[bgPicIdx].src && uu.slide === n &&
        JSON.stringify(uu.bounds) === JSON.stringify(elements[bgPicIdx].bounds));
      if (u) u.role = "background";
    }

    pages.push({
      slide: n, part: slidePath,
      background: (bg ? { ...bg, source: bgSource }
                  : bgPicIdx >= 0 ? { type: "image", media: elements[bgPicIdx].src, source: "full-bleed pic" }
                  : { type: "none" }),
      coverageReport,
      elements,
    });

    const bgStr = bg
      ? `${bg.type}${bg.media ? " " + bg.media : ""}${bg.color ? " " + bg.color : ""} (${bgSource})`
      : bgPicIdx >= 0 ? `image ${elements[bgPicIdx].src} (full-bleed pic)` : "нет (белый)";
    mdSections.push({ n, slidePath, bgStr, coverageReport, elements });
  }

  // --- usage из layout/master ---
  const seenParts = new Set();
  for (const [layoutPath, slides] of Object.entries(layoutSlides)) {
    for (const partPath of [layoutPath, masterOfLayout(layoutPath)].filter(Boolean)) {
      if (seenParts.has(partPath)) continue;
      seenParts.add(partPath);
      if (cachedRead(partPath) === null) continue;
      const rels = partRelsFn(partPath);
      const partDir = path.posix.dirname(partPath);
      const usageBefore = mediaUsage.length;
      const spTree = findDesc(partNode(partPath), "p:spTree");
      parseElements(spTree, XFORM_ID, scale, rels, partDir,
                    { clrMap, theme, themeFonts, txStyles, masterPh, layoutPh: {}, rels, partNode },
                    { fonts: {}, sizes: new Map(), colors: {}, fills: {}, gradients: {} },
                    mediaUsage, null, partPath);
      const allSlides = [];
      for (const sl of Object.values(layoutSlides)) {
        for (const s of sl) {
          if (!allSlides.includes(s)) allSlides.push(s);
        }
      }
      for (let i = usageBefore; i < mediaUsage.length; i++) {
        mediaUsage[i].slides = partPath === layoutPath ? slides : [...allSlides];
        const b = mediaUsage[i].bounds;
        if (b && b[0] <= 8 && b[1] <= 8 && b[2] >= 1280 * 0.95 && b[3] >= 720 * 0.95) {
          mediaUsage[i].role = "background";
        }
      }
    }
  }
  for (const u of mediaUsage) {
    const e = mediaMap[u.media];
    if (!e) continue;
    const entry = {};
    if (u.slide !== null && u.slide !== undefined) entry.slide = u.slide;
    entry.part = u.part;
    entry.role = u.role;
    if (u.slides) entry.slides = u.slides;
    if (u.via) entry.via = u.via;
    e.usedBy.push(entry);
  }

  // --- классификация ---
  for (const e of Object.values(mediaMap)) {
    if (e.class === "unrenderable") {
      if (!e.usedBy.length) e.orphan = true;
      continue;
    }
    if (e.usedBy.some((u) => u.role === "background")) {
      e.class = "background";
    } else if (e.alpha) {
      e.class = "decor";
    } else {
      e.class = "content";
    }
    if (!e.usedBy.length) e.orphan = true;
  }

  // --- факт-поля image-элементов ---
  for (const page of pages) {
    for (const el of page.elements) {
      if (el.type === "image" && el.src && mediaMap[el.src]) {
        el.mediaClass = mediaMap[el.src].class;
        el.reuse = mediaMap[el.src].usedBy.length;
      }
    }
  }

  // --- эффективный фон ---
  const effBgEl = {};
  const effBgKey = {};
  for (const p of pages) {
    const el = p.elements.find((e) => e.mediaClass === "background" && e.coverage !== undefined && e.coverage !== null && e.coverage >= 0.95);
    if (el && el.src) {
      effBgEl[p.slide] = el;
      effBgKey[p.slide] = el.src;
    } else {
      const b = p.background;
      effBgKey[p.slide] = b.media ? b.media
        : b.type === "solid" ? `solid ${b.color || b.scheme || ""}`.trim()
        : b.type;
    }
  }

  // --- _source.json ---
  const st = fs.statSync(inFile);
  const absIn = path.resolve(inFile);
  const relIn = path.relative(process.cwd(), absIn);
  const shownIn = relIn && !relIn.startsWith("..") && !path.isAbsolute(relIn) ? relIn.split(path.sep).join("/") : absIn;
  fs.writeFileSync(path.join(outDir, "_source.json"),
    _dumpsPretty({ file: shownIn, bytes: st.size, mtime: st.mtimeMs, slideCount: slideOrder.length }) + "\n");

  // --- style.json ---
  const embeddedFontFiles = names.filter((n) => n.startsWith("ppt/fonts/")).map((n) => path.posix.basename(n));
  const styleJson = {
    file: path.basename(inFile), slideCount: slideOrder.length,
    slideSizeEMU: [sldSz.cx, sldSz.cy], canvas: [1280, 720],
    elementsOrder: "z-order: elements[0] — самый нижний",
    theme: { colors: { ...theme }, clrMap: { ...clrMap }, fonts: themeFonts, embeddedFonts: embeddedFontFiles },
    style: {
      fonts: Object.fromEntries(_sortedHist(counters.fonts).slice(0, 15)),
      fontSizes: Object.fromEntries(_jsObjOrder(_sortedHist(counters.sizes).slice(0, 15).map(([k, v]) => [_jsKey(k), v]))),
      textColors: Object.fromEntries(_sortedHist(counters.colors).slice(0, 15)),
      shapeFills: Object.fromEntries(_sortedHist(counters.fills).slice(0, 15)),
      gradients: Object.fromEntries(_sortedHist(counters.gradients).slice(0, 10)),
    },
  };
  fs.writeFileSync(path.join(outDir, "style.json"), _dumpsPretty(styleJson));

  // --- fonts.json ---
  fs.writeFileSync(path.join(outDir, "fonts.json"), _dumpsPretty({
    fonts: Object.fromEntries(_sortedHist(counters.fonts).slice(0, 15)),
    theme: themeFonts,
    embedded: embeddedFontFiles.length > 0,
    embeddedFonts: embeddedFontFiles,
  }));

  // --- media-map.json ---
  fs.writeFileSync(path.join(outDir, "media-map.json"), _dumpsPretty({ source: path.basename(inFile), files: mediaMap }));

  // --- proto.json ---
  const protoInfo = pagesProtoInfo(Object.fromEntries(pages.map((p) => [p.slide, p])));
  fs.writeFileSync(path.join(outDir, "proto.json"),
    _dumpsPretty(Object.fromEntries(Object.keys(protoInfo).map(Number).sort((a, b) => a - b).map((n) => [String(n), protoInfo[n]]))));

  // --- pages/slide-NN.json ---
  const pagesDir = path.join(outDir, "pages");
  if (!withPages && fs.existsSync(pagesDir) && fs.statSync(pagesDir).isDirectory()) {
    fs.rmSync(pagesDir, { recursive: true, force: true });
  }
  if (withPages) {
    fs.mkdirSync(pagesDir, { recursive: true });
    for (const p of pages) {
      const bgLines = _dumpsPretty(p.background).split("\n");
      const covLines = _dumpsPretty(p.coverageReport).split("\n");
      const out = ["{", `  "slide": ${_dumps(p.slide)},`, `  "part": ${_dumps(p.part)},`,
                   `  "background": ${bgLines[0]}`];
      for (let i = 1; i < bgLines.length; i++) out.push("  " + bgLines[i] + (i === bgLines.length - 1 ? "," : ""));
      out.push(`  "coverageReport": ${covLines[0]}`);
      for (let i = 1; i < covLines.length; i++) out.push("  " + covLines[i] + (i === covLines.length - 1 ? "," : ""));
      out.push('  "elements": [');
      for (let i = 0; i < p.elements.length; i++) {
        out.push("    " + _dumps(p.elements[i]) + (i < p.elements.length - 1 ? "," : ""));
      }
      out.push("  ]");
      out.push("}");
      fs.writeFileSync(path.join(pagesDir, `slide-${String(p.slide).padStart(2, "0")}.json`), out.join("\n") + "\n");
    }
  }

  // --- shots + thumbs ---
  const { cropViewportStrips, decorThumbs, natKey, rasterizeSvg, runVerify, thumbsFromShots } = require("../render.cjs");
  const listPngs = (d) => fs.readdirSync(d).filter((fn) => fn.toLowerCase().endsWith(".png"))
    .map((fn) => path.join(d, fn)).sort((a, b) => natKeyCmp(natKey(a), natKey(b)));
  const shotsDst = path.join(outDir, "shots");

  if (doRender) {
    fs.mkdirSync(shotsDst, { recursive: true });
    for (const old of fs.readdirSync(shotsDst)) fs.unlinkSync(path.join(shotsDst, old));
    const bin_ = opt("--render-bin") || process.env.GIGATOOL_NODE || process.env.MULTITOOL_NODE;
    const app_ = opt("--render-app") || process.env.GIGATOOL_APP_PATH || process.env.MULTITOOL_APP_PATH;
    runVerify(path.resolve(inFile), shotsDst, { app: app_, binary: bin_, quiet: "unpack" });
  }

  let shotFiles = [];
  if (doRender || shotsDir) {
    const srcDir = doRender ? shotsDst : shotsDir;
    if (!fs.existsSync(srcDir)) {
      bFail(2, { error: `shots dir not found: ${srcDir}`, suggestion: "укажите существующую папку с PNG шотами или используйте --render" });
    }
    shotFiles = listPngs(srcDir);
  }
  let thumbFiles = [];
  if (shotFiles.length) {
    fs.mkdirSync(shotsDst, { recursive: true });
    if (!doRender) {
      const sameDir = path.resolve(shotsDir) === path.resolve(shotsDst);
      if (!sameDir) {
        for (const old of fs.readdirSync(shotsDst)) {
          if (old.toLowerCase().endsWith(".png")) fs.unlinkSync(path.join(shotsDst, old));
        }
        for (const fp of shotFiles) {
          fs.copyFileSync(fp, path.join(shotsDst, path.basename(fp)));
        }
        shotFiles = listPngs(shotsDst);
      }
    }
    for (const old of fs.readdirSync(outDir).filter((fn) => /^thumbs(-\d+)?\.png$/.test(fn))) {
      fs.unlinkSync(path.join(outDir, old));
    }
    if (shotFiles.length !== slideOrder.length) {
      bFail(doRender ? 3 : 2, { error: `шотов ${shotFiles.length}, слайдов ${slideOrder.length} — источник шотов битый или неполный`,
                                suggestion: doRender ? "рендер приложения неполный — смотрите вывод --pptx-verify выше" : "передайте полный набор PNG (по одному на слайд) или запустите с --render" });
    }
    const nCropped = cropViewportStrips(shotFiles);
    if (nCropped) console.log(`shots: кроп полос вьюпорта у ${nCropped} шотов`);
    thumbFiles = thumbsFromShots(shotFiles, outDir, { gridCols: 6, gridRows: 4, tileW: 320 });
  }

  // --- decor-thumbs ---
  let decorThumbFiles = [];
  if (!noDecorThumbs) {
    let decorRaster = Object.entries(mediaMap)
      .filter(([n, e]) => ["decor", "content"].includes(e.class) && ["png", "jpg", "jpeg"].includes(e.format))
      .map(([n]) => path.join(outDir, "media", n));
    decorRaster = decorRaster.filter((p) => fs.existsSync(p));
    for (const [n, e] of Object.entries(mediaMap).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      if (e.class !== "background" && e.format === "svg") {
        const sp = path.join(outDir, "media", n);
        if (fs.existsSync(sp)) {
          try {
            decorRaster.push([rasterizeSvg(sp), n]);
          } catch { /* skip */ }
        }
      }
    }
    if (decorRaster.length) {
      decorThumbFiles = decorThumbs(decorRaster.sort((a, b) => {
        const ka = natKey(typeof a === "string" ? a : a[1]);
        const kb = natKey(typeof b === "string" ? b : b[1]);
        return natKeyCmp(ka, kb);
      }), outDir);
    }
  }

  // --- slides.md ---
  const hist = (d, top) => _sortedHist(d).slice(0, top || 12).map(([k, v]) => `${_jsKey(k)} ×${v}`).join(", ");
  const byClass = {};
  for (const [b, e] of Object.entries(mediaMap)) {
    (byClass[e.class] = byClass[e.class] || []).push(b);
  }
  const md = [];
  md.push(`# STYLE.md — ${path.basename(inFile)} — ${slideOrder.length} slides, canvas 1280×720`);
  md.push("");
  md.push("This is the ONLY text file to read for style/layout. Read it whole"
          + (thumbFiles.length ? ", look at the contact sheet thumbs-*.png ONCE for the general visual feel" : "")
          + " — and author.");
  md.push("Every other file and folder in this atlas is machine data for the build —");
  md.push("there is nothing else to read.");
  md.push("");
  const slideLayout = {};
  for (const [lp, slides] of Object.entries(layoutSlides)) {
    for (const s of slides) slideLayout[s] = path.posix.basename(lp).replace(".xml", "");
  }

  const tocText = (elements) => {
    for (const el of elements) {
      if (el.type !== "text") continue;
      const t = (el.paragraphs || []).map((par) => (par.runs || []).map((r) => r.text || "").join("")).join(" ").replace(/\s+/g, " ").trim();
      if (t) return t;
    }
    return "";
  };

  const _slideKind = (p, nMax) => {
    const els = p.elements;
    const types = new Set(els.map((el) => el.type));
    if (types.has("table")) return "table";
    if (types.has("chart")) return "chart";
    if (p.slide === 1) return "cover";
    if (p.slide === nMax) return "closing";
    if (els.some((el) => el.type === "image" && (el.coverage || 0) >= 0.3)) return "photo";
    const cards = els.filter((el) => el.type === "shape" && el.shape === "roundRect");
    if (cards.length >= 3) {
      const ws = cards.map((el) => Math.round((el.bounds || [0, 0, 0, 0])[2])).sort((a, b) => a - b);
      if (ws.length && ws[ws.length - 1] - ws[0] <= 60) return "cards";
    }
    if (els.length <= 6) return "divider";
    if (els.some((el) => el.type === "text" && (el.paragraphs || []).some((para) => (para.runs || []).some((r) => (r.sz || 0) >= 40)))) return "stat";
    return "content";
  };

  md.push("## Contents");
  md.push("");
  md.push("| # | type | layout | first text | els | T/C |");
  md.push("|---|---|---|---|---|---|");
  for (const p of pages) {
    const types = new Set(p.elements.map((el) => el.type));
    const flags = (types.has("table") ? "T" : "") + (types.has("chart") ? "C" : "");
    let t = tocText(p.elements);
    if ([...t].length > 50) t = [...t].slice(0, 49).join("") + "…";
    md.push(`| ${p.slide} | ${_slideKind(p, pages[pages.length - 1].slide)} | ${slideLayout[p.slide] || "—"} | ${t.replace(/\|/g, "\\|")} | ${p.elements.length} | ${flags || "—"} |`);
  }
  md.push("");
  md.push("## Style");
  md.push("");
  md.push(`- Fonts: ${hist(counters.fonts) || "—"}`);
  md.push(`- Font sizes: ${hist(counters.sizes) || "—"}`);
  md.push(`- Text colors: ${hist(counters.colors) || "—"}`);
  md.push(`- Shape fills: ${hist(counters.fills) || "—"}`);
  if (Object.keys(counters.gradients).length) {
    md.push("- Gradients: " + Object.keys(counters.gradients).map((g) => {
      const gj = JSON.parse(g);
      return `${gj.angle !== null && gj.angle !== undefined ? gj.angle : "?"}° ` +
        gj.stops.map((s) => (s.color && (s.color.hex || s.color.scheme)) || "?").join("→");
    }).join("; "));
  }
  md.push("- Theme: " + (Object.entries(theme).map(([k, v]) => `${k} #${v}`).join(" ") || "—"));
  md.push("- clrMap: " + (["bg1", "tx1", "bg2", "tx2"].filter((k) => k in clrMap).map((k) => `${k}→${clrMap[k]}`).join(" ") || "—"));
  md.push(`- Theme fonts: major ${themeFonts.major || "?"}, minor ${themeFonts.minor || "?"}; embedded: ${names.some((n) => n.startsWith("ppt/fonts/")) ? "yes" : "no"}`);
  md.push("");

  const _slimEl = (el) => {
    const t = el.type;
    const b = el.bounds;
    const bs = Array.isArray(b) ? "[" + b.map(String).join(",") + "]" : "?";
    if (t === "shape") {
      let s = `shape ${el.shape} ${bs}`;
      if (el.adjustments) s += ` adj${pyStrNum(el.adjustments[0])}`;
      const f = el.fill || {};
      if (f.solid) s += ` fill ${f.solid}`;
      const g = f.gradient || {};
      if (g.stops) {
        const sc = (st) => {
          const c = typeof st === "object" && st !== null ? st.color : null;
          return (c && (c.hex || c.scheme)) || (typeof st === "object" && st !== null ? "?" : (Array.isArray(st) ? st[1] : "?"));
        };
        s += " grad " + g.stops.map(sc).join("→");
      }
      const ln = el.line || {};
      if (ln.w) s += ` line w${ln.w}`;
      if (el.bleed) s += " bleed";
      return s;
    }
    if (t === "image") return `image ${el.src} ${bs}`;
    if (t === "text") {
      let r0 = null;
      for (const para of el.paragraphs || []) {
        for (const r of para.runs || []) {
          if ((r.text || "").trim()) { r0 = r; break; }
        }
        if (r0) break;
      }
      const txt = (el.paragraphs || []).map((para) => (para.runs || []).map((r) => r.text || "").join("")).join("").trim().slice(0, 24);
      let st = "";
      if (r0) {
        st = `${r0.sz ? pyStrNum(r0.sz) : "?"}pt${r0.b ? " b" : ""} ${r0.font || "?"} ${r0.color || ""}`;
      }
      return `text ${bs} ${el.anchor || ""} ${st} «${txt}»`.replace(/  /g, " ").trim();
    }
    return `${t} ${bs}`;
  };

  const archetypes = {};
  for (const p of pages) {
    (archetypes[effBgKey[p.slide]] = archetypes[effBgKey[p.slide]] || []).push(p.slide);
  }
  md.push("## Layout patterns (geometry variants per background archetype — adapt,");
  md.push("don't copy 1:1: keep bounds logic, replace texts/colors with your content)");
  md.push("");
  let shown = 0;
  for (const [k, slides] of Object.entries(archetypes).sort((a, b) => b[1].length - a[1].length)) {
    if (shown >= 6) break;
    const rep = pages.find((p) => p.slide === slides[0]);
    if (!rep) continue;
    shown += 1;
    md.push(`### «${k}» — pattern from slide ${rep.slide} (${rep.elements.length} els)`);
    for (const el of rep.elements.slice(0, 12)) md.push(`- ${_slimEl(el)}`);
    if (rep.elements.length > 12) md.push(`- …${rep.elements.length - 12} more`);
    md.push("");
  }

  // --- Примеры слайдов ---
  let exCount = 0;
  const exSlides = new Set();
  let exHeader = false;
  const mclasses = Object.fromEntries(Object.entries(mediaMap).map(([n, e]) => [n, e.class]));
  for (const [k, slides] of Object.entries(archetypes).sort((a, b) => b[1].length - a[1].length)) {
    if (exCount >= 5) break;
    const cands = pages.filter((p) =>
      slides.includes(p.slide) && !exSlides.has(p.slide) &&
      !((protoInfo[p.slide] || {}).degraded) &&
      !(p.elements || []).some((el) => el.type === "image" && mclasses[path.posix.basename(el.src || "")] === "content"));
    for (const cand of cands) {
      const ptype = cand.slide === slideOrder[0] ? "cover" : "content"; // oracle: slideOrder[0] — part-path (никогда int) → всегда content
      const ex = typicalExample(cand, ptype, cand.slide, mclasses, (b) => `media/${b}`);
      if (ex.elements.length < 3) break;
      const probe = [{ file: "example.json", spec: ex }];
      const [fitHard] = textfitCheck(probe);
      const [ovHard] = overlapCheck(probe);
      if (fitHard.length || ovHard.length) continue;
      if (!exHeader) {
        md.push("## Примеры слайдов — эталоны стиля этого референса");
        md.push("");
        md.push("Реальные шрифты/цвета/геометрия. Контент — ваш; композиция адаптируется");
        md.push("под контент (check подтвердит вместимость), 1:1 с чужими текстами — плохо.");
        md.push("");
        exHeader = true;
      }
      exCount += 1;
      exSlides.add(cand.slide);
      md.push(`### proto ${cand.slide} — ${k}`);
      md.push("```json");
      md.push(...dumpExampleLines(ex));
      md.push("```");
      md.push("");
      break;
    }
  }
  const orphanCount = Object.values(mediaMap).filter((e) => e.orphan).length;
  md.push(`## Media (${mediaFiles.length}): ` + ["background", "decor", "content", "unrenderable"].map((c) => `${c} ${(byClass[c] || []).length}`).join(" · ") + (orphanCount ? ` · orphans ${orphanCount}` : ""));
  md.push("");
  md.push("Class: **background** — page background (p:bg or full-bleed, use only as background); **decor** — has alpha (can overlay); **content** — opaque non-background; **unrenderable** — svg/wmf/emf/wdp. Files are `media/<name>` bit-for-bit; the table below carries class, px size and where-used.");
  md.push("");
  md.push("## Archetypes");
  md.push("");
  for (const [k, slides] of Object.entries(archetypes)) {
    md.push(`- ${k}: ${slides.length > 1 ? "slides" : "slide"} ${slides.join(", ")}`);
  }
  md.push("");
  const decor = Object.entries(mediaMap).filter(([, e]) => ["decor", "content"].includes(e.class)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (decor.length) {
    md.push("## Decor (reusable media — pick by description; class decor = alpha/overlay, content = opaque photo)");
    md.push("");
    md.push("| file | class | px | used on |");
    md.push("|---|---|---|---|");
    for (const [n, e] of decor) {
      const used = (e.usedBy || []).filter((u) => u.slide).map((u) => String(u.slide)).join(", ") || "—";
      md.push(`| ${n} | ${e.class} | ${e.width || "?"}×${e.height || "?"} | ${used} |`);
    }
    md.push("");
  }
  if (thumbFiles.length) {
    md.push(`## Thumbs: ${thumbFiles.map((t) => `\`${t}\``).join(" ")} (labels = shot names from shots/)`);
    md.push("");
  }
  if (decorThumbFiles.length) {
    md.push(`## Decor thumbs: ${decorThumbFiles.map((t) => `\`${t}\``).join(" ")} — один vision-вызов на лист`);
    md.push("с промптом «перечисли ВСЕ плитки без пропусков (слева направо, построчно):");
    md.push("имя (подпись ПОД фото, в общей с ним рамке) — описание — класс decor");
    md.push("(нейтральное украшение) / content (скриншот, график, человек, визитка/");
    md.push("карточка с человеком или контактами, чужой продуктовый контент, QR)»;");
    md.push("копируются только decor-класс, по одному файлы не открываются.");
    md.push("");
  }
  fs.writeFileSync(path.join(outDir, "STYLE.md"), md.join("\n"));

  // --- stdout ---
  console.log(`OK: ${slideOrder.length} слайдов → ${outDir}`);
  const sheets = [...thumbFiles, ...decorThumbFiles];
  console.log("ОБЯЗАТЕЛЬНЫЙ интейк — по одному вызову на ответ, строго в этом порядке, до любых других действий:");
  console.log(`  1) read ${outDir}/STYLE.md`);
  sheets.forEach((s, i) => {
    console.log(`  ${i + 2}) read_image ${outDir}/${s}`);
  });
  console.log("  Больше в атласе читать нечего — остальное машинные данные для build.");
  if (!shotFiles.length) {
    console.log("thumbs нет (шоты не переданы). recovery (default — первая команда, рендер штатным вызовом приложения):");
    console.log(`  ${deckCmd("unpack", inFile, "--out", outDir, "--render")}`);
    console.log(`  # либо вручную на машине с приложением: env -u ELECTRON_RUN_AS_NODE "<бинарь приложения>" [app-path] --pptx-verify "${path.resolve(inFile)}" --out-dir "${path.resolve(shotsDst)}"`);
    console.log(`  ${deckCmd("unpack", inFile, "--out", outDir, "--shots", shotsDst)}`);
  }
  if (counters.links) {
    console.log(`links: ${counters.links} гиперссылок (url в поле link у run/элемента)`);
  }
  return 0;
}

// nat sort: [int|str...] — сравнение как в Python (int < str гарантировано позицией)
function natKeyCmp(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i >= a.length) return -1;
    if (i >= b.length) return 1;
    const [x, y] = [a[i], b[i]];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

module.exports = { run, USAGE_UNPACK, _dumps, _dumpsPretty, _jsKey, _jsObjOrder, natKeyCmp };
