// cli.cjs — build/check оркестрация (порт builder/cli.py v3.2.1).
'use strict';
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { DECOR_NAMES } = require("../consts.cjs");
const { bFail, deckCmd, skillCmd, skillRoot } = require("../errors.cjs");
const { pyJsonDumps, pyJsonString } = require("../numfmt.cjs");
const { parse: jsonLoads } = require("../jsonpy.cjs");
const { El } = require("../xml.cjs");
const { overlapCheck } = require("./overlap.cjs");
const { qaWarnings } = require("./qa.cjs");
const { textfitCheck } = require("./textfit.cjs");
const { resolveProtos } = require("./proto.cjs");
const { validate } = require("./validate.cjs");
const { renderAndThumbs } = require("../render.cjs");
const { Package, Part, CT, RT, findLocal } = require("./opc.cjs");
const { px: pxEmu } = require("./elhelpers.cjs");
const { copyDecor, deleteSlide } = require("./decor.cjs");
const { mk, sub, findL, removeL, solidFillXml, gradFillXml, NS_A, NS_P } = require("./xmlbuild.cjs");
const { CH255 } = require("./srgb_luma_table.cjs");

const USAGE_BUILD = "usage: deck.cjs build <projectDir> --out <deck.pptx> [--theme dark|light] [--template <ref.pptx> --ref <name>-ref/] [--app <path>]\n       deck.cjs check <projectDir> [--theme dark|light] [--template <ref.pptx> --ref <name>-ref/]";
const THEMES = ["dark", "light"];

const _list = (x) => (Array.isArray(x) ? x : []);
const _obj = (x) => (x !== null && typeof x === "object" && !Array.isArray(x));
const _asStr = (v) => (v === null || v === undefined) ? "" : (typeof v === "object" && v.constructor && v.constructor.name === "PyFloat" ? require("../jsonpy.cjs").pyFloatStr(v.v) : String(v));

