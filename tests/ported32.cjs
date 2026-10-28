// ported32.cjs — 32 теста из SKILL_WORK/tests/run_tests.py (v3.2.1), перенесённые
// на CJS-модули. Интеграционные — на checked-in tiny-clone fixture.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { FIX, SKILL_JS } = require("./lib/oracle.cjs");

const textfit = require("../tools/helpers/builder/textfit.cjs");
const overlap = require("../tools/helpers/builder/overlap.cjs");
const validate = require("../tools/helpers/builder/validate.cjs");
const proto = require("../tools/helpers/builder/proto.cjs");
const qa = require("../tools/helpers/builder/qa.cjs");

const DECK = path.join(SKILL_JS, "tools", "deck.cjs");
const TINY = path.join(FIX, "tiny-clone.pptx");

function textEl(text, bounds, { sz = 18, b = false, run = {}, para = {}, ...kw } = {}) {
  return { id: "t", type: "text", bounds,
           paragraphs: [{ runs: [{ text, sz, b, ...run }], ...para }], ...kw };
}
const pageOf = (el, file = "slide-01.json") => ({ file, spec: { pageType: "content", proto: 1, elements: [el] } });
const hardOf = (el) => textfit.textfitCheck([pageOf(el)])[0];

function vfail(el) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "vfail-"));
  return validate.validate({ projectDir: d, theme: "dark", mode: "create" }, [pageOf(el)]);
}

function runDeck(args, envExtra) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(GIGATOOL_|MULTITOOL_|DECK_)/.test(k)) delete env[k];
    else if (/^ELECTRON_/.test(k) && k !== "ELECTRON_RUN_AS_NODE") delete env[k];
  }
  Object.assign(env, envExtra || {});
  try {
    const stdout = execFileSync(process.execPath, [DECK, ...args], { env, encoding: "utf8", timeout: 600000 });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() || "", stderr: e.stderr?.toString() || "" };
  }
}

function ensureTinyAtlas() {
  const ref = path.join(FIX, ".tiny-ref-test");
  if (!fs.existsSync(path.join(ref, "proto.json"))) {
    const r = runDeck(["unpack", TINY, "--out", ref, "--with-pages", "--no-decor-thumbs"]);
    assert.strictEqual(r.code, 0, r.stderr.slice(0, 500));
  }
  return ref;
}

// ---------- textfit ----------

test("t_width_token", () => {
  const h = hardOf(textEl("Переключения", [884, 300, 312, 90], { sz: 30, b: true }));
  assert.ok(h.length && h[0].msg.includes("Переключения"), JSON.stringify(h));
  assert.ok(!h[0].msg.includes("секунд"));
  assert.ok(!h[0].msg.includes("≤215"));
});

test("t_width_sz_sane", () => {
  const h = hardOf(textEl("Конфиденциальность", [900, 100, 60, 40], { sz: 10 }));
  assert.ok(h.length && !h[0].msg.includes("≤12pt") && !h[0].msg.includes("≤13pt"));
});

test("t_height_wrap_w_option", () => {
  const h = hardOf(textEl("Корпоративная безопасность", [104, 34, 660, 62], { sz: 28, b: true }));
  assert.ok(h.length, "ожидался HARD");
  assert.ok(h[0].msg.includes("увеличьте w"), h[0].msg);
  assert.ok(h[0].msg.includes("строки") || (h[0].detail || "").includes("строки"));
});

test("t_height_plain", () => {
  const h = hardOf(textEl("Строка один\nСтрока два\nСтрока три", [66, 200, 500, 60], { sz: 18 }));
  assert.ok(h.length && h[0].msg.includes("увеличьте h до ≥"));
  assert.ok((h[0].action || "").includes("h→84"), h[0].action);
});

test("t_shorten_clamp", () => {
  const h = hardOf(textEl("абв", [1200, 40, 20, 500], { sz: 400 }));
  assert.ok(h.length);
  assert.ok(!h[0].msg.includes("≤3 символов (сейчас 3)"), "N>=M регрессия");
});

test("t_font_k_wider", () => {
  const base = textEl("Корпоративная безопасность", [104, 34, 660, 62], { sz: 28, b: true });
  const sameCg = textEl("Корпоративная безопасность", [104, 34, 660, 62], { sz: 28, b: true, run: { font: "Century Gothic" } });
  const w1 = textfit._fullLineW(base);
  const w2 = textfit._fullLineW(sameCg);
  assert.ok(w2 > w1 * 1.08, `Century Gothic обязан быть шире SB Sans: ${w1.toFixed(0)} vs ${w2.toFixed(0)}`);
});

test("t_junk_no_crash", () => {
  const el = { id: "x", type: "text", bounds: [66, 60, 900, 70],
               paragraphs: ["мусор", { runs: [{ text: "норм", sz: 14 }] }] };
  const [hard] = textfit.textfitCheck([pageOf(el)]);
  assert.ok(Array.isArray(hard));
  assert.ok(!hardOf(textEl("   ", [66, 60, 900, 70])).length, "whitespace-only run → ложный HARD");
});

test("t_autofit_norm_skips", () => {
  const el = textEl("Строка\nСтрока\nСтрока\nСтрока", [66, 200, 500, 40], { sz: 18 });
  el.autofit = "norm";
  assert.ok(!hardOf(el).length);
});

// ---------- overlap ----------

test("t_overlap_anchor_b", () => {
  const pages = [{ file: "t.json", spec: { elements: [
    { id: "top", type: "text", bounds: [60, 100, 200, 40], anchor: "b",
      paragraphs: [{ runs: [{ text: "Нижний якорь", sz: 40 }] }] },
    { id: "victim", type: "text", bounds: [60, 90, 200, 60],
      paragraphs: [{ runs: [{ text: "Жертва", sz: 14 }] }] }] } }];
  const [hard] = overlap.overlapCheck(pages);
  assert.ok(hard.length && JSON.stringify(hard[0]).includes("top"), JSON.stringify(hard));
  assert.ok(hard[0].msg.includes("ВВЕРХ"), hard[0].msg);
});

test("t_overlap_hard_classes", () => {
  const check = (els) => overlap.overlapCheck([{ file: "s.json", spec: { elements: els } }]);
  const txt = (i, b) => ({ id: i, type: "text", bounds: b, paragraphs: [{ runs: [{ text: "Текст заголовка", sz: 20 }] }] });
  const img = (i, b, kw = {}) => ({ id: i, type: "image", src: "media/a.png", bounds: b, ...kw });
  const shp = (i, b) => ({ id: i, type: "shape", shape: "roundRect", bounds: b, fill: { solid: "#F5F5F7" } });
  let [hard] = check([img("icon", [684, 460, 48, 48]), txt("title", [660, 488, 539, 36])]);
  assert.ok(hard.length && hard[0].msg.includes("перекрыт картинкой"));
  [hard] = check([txt("a", [60, 100, 300, 60]), txt("b", [60, 120, 300, 60])]);
  assert.ok(hard.length);
  [hard] = check([img("bg", [0, 0, 1280, 720], { bleed: true }), txt("t", [60, 100, 300, 60])]);
  assert.ok(!hard.length);
  [hard] = check([shp("card", [60, 200, 560, 220]), txt("t", [144, 226, 440, 36]), img("ic", [84, 220, 48, 48])]);
  assert.ok(!hard.length);
  let warn;
  [hard, warn] = check([img("a", [100, 100, 200, 200]), img("b", [250, 100, 200, 200])]);
  assert.ok(!hard.length && warn.length && warn[0].includes("править не обязательно"));
  [hard, warn] = check([img("a", [100, 100, 300, 300]), img("b", [150, 150, 48, 48])]);
  assert.ok(!hard.length && !warn.length);
});