function naturalKey(name) {
  return name.split(/(\d+)/).map((t) => (/^\d+$/.test(t) ? parseInt(t, 10) : t));
}
function naturalCmp(a, b) {
  const ka = naturalKey(a), kb = naturalKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    if (i >= ka.length) return -1;
    if (i >= kb.length) return 1;
    const [x, y] = [ka[i], kb[i]];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

function _collect(args, needOut, cmd) {
  const projectDir = args.length ? args[0] : null;
  const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
  const outArg = opt("--out");
  if (!projectDir || (needOut && !outArg)) {
    bFail(2, { error: USAGE_BUILD });
  }
  const templateArg = opt("--template"), refArg = opt("--ref");
  if (!!templateArg !== !!refArg) {
    bFail(2, { error: "--template и --ref указываются только вместе (clone)", suggestion: "либо оба флага, либо ни одного (create на bundled-шаблоне)" });
  }
  const themeArg = opt("--theme");
  if (templateArg && themeArg) {
    bFail(2, { error: "--theme только для create (без --template/--ref)", suggestion: "в clone тему задаёт сам референс-шаблон" });
  }
  if (themeArg !== null && !THEMES.includes(themeArg)) {
    bFail(2, { error: `--theme ∈ ${THEMES.join("|")} (сейчас: ${pyJsonDumps(themeArg)})`, suggestion: "--theme dark — тёмная SU 2026; --theme light — светлая" });
  }
  const app = opt("--app") || process.env.GIGATOOL_APP_PATH || process.env.MULTITOOL_APP_PATH;
  const a = {
    projectDir, outPath: outArg ? path.resolve(outArg) : null, app,
    mode: templateArg ? "clone" : "create",
  };
  a.deckDir = a.outPath ? path.dirname(a.outPath) : null;

  const pagesDir = path.join(projectDir, "pages");
  if (!fs.existsSync(pagesDir) || !fs.statSync(pagesDir).isDirectory()) {
    bFail(2, { error: `нет pages/ в проекте: ${projectDir}`, suggestion: "напишите страницы pages/slide-NN.json (по одной за ответ; грамматика — references/spec.md)" });
  }
  let files = fs.readdirSync(pagesDir)
    .filter((f) => /^slide-.*\.json$/.test(f))
    .map((f) => path.join(pagesDir, f));
  files.sort((x, y) => naturalCmp(path.basename(x), path.basename(y)));
  const deckJsonPath = path.join(projectDir, "deck.json");
  if (fs.existsSync(deckJsonPath)) {
    try {
      const normName = (n) => {
        const s = String(n).replace("slide-", "").split(".")[0];
        return /^\d+$/.test(s) ? `slide-${s.padStart(2, "0")}.json` : null;
      };
      const order = (JSON.parse(fs.readFileSync(deckJsonPath, "utf8")).pageOrder || []).map(normName).filter(Boolean);
      if (order.length) {
        const unknown = order.filter((n) => !fs.existsSync(path.join(pagesDir, n)));
        if (unknown.length) {
          console.log(`WARN: deck.json pageOrder — неизвестные страницы пропущены: ${unknown.join(", ")}`);
        }
        files.sort((x, y) => {
          const ix = order.indexOf(path.basename(x)), iy = order.indexOf(path.basename(y));
          return (ix < 0 ? order.length : ix) - (iy < 0 ? order.length : iy);
        });
      }
    } catch {
      console.log("WARN: deck.json нечитаем — порядок страниц алфавитный (править не обязательно)");
    }
  }
  if (!files.length) {
    bFail(2, { error: "pages/ пуста", suggestion: `напишите хотя бы одну страницу pages/slide-01.json по references/spec.md и повторите ${cmd}` });
  }
  const pages = [];
  const badJson = [];
  files.forEach((f, i) => {
    let spec;
    try {
      spec = jsonLoads(fs.readFileSync(f, "utf8"));
    } catch (e) {
      badJson.push([path.basename(f), String(e.message || e)]);
      return;
    }
    if (!_obj(spec)) {
      badJson.push([path.basename(f), "верхний уровень — не JSON-объект"]);
      return;
    }
    pages.push({ file: path.basename(f), idx: i + 1, spec });
  });
  if (badJson.length) {
    bFail(2, {
      error: `невалидный JSON в ${badJson.length} файл(ах)`,
      failures: badJson.map(([n, e]) => ({ page: n, msg: `[HARD] невалидный JSON (${e}) — перепишите файл целиком` })),
      suggestion: `перепишите все перечисленные pages/*.json целиком (whole-file write) одним шагом и повторите ${cmd}`,
    });
  }

  let templatePath, atlasDir;
  if (a.mode === "clone") {
    templatePath = templateArg;
    atlasDir = refArg;
  } else {
    const theme = themeArg || "dark";
    templatePath = path.join(skillRoot(), "templates", `default_${theme}.pptx`);
    atlasDir = path.join(skillRoot(), "templates", `default_${theme}-ref`);
  }
  const noTheme = a.mode === "create" && themeArg === null;
  if (!fs.existsSync(templatePath)) {
    bFail(a.mode === "clone" ? 2 : 3, {
      error: `шаблон не найден: ${templatePath}`,
      suggestion: a.mode === "clone" ? "укажите существующий --template <ref.pptx>" : "проверьте бандл скилла (templates/default_{dark,light}.pptx + templates/default_*-ref/)",
    });
  }
  const mediaClass = {};
  const srcFile = path.join(atlasDir, "_source.json");
  if (!fs.existsSync(srcFile)) {
    bFail(2, { error: `в атласе нет _source.json: ${atlasDir}`, suggestion: deckCmd("unpack", String(templatePath), "--out", String(atlasDir)) });
  }
  const atlasBroken = (what) => {
    bFail(2, { error: `атлас повреждён (${what}): ${atlasDir}`, suggestion: deckCmd("unpack", String(templatePath), "--out", String(atlasDir)) });
  };
  let source;
  try {
    source = JSON.parse(fs.readFileSync(srcFile, "utf8"));
  } catch {
    atlasBroken("_source.json нечитаем");
  }
  const st = fs.statSync(templatePath);
  if (source.bytes !== st.size) {
    bFail(2, { error: `атлас протух относительно шаблона (_source.json: bytes ${source.bytes}, файл: bytes ${st.size})`,
               suggestion: deckCmd("unpack", String(templatePath), "--out", String(atlasDir)) });
  }
  let template = null;
  const templateFile = path.join(atlasDir, "template.json");
  if (fs.existsSync(templateFile)) {
    try {
      template = JSON.parse(fs.readFileSync(templateFile, "utf8"));
    } catch {
      atlasBroken("template.json нечитаем");
    }
  }
  let protoInfo;
  if (a.mode === "clone") {
    const protoFile = path.join(atlasDir, "proto.json");
    if (!fs.existsSync(protoFile)) {
      bFail(2, { error: `в атласе нет proto.json: ${atlasDir} (атлас старого формата или неполон)`,
                 suggestion: deckCmd("unpack", String(templatePath), "--out", String(atlasDir)) });
    }
    try {
      protoInfo = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(protoFile, "utf8"))).map(([n, m]) => [parseInt(n, 10), m]));
    } catch {
      atlasBroken("proto.json нечитаем");
    }
    if (Object.keys(protoInfo).length !== (source.slideCount || 0)) {
      bFail(2, { error: `атлас неполон: прототипов ${Object.keys(protoInfo).length}, в _source.json ${source.slideCount}`,
                 suggestion: deckCmd("unpack", String(templatePath), "--out", String(atlasDir)) });
    }
  } else {
    const protoMeta = (template || {}).protoMeta || {};
    protoInfo = Object.fromEntries(Object.entries(protoMeta).map(([n, m]) => [parseInt(n, 10), m]));
    if (!Object.keys(protoInfo).length) {
      bFail(2, { error: `в атласе нет template.json/protoMeta: ${atlasDir}`,
                 suggestion: skillCmd(path.join("tools", "helpers", "build_templates", "prepare_templates.cjs"), "--force") });
    }
  }
  const mmFile = path.join(atlasDir, "media-map.json");
  if (fs.existsSync(mmFile)) {
    try {
      for (const [name, e] of Object.entries(JSON.parse(fs.readFileSync(mmFile, "utf8")).files || {})) {
        mediaClass[name] = e.class;
      }
    } catch {
      atlasBroken("media-map.json нечитаем");
    }
  }

  let failures = validate(a, pages);
  const planPath = path.join(a.projectDir, "plan.md");
  if (fs.existsSync(planPath)) {
    try {
      const planText = fs.readFileSync(planPath, "utf8");
      const expected = new Set();
      for (const m of planText.matchAll(/^\s*(\d+)\s*[.)]/gm)) expected.add(parseInt(m[1], 10));
      for (const m of planText.matchAll(/^\s*(\d+)\s*\.\.\s*(\d+)/gm)) {
        for (let i = parseInt(m[1], 10); i <= parseInt(m[2], 10); i++) expected.add(i);
      }
      const have = new Set();
      for (const p of pages) {
        const m = /^slide-(\d+)\.json$/.exec(p.file);
        if (m) have.add(parseInt(m[1], 10));
      }
      const missing = [...expected].filter((n) => !have.has(n)).sort((x, y) => x - y);
      if (missing.length) {
        failures.push({ page: "plan.md", action: "напишите недостающие страницы",
                        msg: "[HARD] страницы из plan.md отсутствуют на диске: "
                             + missing.map((n) => `slide-${String(n).padStart(2, "0")}.json`).join(", ")
                             + " — напишите их целиком по plan.md" });
      }
    } catch { /* ignore */ }
  }
  const [fitHard, fitWarn] = textfitCheck(pages);
  failures = failures.concat(fitHard);
  const [protos, protoFailures] = resolveProtos(a, pages, protoInfo, (template || {}).autoProto);
  failures = failures.concat(protoFailures);
  const protoMisses = protoFailures.filter((f) => (f.msg || "").includes("недоступен: такого proto"));
  if (protoMisses.length && a.mode === "create" && protoMisses.length === pages.length) {
    const neighbors = fs.readdirSync(path.dirname(a.projectDir))
      .map((d) => path.join(path.dirname(a.projectDir), d))
      .filter((d) => d.endsWith("-ref") && fs.existsSync(path.join(d, "_source.json")) && fs.existsSync(path.join(d, "proto.json")))
      .map((d) => path.basename(d));
    if (neighbors.length) {
      console.log(`подсказка: все proto мимо дефолтного атласа, а рядом есть ${neighbors.slice(0, 3).join(", ")} — ` +
                  `похоже, это CLONE-проект: запускайте check/build с --template <ref.pptx> --ref ${neighbors[0]}`);
    }
  }
  const underlays = {};
  for (const m of protos) {
    const arch = ((protoInfo[m.proto] || {}).arch) || "";
    let rgb = null;
    if (arch.startsWith("solid #")) {
      try {
        const c = arch.slice(7, 13);
        rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
        if (rgb.some((v) => Number.isNaN(v))) rgb = null;
      } catch { rgb = null; }
    }
    if (rgb === null && arch.includes(".")) {
      const mp = path.join(atlasDir, "media", arch);
      if (fs.existsSync(mp)) {
        try {
          rgb = require("../raster.cjs").averageRgb(mp);
        } catch { rgb = null; }
      }
    }
    if (rgb === null && a.mode === "create") {
      rgb = noTheme ? [255, 255, 255] : (themeArg !== "light" ? [12, 12, 12] : [255, 255, 255]);
    }
    if (rgb !== null) underlays[m.file] = rgb;
  }
  const [qaHard, qaWarn] = qaWarnings(pages, underlays, a.projectDir);
  const [ovHard, ovWarn] = overlapCheck(pages, underlays);
  failures = failures.concat(qaHard).concat(ovHard);
  const warnings = [
    ...fitWarn.map((w) => `WARN text-fit: ${w}`),
    ...qaWarn.map((w) => `WARN qa: ${w}`),
    ...ovWarn.map((w) => `WARN overlap: ${w}`),
  ];
  if (noTheme) {
    const noBg = pages.filter((p) => !((p.spec.background) || null)).map((p) => p.file);
    if (noBg.length) {
      warnings.push("WARN theme: --theme не задан — SU-оформление прото не копируется, страницы без "
                    + `explicit background будут белыми: ${noBg.join(", ")} `
                    + "(для SU-стиля повторите с --theme dark|light; для своего стиля — верно, править не обязательно)");
    }
  }
  if (a.mode === "create" && !noTheme) {
    const zones = (((template || {}).branding || {}).slides) || {};
    for (const m of protos) {
      const z = zones[String(m.proto)];
      if (!z) continue;
      const [zx0, zy0, zx1, zy1] = [z[0], z[1], z[0] + z[2], z[1] + z[3]];
      _list(m.page.spec.elements).forEach((el, ei) => {
        const b = _obj(el) ? el.bounds : null;
        if (!(Array.isArray(b) && b.length === 4)) return;
        if (Math.min(b[0] + b[2], zx1) - Math.max(b[0], zx0) > 0 && Math.min(b[1] + b[3], zy1) - Math.max(b[1], zy0) > 0) {
          const cand = [];
          if (zy1 + 4 > b[1]) cand.push([zy1 + 4 - b[1], `вниз на ${zy1 + 4 - b[1]}px (y: ${b[1]}→${zy1 + 4})`]);
          if (zy0 - 4 - b[3] >= 0 && b[1] > zy0 - 4 - b[3]) cand.push([b[1] - (zy0 - 4 - b[3]), `вверх на ${b[1] - (zy0 - 4 - b[3])}px (y: ${b[1]}→${zy0 - 4 - b[3]})`]);
          if (zx1 + 4 > b[0]) cand.push([zx1 + 4 - b[0], `вправо на ${zx1 + 4 - b[0]}px (x: ${b[0]}→${zx1 + 4})`]);
          if (zx0 - 4 - b[2] >= 0 && b[0] > zx0 - 4 - b[2]) cand.push([b[0] - (zx0 - 4 - b[2]), `влево на ${b[0] - (zx0 - 4 - b[2])}px (x: ${b[0]}→${zx0 - 4 - b[2]})`]);
          cand.sort((p1, p2) => (typeof p1[0] === "number" && typeof p2[0] === "number" ? p1[0] - p2[0] : 0) || String(p1[1]).localeCompare(String(p2[1])));
          const hint = cand.length ? `сместите ${cand[0][1]}` : "уберите элемент из зоны логотипа";
          warnings.push(
            `WARN branding: ${m.file} el#${ei + 1}: пересекается с зоной логотипа SberUser ` +
            `(${z[0]},${z[1]},${z[2]}×${z[3]}) фона прототипа ${m.proto} — ` +
            `не пишите текст поверх брендинга: ${hint} (править не обязательно)`);
        }
      });
    }
  }
  return { a, pages, protos, failures, no_theme: noTheme, warnings, templatePath, atlasDir, mediaClass, underlays };
}