test("t_overlap_text_shape", () => {
  const check = (els) => overlap.overlapCheck([{ file: "s.json", spec: { elements: els } }]);
  const txt = (i, b, c = "#FFFFFF", sz = 20) => ({ id: i, type: "text", bounds: b, paragraphs: [{ runs: [{ text: "Текст заголовка", sz, color: c }] }] });
  const shp = (i, b, f, kw = {}) => ({ id: i, type: "shape", shape: "roundRect", bounds: b, fill: f, ...kw });
  let [hard] = check([txt("title", [64, 100, 800, 56], undefined, 30), shp("line", [60, 118, 500, 3], { solid: "#F59E0B" })]);
  assert.ok(hard.length && hard[0].msg.includes("накрыт фигурой"), JSON.stringify(hard));
  [hard] = check([shp("ring", [-160, -220, 520, 520], { solid: "#FFFFFF" }), txt("title", [64, 202, 620, 72])]);
  assert.ok(hard.length && hard[0].action === "color→#1A1A1A", JSON.stringify(hard));
  [hard] = check([shp("bar", [60, 0, 10, 70], { solid: "#FBBF24" }), txt("kicker", [60, 56, 500, 28], "#EA580C", 13)]);
  assert.ok(!hard.length);
  [hard] = check([shp("card", [60, 200, 560, 220], { solid: "#F5F5F7" }), txt("t", [84, 220, 512, 36], "#1A1A1A")]);
  assert.ok(!hard.length);
  [hard] = check([txt("t", [64, 100, 500, 40], "#1A1A1A"), shp("under", [64, 150, 120, 3], { solid: "#B85042" })]);
  assert.ok(!hard.length);
  [hard] = check([txt("t", [64, 100, 500, 40], "#1A1A1A"), shp("frame", [60, 95, 520, 50], { none: true })]);
  assert.ok(!hard.length);
});

test("t_textfit_never_grows_into_neighbor", () => {
  const title = textEl("Экономия времени", [96, 210, 480, 96], { sz: 44, b: true });
  const body = textEl("До 30–50% времени на рутинные операции", [96, 320, 480, 70], { sz: 17 });
  const [hard] = textfit.textfitCheck([{ file: "slide-06.json", spec: { pageType: "content", proto: 1, elements: [title, body] } }]);
  assert.ok(hard.length, "ожидался HARD");
  assert.ok(!(hard[0].action || "").startsWith("h→"), hard[0].action);
  assert.ok(!hard[0].msg.includes("увеличьте h"), hard[0].msg);
  const [hard2] = textfit.textfitCheck([{ file: "s.json", spec: { pageType: "content", proto: 1, elements: [title] } }]);
  assert.ok(hard2.length && (hard2[0].action || "").startsWith("h→"), JSON.stringify(hard2));
});

test("t_overlap_empty_paras", () => {
  const pages = [{ file: "t.json", spec: { elements: [
    { id: "a", type: "text", bounds: [60, 100, 200, 40], paragraphs: [] },
    { id: "b", type: "text", bounds: [60, 100, 200, 40], paragraphs: [{ runs: [{ text: "X", sz: 14 }] }] }] } }];
  overlap.overlapWarnings(pages);
});

// ---------- validate ----------

test("t_validate_sz_range", () => {
  let f = vfail(textEl("x", [66, 60, 900, 70], { sz: 0 }));
  assert.ok(f.length && f[0].msg.includes("1–4000"), JSON.stringify(f));
  f = vfail(textEl("x", [66, 60, 900, 70], { sz: 5000 }));
  assert.ok(f.length, "sz>4000 должен фейлить");
});

test("t_validate_cell_color", () => {
  const f = vfail({ id: "tb", type: "table", bounds: [66, 100, 600, 200],
                    table: { colW: [300, 300], rows: [[{ text: "A", color: "red" }, { text: "B" }]] } });
  assert.ok(f.length && f[0].msg.includes("color"), JSON.stringify(f));
});

test("t_validate_gradient_color", () => {
  const el = textEl("x", [66, 60, 900, 70], { sz: 14 });
  el.paragraphs[0].runs[0].color = { stops: [["поз", "#FFF"]] };
  const f = vfail(el);
  assert.ok(f.length && f[0].msg.toLowerCase().includes("gradient"), JSON.stringify(f));
});

test("t_validate_bounds_missing", () => {
  const f = vfail({ id: "x", type: "text", paragraphs: [{ runs: [{ text: "y", sz: 14 }] }] });
  assert.ok(f.length && !f[0].msg.includes("дробн") && f[0].msg.includes("обязател"), JSON.stringify(f));
});

test("t_validate_canvas_defaults", () => {
  const card = { id: "c", type: "shape", shape: "roundRect", bounds: [906, 230, 380, 340], fill: { solid: "#1D254D" } };
  let f = vfail(card);
  assert.ok(f.length && f[0].msg.includes("bounds→") && f[0].msg.includes("bleed:true — только"), JSON.stringify(f));
  const blob = { id: "d", type: "shape", shape: "ellipse", bounds: [1200, 600, 200, 200], fill: { solid: "#2FE7C4" } };
  f = vfail(blob);
  assert.ok(f.length && f[0].action === "bleed:true", JSON.stringify(f));
});

test("t_validate_image_shadow", () => {
  const img = { id: "im", type: "image", src: "media/a.png", bounds: [100, 100, 200, 150], shadow: "soft" };
  let f = vfail(img);
  assert.ok(!f.some((x) => x.msg.includes("shadow")), JSON.stringify(f));
  img.shadow = "hard";
  f = vfail(img);
  assert.ok(f.some((x) => x.msg.includes("shadow")), "невалидный токен должен фейлить");
  img.shadow = "soft";
  img.src = "media/a.svg";
  f = vfail(img);
  assert.ok(f.some((x) => x.msg.includes("svg")), "svg+shadow должен фейлить");
});

// ---------- proto ----------

test("t_proto_defaults", () => {
  const a = { mode: "clone" };
  const pages = [pageOf(textEl("x", [66, 60, 900, 70]))];
  const info = { 5: { arch: "solid #0A0F1F" }, 7: { arch: "solid #0A0F1F" } };
  let [, fails] = proto.resolveProtos(a, pages.map((p) => ({ ...p, spec: { ...p.spec, proto: 99 } })), info, null);
  assert.ok(fails.length && fails[0].action === "proto→5", JSON.stringify(fails));
  [, fails] = proto.resolveProtos(a, pages.map((p) => ({ ...p, spec: { ...p.spec, proto: 7 } })),
                                  { 5: { arch: "solid #0A0F1F" }, 7: { arch: "solid #0A0F1F", degraded: [{ kind: "SmartArt" }] } }, null);
  assert.ok(fails.length && fails[0].action === "proto→5", JSON.stringify(fails));
});

// ---------- интеграция (tiny-clone) ----------

test("t_unpack_atlas_shape", () => {
  const ref = ensureTinyAtlas();
  const ref2 = path.join(FIX, ".tiny-ref-nopages");
  fs.rmSync(ref2, { recursive: true, force: true });
  const r = runDeck(["unpack", TINY, "--out", ref2, "--no-decor-thumbs"]);
  assert.strictEqual(r.code, 0, r.stderr.slice(0, 300));
  assert.ok(!fs.existsSync(path.join(ref2, "pages")), "pages/ не должен генериться без --with-pages");
  const protoJ = JSON.parse(fs.readFileSync(path.join(ref2, "proto.json"), "utf8"));
  assert.ok(Object.keys(protoJ).length > 0);
  const style = fs.readFileSync(path.join(ref2, "STYLE.md"), "utf8");
  for (const bad of ["pages/", "media-map.json", "fonts.json", "style.json"]) {
    assert.ok(!style.includes(bad), `STYLE.md рекламирует ${bad}`);
  }
});