function _report(ctx, what, cmd) {
  const { warnings, failures } = ctx;
  let plan = [];
  if (failures.length) {
    plan = [];
    const seen = new Set();
    for (const f of failures) {
      let el = String(f.el || "");
      el = /^\d+$/.test(el) ? `#${el}` : el;
      const act = f.action || String(f.msg || "").replace(/^\[HARD\] */, "");
      const row = `${`${f.page || "—"} ${el}`.trim()}: ${act}`;
      const key = row + "|" + (f.msg || "");
      if (seen.has(key)) continue;
      seen.add(key);
      plan.push(row);
    }
    console.log(`HARD ×${failures.length} — план по страницам (переписать целиком ТОЛЬКО эти):`);
    for (const row of plan) console.log(`HARD ${row}`);
  }
  for (const w of warnings) console.log(w);
  if (failures.length) {
    for (const f of failures) {
      if (typeof f.msg === "string" && !f.msg.startsWith("[HARD]")) f.msg = "[HARD] " + f.msg;
    }
    bFail(2, {
      error: `${what}: ${failures.length} замечаний`,
      plan,
      failures,
      warnings,
      suggestion: `примените план по страницам: каждую затронутую pages/*.json перепишите целиком (whole-file write, все страницы за один шаг) и повторите ${cmd}; WARN-строки — advisory, страницы только с WARN не трогайте`,
    });
  }
}