test("t_unpack_corrupt", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "uc-"));
  const bad = path.join(d, "bad.pptx");
  fs.writeFileSync(bad, "not a zip");
  const r = runDeck(["unpack", bad, "--out", path.join(d, "ref")]);
  assert.ok(r.code === 2 && r.stderr.includes("поврежд"), r.stderr.slice(0, 300));
});

test("t_check_integration", () => {
  const ref = ensureTinyAtlas();
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ci-"));
  fs.mkdirSync(path.join(d, "pages"));
  fs.writeFileSync(path.join(d, "pages", "slide-01.json"), JSON.stringify({ pageType: "content", proto: 1, elements: [
    { id: "t", type: "text", bounds: [66, 60, 900, 70],
      paragraphs: [{ runs: [{ text: "Чистый заголовок", sz: 28, b: true, color: "#FFFFFF" }] }] }] }));
  const r = runDeck(["check", d, "--template", TINY, "--ref", ref]);
  assert.strictEqual(r.code, 0, r.stderr.slice(0, 500));
  assert.ok(r.stdout.includes("HARD-замечаний нет"), r.stdout);
});

test("t_check_missing_pages", () => {
  const ref = ensureTinyAtlas();
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-"));
  fs.mkdirSync(path.join(d, "pages"));
  fs.writeFileSync(path.join(d, "plan.md"), "# План — 3 слайда\n1. cover — proto 1\n2. content — proto 2\n3. closing — proto 5\n");
  fs.writeFileSync(path.join(d, "pages", "slide-01.json"), JSON.stringify({ pageType: "content", proto: 1, elements: [
    { id: "t", type: "text", bounds: [66, 60, 900, 70],
      paragraphs: [{ runs: [{ text: "Одна страница", sz: 28, color: "#FFFFFF" }] }] }] }));
  const r = runDeck(["check", d, "--template", TINY, "--ref", ref]);
  assert.ok(r.code === 2 && r.stderr.includes("slide-02.json") && r.stderr.includes("slide-03.json"), r.stderr.slice(0, 500));
});

test("t_check_collects_all_bad_json", () => {
  const ref = ensureTinyAtlas();
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cbj-"));
  fs.mkdirSync(path.join(d, "pages"));
  for (const n of ["slide-01.json", "slide-02.json"]) fs.writeFileSync(path.join(d, "pages", n), "{broken");
  const r = runDeck(["check", d, "--template", TINY, "--ref", ref]);
  assert.ok(r.code === 2);
  assert.ok(r.stderr.includes("slide-01.json") && r.stderr.includes("slide-02.json"), "оба битых файла за один прогон");
});

test("t_build_merge_and_shadow", () => {
  const ref = ensureTinyAtlas();
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bms-"));
  fs.mkdirSync(path.join(d, "pages"));
  fs.mkdirSync(path.join(d, "media"));
  fs.copyFileSync(path.join(FIX, "media", "pic.png"), path.join(d, "media", "pic.png"));
  fs.writeFileSync(path.join(d, "pages", "slide-01.json"), JSON.stringify({ pageType: "content", proto: 3, elements: [
    { id: "ph", type: "image", src: "media/pic.png", bounds: [400, 200, 400, 300], shadow: "soft" },
    { id: "tb", type: "table", bounds: [66, 100, 800, 300],
      table: { colW: [400, 400], rows: [[{ text: "A", colSpan: 2 }, { text: "" }], [{ text: "B" }, { text: "C" }]] } }] }));
  const out = path.join(d, "out.pptx");
  const r = runDeck(["build", d, "--template", TINY, "--ref", ref, "--out", out], { DECK_SKIP_RENDER: "1" });
  assert.strictEqual(r.code, 0, r.stderr.slice(0, 500));
  assert.ok(fs.existsSync(out));
  // canon-равенство с golden clone-merge нет; проверяем структуру через unpack
  const u = path.join(d, "ref2");
  // merge + shadow — по XML построенного pptx (gridSpan + effectLst)
  const { unzipSync } = require("../vendor/fflate/lib/node.cjs");
  const parts = unzipSync(new Uint8Array(fs.readFileSync(out)));
  const slide1Name = Object.keys(parts).find((n) => n.startsWith("ppt/slides/slide") && n.endsWith(".xml") && Buffer.from(parts[n]).toString().includes("gridSpan"));
  const slide1 = Buffer.from(parts[slide1Name]).toString();
  assert.ok(slide1.includes('gridSpan="2"'), "colSpan → gridSpan");
  assert.ok(slide1.includes('hMerge="1"'), "merged cell");
  assert.ok(slide1.includes('outerShdw'), "shadow effectLst");
  assert.ok(slide1.includes('blurRad="190500"'), "shadow soft blur");
  const r2 = runDeck(["unpack", out, "--out", u, "--with-pages", "--no-decor-thumbs"]);
  assert.strictEqual(r2.code, 0, r2.stderr.slice(0, 300));
  const page1 = JSON.parse(fs.readFileSync(path.join(u, "pages", "slide-01.json"), "utf8"));
  const table = page1.elements.find((e) => e.type === "table");
  assert.ok(table, "таблица в выходе");
  const pic = page1.elements.find((e) => e.type === "image");
  assert.ok(pic && pic.shadow && pic.shadow.token === "soft", "shadow soft у pic");
});

test("t_build_no_theme_blank", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bnb-"));
  fs.mkdirSync(path.join(d, "pages"));
  fs.writeFileSync(path.join(d, "pages", "slide-01.json"), JSON.stringify({ pageType: "content", proto: 1, elements: [
    { id: "t", type: "text", bounds: [66, 60, 900, 70],
      paragraphs: [{ runs: [{ text: "Тестовая страница", sz: 28, b: true, color: "#1A1A1A" }] }] }] }));
  const out = path.join(d, "out.pptx");
  const r = runDeck(["build", d, "--out", out], { DECK_SKIP_RENDER: "1" });
  assert.strictEqual(r.code, 0, r.stderr.slice(0, 500));
  assert.ok(fs.existsSync(out));
});

test("t_build_theme_copies_and_no_warn", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "btc-"));
  fs.mkdirSync(path.join(d, "pages"));
  fs.writeFileSync(path.join(d, "pages", "slide-01.json"), JSON.stringify({ pageType: "content", proto: 1, elements: [
    { id: "t", type: "text", bounds: [66, 60, 900, 70],
      paragraphs: [{ runs: [{ text: "Тёмная тема", sz: 28, b: true, color: "#FFFFFF" }] }] }] }));
  const out = path.join(d, "out.pptx");
  const r = runDeck(["build", d, "--theme", "dark", "--out", out], { DECK_SKIP_RENDER: "1" });
  assert.strictEqual(r.code, 0, r.stderr.slice(0, 500));
  assert.ok(!r.stdout.includes("WARN theme"), r.stdout);
  assert.ok(fs.existsSync(out));
});

test("t_build_no_theme_explicit_bg", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bne-"));
  fs.mkdirSync(path.join(d, "pages"));
  fs.writeFileSync(path.join(d, "pages", "slide-01.json"), JSON.stringify({ pageType: "content", proto: 1,
    background: { type: "solid", color: "#F2F2F7" }, elements: [
    { id: "t", type: "text", bounds: [66, 60, 900, 70],
      paragraphs: [{ runs: [{ text: "Явный фон", sz: 28, b: true, color: "#1A1A1A" }] }] }] }));
  const out = path.join(d, "out.pptx");
  const r = runDeck(["build", d, "--out", out], { DECK_SKIP_RENDER: "1" });
  assert.strictEqual(r.code, 0, r.stderr.slice(0, 500));
  assert.ok(fs.existsSync(out));
});