function check(args) {
  const ctx = _collect(args, false, "check");
  _report(ctx, "check", "check");
  console.log(`OK: check (${ctx.a.mode}) — ${ctx.pages.length} страниц, HARD-замечаний нет`);
  for (const m of ctx.protos) console.log(`прото: ${m.file} → ${m.proto} (${m.how})`);
  return 0;
}

// --- build ---

function _parseHex(hx) {
  try {
    const c = String(hx).replace(/^#/, "");
    const out = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
    return out.some(Number.isNaN) ? null : out;
  } catch {
    return null;
  }
}

function _pageRgb(ctx, item) {
  const spec = item.spec;
  const bg = spec.background || {};
  let rgb = null;
  if (bg.type === "solid" && typeof bg.color === "string") {
    rgb = _parseHex(bg.color);
  } else if (bg.type === "gradient") {
    let cols = _list((bg.gradient || {}).stops)
      .filter((s) => Array.isArray(s) && s.length === 2 && typeof s[1] === "string")
      .map((s) => _parseHex(s[1]));
    cols = cols.filter(Boolean);
    if (cols.length) {
      rgb = [0, 1, 2].map((i) => pyRound2(require("../numfmt.cjs").pySum(cols.map((c) => c[i])) / cols.length));
    }
  }
  if (rgb === null) rgb = (ctx.underlays || {})[item.file] || [255, 255, 255];
  return rgb;
}

function pyRound2(v) {
  const { pyRound } = require("../numfmt.cjs");
  return pyRound(v);
}

function _antonym(rgb) {
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return lum < 140 ? [255, 255, 255] : [26, 26, 26];
}

function _chartTextRgb(ctx, item) {
  return _antonym(_pageRgb(ctx, item));
}

function _svgFill(ctx, item, el) {
  const { _composite, _parse, _textUnderlay } = require("./qa.cjs");
  const spec = item.spec;
  const bgRgb = _pageRgb(ctx, item);
  const shapes = [];
  for (const shEl of _list(spec.elements)) {
    if (!_obj(shEl) || shEl.type !== "shape" || !shEl.bounds) continue;
    const f = shEl.fill || {};
    let hexs = [];
    if (f.solid) hexs = [f.solid];
    else if (f.gradient) {
      hexs = _list(f.gradient.stops).filter((s) => Array.isArray(s) && s.length === 2 && typeof s[1] === "string").map((s) => s[1]);
    }
    const comp = [];
    for (const hx of hexs) {
      const p = _parse(hx);
      if (p) comp.push(_composite(p, bgRgb));
    }
    if (comp.length) {
      shapes.push([shEl.bounds, [0, 1, 2].map((i) => pyRound2(require("../numfmt.cjs").pySum(comp.map((c) => c[i])) / comp.length))]);
    }
  }
  const under = _textUnderlay(el, shapes, bgRgb);
  const [r, g, b] = _antonym(under);
  return `#${[r, g, b].map((v) => v.toString(16).toUpperCase().padStart(2, "0")).join("")}`;
}

function setBgSolidOrGradient(slideEl, bg) {
  const cSld = findL(slideEl, "cSld");
  removeL(cSld, "bg");
  const bgEl = mk(NS_P, "bg");
  cSld.children.splice(0, 0, bgEl);
  const bgPr = sub(bgEl, NS_P, "bgPr");
  if (bg.type === "solid") solidFillXml(bgPr, bg.color);
  else gradFillXml(bgPr, bg.gradient);
  sub(bgPr, NS_A, "effectLst");
}

const NEW_SLIDE_TMPL =
  `<p:sld xmlns:a="${NS_A}" xmlns:p="${NS_P}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
  `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

function addSlide(pkg, layoutPart) {
  const { parseFrag } = require("./xmlbuild.cjs");
  const partname = pkg.nextSlidePartname();
  const part = pkg.addPart(new Part(pkg, partname, CT.PML_SLIDE));
  part.xmlEl = parseFrag(NEW_SLIDE_TMPL);
  // rel к layout
  part.rels.relateTo(RT.SLIDE_LAYOUT, layoutPart.partname);
  // sldIdLst (get_or_add: insert перед sldSz/notesSz/customerDataLst — schema order)
  const pres = pkg.parts.get("/ppt/presentation.xml");
  let sldIdLst = findLocal(pres.xmlEl, "sldIdLst");
  if (!sldIdLst) {
    sldIdLst = mk(NS_P, "sldIdLst");
    const before = ["sldSz", "notesSz", "embeddedFontLst", "custShowLst", "photoAlbum", "custDataLst", "kinsoku", "defaultTextStyle", "modifyVerifier", "extLst"]
      .map((t) => findLocal(pres.xmlEl, t)).find((n) => n);
    if (before) pres.xmlEl.children.splice(pres.xmlEl.children.indexOf(before), 0, sldIdLst);
    else pres.xmlEl.children.push(sldIdLst);
  }
  let maxId = 255;
  for (const c of sldIdLst.children) {
    if (c instanceof El && c.local === "sldId") maxId = Math.max(maxId, parseInt(c.attrs.get("id"), 10));
  }
  const rId = pres.rels.relateTo(RT.SLIDE, partname);
  const sldId = mk(NS_P, "sldId", { id: maxId + 1 });
  sldId.attrs.set(`{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id`, rId);
  sldIdLst.children.push(sldId);
  return part;
}

function nextShapeId(spTree) {
  let mx = 0;
  for (const n of spTree.iter()) {
    if (n instanceof El && n.local === "cNvPr") {
      const id = parseInt(n.attrs.get("id"), 10);
      if (!Number.isNaN(id)) mx = Math.max(mx, id);
    }
  }
  return mx + 1;
}

function* iterEls(root) {
  for (const c of root.children) {
    if (c instanceof El) {
      yield c;
      yield* iterEls(c);
    }
  }
}

async function run(args) {
  const ctx = _collect(args, true, "build");
  _report(ctx, "валидация провалена", "build");
  const { a, pages, protos } = ctx;
  const projectDir = a.projectDir;
  const { templatePath, atlasDir, mediaClass } = ctx;
  fs.mkdirSync(a.deckDir, { recursive: true });

  const noTheme = ctx.no_theme;
  let pkg, protoParts;
  if (noTheme) {
    pkg = Package.load(fs.readFileSync(path.join(skillRoot(), "vendor", "python-pptx", "default.pptx")));
    // slide_width/height = 12192000/6858000 (уже такие в default.pptx — но сеттер пишет всегда)
    const pres = pkg.parts.get("/ppt/presentation.xml");
    const sldSz = findLocal(pres.xmlEl, "sldSz");
    sldSz.attrs.set("cx", "12192000");
    sldSz.attrs.set("cy", "6858000");
    protoParts = [];
  } else {
    pkg = Package.load(fs.readFileSync(templatePath));
    // порядок слайдов — как в presentation.xml
    const pres = pkg.parts.get("/ppt/presentation.xml");
    const sldIdLst = findLocal(pres.xmlEl, "sldIdLst");
    protoParts = [];
    for (const c of sldIdLst.children) {
      if (c instanceof El && c.local === "sldId") {
        const rid = c.attrs.get(`{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id`);
        const rel = pres.rels.get(rid);
        if (rel) protoParts.push(pkg.parts.get(rel.target));
      }
    }
  }
  // k из фактического sldSz.cx (python: prs.slide_width / 1280) — 4:3 и
  // нестандартные размеры CLONE масштабируются тем же правилом, один k на обе оси
  const k = (() => {
    const pres = pkg.parts.get("/ppt/presentation.xml");
    const sldSz = findLocal(pres.xmlEl, "sldSz");
    return parseInt(sldSz.attrs.get("cx"), 10) / 1280;
  })();

  // layout for new slides: blank layout (6) для no_theme; layout прото иначе
  let blankLayout = null;
  if (noTheme) {
    const presPart = pkg.parts.get("/ppt/presentation.xml");
    const masterRel = presPart.rels.findByReltype("slideMaster");
    const master = pkg.parts.get(masterRel.target);
    const layoutRels = [...master.rels.values()].filter((r) => r.reltype === RT.SLIDE_LAYOUT);
    // python-pptx slide_layouts[6] — седьмой layout мастера (порядок sldLayoutIdLst в master xml)
    const sldLayoutIdLst = findLocal(master.xmlEl, "sldLayoutIdLst");
    const layoutOrder = sldLayoutIdLst.children.filter((c) => c instanceof El && c.local === "sldLayoutId")
      .map((c) => master.rels.get(c.attrs.get(`{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id`)).target);
    blankLayout = pkg.parts.get(layoutOrder[6]);
    void layoutRels;
  }

  const promptTexts = new Set();
  const ownerParts = [
    ...protoParts,
    ...collectLayoutMasterParts(pkg),
  ];
  for (const part of ownerParts) {
    if (!part || !part.xmlEl) continue;
    for (const n of part.xmlEl.iter()) {
      if (n instanceof El && n.local === "t" && n.ns === NS_A) {
        const txt = n.children.filter((c) => typeof c === "string").join("");
        if (txt.trim()) promptTexts.add(txt.trim());
      }
    }
  }

  // --- PptxGenJS adapter (production): content-only временная дека, графтится в shell.
  // Legacy element/chart writers удалены (§5.6/§6.4); сбой адаптера — exit 3. ---
  let contentPkg = null;
  let pageElements = [];
  {
    const adapter = require("./pptxgen-adapter.cjs");
    const pres = pkg.parts.get("/ppt/presentation.xml");
    const sldSz = findLocal(pres.xmlEl, "sldSz");
    pageElements = protos.map((m) => {
      const spec = m.page.spec;
      const els = _list(spec.elements).map((el) =>
        (el && el.type === "image" && String(el.src || "").toLowerCase().endsWith(".svg")) ? { ...el, __svg: true } : el);
      const bg = spec.background;
      if (bg && bg.type === "image") {
        if (String(bg.src || "").toLowerCase().endsWith(".svg")) els.unshift({ __bg: true, __svg: true, type: "image", src: bg.src, bounds: [0, 0, 1280, 720], bleed: true });
        else els.unshift({ __bg: true, type: "image", src: bg.src, bounds: [0, 0, 1280, 720], bleed: true });
      }
      return els;
    });
    try {
      const buf = await adapter.renderContentDeck(protos.map((m, i) => ({ ...m.page, spec: { ...m.page.spec, elements: pageElements[i] } })),
                                                  { k, projectDir, slideWEmu: parseInt(sldSz.attrs.get("cx"), 10), slideHEmu: parseInt(sldSz.attrs.get("cy"), 10) });
      contentPkg = Package.load(buf);
    } catch (e) {
      bFail(3, { error: `pptxgen adapter: ${e.message}`,
                 suggestion: "сбой адаптера сборки — legacy fallback отсутствует; сообщите в багрепорт со спекой страниц" });
    }
  }

  const newSlides = [];
  for (let mi = 0; mi < protos.length; mi++) {
    const m = protos[mi];
    const item = m.page;
    const layoutPart = noTheme ? blankLayout : layoutOfSlidePart(pkg, protoParts[m.proto - 1]);
    const slide = addSlide(pkg, layoutPart);
    // placeholders клонируются из layout и тут же удаляются — чистый список, id counter live
    const spTree = findL(findL(slide.xmlEl, "cSld"), "spTree");
    if (!noTheme) {
      copyDecor(pkg, protoParts[m.proto - 1], slide, mediaClass);
    }
    const spec = item.spec;
    const bg = spec.background;
    if (bg && (bg.type === "solid" || bg.type === "gradient")) {
      setBgSolidOrGradient(slide.xmlEl, bg);
    } else if (noTheme) {
      setBgSolidOrGradient(slide.xmlEl, { type: "solid", color: "#FFFFFF" });
    }
    {
      const adapter = require("./pptxgen-adapter.cjs");
      const els = pageElements[mi];
      const contentSlide = contentPkg.parts.get(`/ppt/slides/slide${mi + 1}.xml`);
      if (!contentSlide) bFail(3, { error: `pptxgen adapter: content slide ${mi + 1} отсутствует` });
      // SVG — native custGeom в shell (не через PptxGenJS); контент-пары без них
      const contentEls = els.filter((e) => !e.__svg);
      // id base до графта (legacy nextShapeId-семантика: последовательно от max)
      let nid = nextShapeId(spTree);
      const grafted = adapter.graftSlideContent(spTree, contentSlide, contentEls, {
        importImageRel: (blob, el) => allocImageRel(pkg, slide, projectDir, el.src),
        k,
        pkg,
        shellSlidePart: slide,
        chartTextRgb: _chartTextRgb(ctx, item),
      });
      // interleave: фигуры попадают в spTree строго в порядке els (z-order)
      const { addSvg } = require("./svgshape.cjs");
      const allShapes = [];
      let gi = 0;
      for (let ei = 0; ei < els.length; ei++) {
        const el = els[ei];
        if (el.__svg) {
          const b = el.bounds;
          const svgFill = _svgFill(ctx, item, el);
          const res = addSvg(spTree, nid, fs.readFileSync(path.join(projectDir, "media", String(el.src).replace(/^media\//, "")), "utf8"),
                             pxEmu(b[0], k), pxEmu(b[1], k), pxEmu(b[2], k), pxEmu(b[3], k),
                             { rotation: el.rotation ?? null, flip: el.flip ?? null, opacity: el.opacity ?? null, fillOverride: svgFill });
          allShapes.push(res.first);
          // addSvg расходует ids для группы/детей
          nid = res.nextId;
          if (!el.__bg) setShapeNameDescr(res.first, el.id || `el-${item.idx}-${ei}`, `gid:${item.idx}:${ei}`);
          continue;
        }
        const sh = grafted[gi++];
        for (const nvtag of ["nvSpPr", "nvPicPr", "nvGraphicFramePr", "nvGrpSpPr"]) {
          const nv = findL(sh, nvtag);
          const cNvPr = nv ? findL(nv, "cNvPr") : null;
          if (cNvPr) { cNvPr.attrs.set("id", String(nid)); break; }
        }
        nid++;
        if (!el.__bg) setShapeNameDescr(sh, el.id || `el-${item.idx}-${ei}`, `gid:${item.idx}:${ei}`);
        spTree.children.push(sh);
        allShapes.push(sh);
      }
      // z-order: все фигуры уже в spTree в порядке els; bg image в начало (после grpSpPr)
      const bgIdx = els.findIndex((e) => e.__bg);
      if (bgIdx >= 0) {
        const bgEl = allShapes[bgIdx];
        spTree.children.splice(spTree.children.indexOf(bgEl), 1);
        spTree.children.splice(2, 0, bgEl);
      }
      newSlides.push(slide);
    }
  }

  for (const s of protoParts) deleteSlide(pkg, s);

  // --- leaked text check ---
  const decorTexts = new Set();
  if (!noTheme) {
    for (const m of protos) {
      const spTreeP = findL(findL(protoParts[m.proto - 1].xmlEl, "cSld"), "spTree");
      for (const sh of spTreeP.children) {
        if (!(sh instanceof El)) continue;
        const nv = findShapeName(sh);
        if (DECOR_NAMES.has(nv)) {
          for (const t of sh.iter()) {
            if (t instanceof El && t.local === "t" && t.ns === NS_A) {
              const txt = t.children.filter((c) => typeof c === "string").join("");
              if (txt.trim()) decorTexts.add(txt.trim());
            }
          }
        }
      }
    }
  }
  const specTexts = new Set();
  for (const item of pages) {
    for (const el of _list(item.spec.elements)) {
      if (!_obj(el)) continue;
      if (el.type === "text") {
        for (const p of _list(el.paragraphs)) {
          for (const r of _list((_obj(p) ? p : {}).runs)) {
            if (_obj(r) && String(r.text || "").trim()) specTexts.add(String(r.text).trim());
          }
        }
      }
      if (el.type === "table") {
        for (const row of _list((el.table || {}).rows)) {
          for (const c of _list(row)) {
            if (_obj(c) && String(c.text || "").trim()) specTexts.add(String(c.text).trim());
          }
        }
      }
      if (el.type === "chart" && (el.chart || {}).title) specTexts.add(String(el.chart.title).trim());
    }
  }
  const leaked = [];
  for (const slide of newSlides) {
    for (const t of slide.xmlEl.iter()) {
      if (!(t instanceof El) || t.local !== "t" || t.ns !== NS_A) continue;
      const txt = t.children.filter((c) => typeof c === "string").join("").trim();
      if (txt && promptTexts.has(txt) && !specTexts.has(txt) && !decorTexts.has(txt)) {
        leaked.push(txt);
      }
    }
  }
  if (leaked.length) {
    bFail(3, { error: `в выходной деке чужой текст шаблона: [${[...new Set(leaked)].sort().slice(0, 5).map((x) => "'" + x.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'").join(", ")}]`,
               suggestion: "это регресс декор-whitelist — сообщите в багрепорт со спекой страниц" });
  }

  fs.writeFileSync(a.outPath, pkg.save());

  if (process.env.DECK_SKIP_RENDER) {
    console.log(`OK: build (${a.mode}) — ${pages.length} страниц → ${a.outPath} (рендер пропущен: DECK_SKIP_RENDER)`);
    return 0;
  }
  const [shots, thumbs, nBad] = renderAndThumbs(a.outPath, a.deckDir, a.app, pages.length);
  if (nBad) {
    const mapping = protos.map((m, i) => `${i + 1}=${m.file}`).join("; ");
    console.log(`verify: номера слайдов выше → файлы страниц: ${mapping}`);
  }
  console.log(`OK: build (${a.mode}) — ${pages.length} страниц → ${a.outPath}`);
  console.log(`шаблон: ${templatePath} · атлас: ${atlasDir} (свежий)`);
  for (const m of protos) console.log(`прото: ${m.file} → ${m.proto} (${m.how})`);
  return 0;
}

function collectLayoutMasterParts(pkg) {
  const out = [];
  for (const part of pkg.parts.values()) {
    if (/slideLayouts\/slideLayout\d+\.xml$/.test(part.partname) || /slideMasters\/slideMaster\d+\.xml$/.test(part.partname)) out.push(part);
  }
  return out;
}

function layoutOfSlidePart(pkg, slidePart) {
  const rel = slidePart.rels.findByReltype("slideLayout");
  return rel ? pkg.parts.get(rel.target) : null;
}

function findShapeName(shEl) {
  for (const n of shEl.iter()) {
    if (n instanceof El && n.local === "cNvPr") return n.attrs.get("name") || null;
  }
  return null;
}

function setShapeNameDescr(shEl, name, descr) {
  for (const nvtag of ["nvSpPr", "nvPicPr", "nvGraphicFramePr", "nvGrpSpPr"]) {
    const nv = findL(shEl, nvtag);
    const cNvPr = nv ? findL(nv, "cNvPr") : null;
    if (cNvPr) {
      cNvPr.attrs.set("name", name);
      cNvPr.attrs.set("descr", descr);
      return;
    }
  }
}

// image rel allocation: get_or_add_image_part (sha1 dedup) + relate to slide
const _imageParts = new Map(); // per-process pkg → Map(sha1 → partname)
function allocImageRel(pkg, slidePart, projectDir, src) {
  const fpath = path.join(projectDir, "media", src.startsWith("media/") ? src.slice(6) : src);
  const blob = fs.readFileSync(fpath);
  const sha1 = crypto.createHash("sha1").update(blob).digest("hex");
  let bySha = _imageParts.get(pkg);
  if (!bySha) {
    bySha = new Map();
    _imageParts.set(pkg, bySha);
    // pre-populate из существующих image parts пакета
    for (const part of pkg.parts.values()) {
      if (part.partname.startsWith("/ppt/media/") && part.blob) {
        bySha.set(crypto.createHash("sha1").update(part.blob).digest("hex"), part.partname);
      }
    }
  }
  let partname = bySha.get(sha1);
  if (!partname) {
    const ext = imageExt(blob, fpath);
    partname = pkg.nextImagePartname(ext);
    const part = pkg.addPart(new Part(pkg, partname, require("./opc.cjs").IMAGE_CONTENT_TYPES[ext]));
    part.blob = blob;
    bySha.set(sha1, partname);
  }
  return slidePart.rels.relateTo(RT.IMAGE, partname);
}

function imageExt(blob, fpath) {
  // python-pptx: canonical ext по content sniffing (Image.from_file → ext_map)
  const { imageInfo } = require("../unpack/image.cjs");
  const info = imageInfo(blob, path.extname(fpath).slice(1).toLowerCase());
  const map = { png: "png", jpeg: "jpg", gif: "gif", bmp: "bmp" };
  const ext = map[info.format];
  if (!ext) throw new Error(`unsupported image format: ${fpath}`);
  return ext;
}

module.exports = { run, check, _collect, USAGE_BUILD };