test("t_check_no_theme_warns", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cnw-"));
  fs.mkdirSync(path.join(d, "pages"));
  fs.writeFileSync(path.join(d, "pages", "slide-01.json"), JSON.stringify({ pageType: "content", proto: 1, elements: [
    { id: "t", type: "text", bounds: [66, 60, 900, 70],
      paragraphs: [{ runs: [{ text: "Проверка", sz: 28, color: "#1A1A1A" }] }] }] }));
  const r = runDeck(["check", d]);
  assert.strictEqual(r.code, 0, r.stderr.slice(0, 300));
  assert.ok(r.stdout.includes("WARN theme"), r.stdout);
});

test("t_chart_axes_scaling_and_vary_colors", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cas-"));
  fs.mkdirSync(path.join(d, "pages"));
  fs.writeFileSync(path.join(d, "pages", "slide-01.json"), JSON.stringify({ pageType: "content", proto: 1,
    background: { type: "solid", color: "#FFFFFF" }, elements: [
    { id: "ch", type: "chart", bounds: [60, 90, 560, 300],
      chart: { kind: "bar", series: [{ name: "S1", categories: ["A", "B"], values: [1, 2] }], colors: ["#8B1A1A"] } },
    { id: "pi", type: "chart", bounds: [660, 90, 560, 300],
      chart: { kind: "pie", series: [{ name: "S", categories: ["A", "B"], values: [1, 2] }], colors: ["#8B1A1A", "#E8A0A0"] } }] }));
  const out = path.join(d, "out.pptx");
  const r = runDeck(["build", d, "--out", out], { DECK_SKIP_RENDER: "1" });
  assert.strictEqual(r.code, 0, r.stderr.slice(0, 500));
  // chart XML: catAx/valAx scaling orientation + pie varyColors
  const { unzipSync } = require("../vendor/fflate/lib/node.cjs");
  const parts = unzipSync(new Uint8Array(fs.readFileSync(out)));
  const chartNames = Object.keys(parts).filter((n) => n.startsWith("ppt/charts/chart") && n.endsWith(".xml"));
  assert.strictEqual(chartNames.length, 2);
  const barXml = Buffer.from(parts["ppt/charts/chart1.xml"]).toString();
  assert.ok(barXml.includes('<c:scaling><c:orientation val="minMax"/></c:scaling>'), "valAx scaling");
  const pieXml = Buffer.from(parts["ppt/charts/chart2.xml"]).toString();
  assert.ok(pieXml.includes('<c:varyColors val="1"/>'), "pie varyColors");
  assert.ok(pieXml.includes("dPt"), "pie point colors");
});

test("t_qa_aspect_and_upscale", () => {
  const d = path.join(FIX, "qa-media");
  const mk = (els, bg) => [{ file: "s.json", spec: { pageType: "content", proto: 1, elements: els, background: bg } }];
  const bg = { type: "solid", color: "#FFFFFF" };
  let [hard, warn] = qa.qaWarnings(mk([{ id: "i", type: "image", src: "media/wide.png", bounds: [60, 200, 400, 400] }], bg), null, d);
  assert.ok(hard.length && hard[0].msg.includes("растянута"), JSON.stringify(hard));
  [hard, warn] = qa.qaWarnings(mk([{ id: "i", type: "image", src: "media/icon.png", bounds: [60, 200, 400, 400] }], bg), null, d);
  assert.ok(warn.some((w) => w.includes("мыло")), JSON.stringify(warn));
  [hard, warn] = qa.qaWarnings(mk([{ id: "i", type: "image", src: "media/big.png", bounds: [60, 200, 400, 200] }], bg), null, d);
  assert.ok(!hard.length && !warn.length, JSON.stringify([hard, warn]));
});
