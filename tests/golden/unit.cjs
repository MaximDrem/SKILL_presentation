// unit.cjs — golden-driven unit suites (oracle: SKILL_WORK v3.2.1).
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const { loadUnit, assertDeepEqual } = require("../lib/oracle.cjs");
const textfit = require("../../tools/helpers/builder/textfit.cjs");
const numfmt = require("../../tools/helpers/numfmt.cjs");

test("golden numbers: r1/r2/js_round/js_num", () => {
  const g = loadUnit("numbers.json");
  const { r1, r2, jsRound, num } = require("../../tools/helpers/unpack/ooxml.cjs");
  for (const [k, v] of Object.entries(g.r1)) assertDeepEqual(r1(parseFloat(k)), v, `r1(${k})`);
  for (const [k, v] of Object.entries(g.r2)) assertDeepEqual(r2(parseFloat(k)), v, `r2(${k})`);
  for (const [k, v] of Object.entries(g.js_round)) assertDeepEqual(jsRound(parseFloat(k)), v, `jsRound(${k})`);
  for (const [k, v] of Object.entries(g.js_num)) assertDeepEqual(require("../../tools/helpers/unpack/ooxml.cjs").jsNum(parseFloat(k)), v, `jsNum(${k})`);
  void num; void numfmt;
});

test("golden numbers: py round (ties-to-even)", () => {
  const g = loadUnit("numbers.json");
  for (const [k, v] of Object.entries(g.py_round)) assertDeepEqual(numfmt.pyRound(parseFloat(k)), v, `pyRound(${k})`);
});

test("golden numbers: js_num_str (JS-like serialization)", () => {
  const g = loadUnit("numbers.json");
  for (const [k, v] of Object.entries(g.js_num_str)) assertDeepEqual(numfmt.jsNumStr(parseFloat(k)), v, `jsNumStr(${k})`);
});

test("golden numbers: dumps / dumps_pretty / js_obj_order / js_key", () => {
  const g = loadUnit("numbers.json");
  const { PyFloat } = require("../../tools/helpers/jsonpy.cjs");
  const ucli = require("../../tools/helpers/unpack/cli.cjs");
  const F = (v) => new PyFloat(v);
  assert.strictEqual(ucli._dumps({ a: F(1.0), b: F(0.1 + 0.2), c: [F(1.5), F(-0.0), 2 ** 53], d: { e: null, f: true } }), g.dumps);
  assert.strictEqual(ucli._dumpsPretty({ a: F(1.0), b: [F(1.5), { x: "ё" }] }), g.dumps_pretty);
  const pairs = [["10", 1], ["2", 2], ["a", 3], ["01", 4], ["4294967295", 5], ["4294967294", 6], ["-1", 7], ["1.5", 8]];
  assertDeepEqual(ucli._jsObjOrder(pairs).map(([k]) => k), g.js_obj_order, "js_obj_order");
  assertDeepEqual([F(12.0), F(12.5), "x", F(0.0)].map((k) => ucli._jsKey(k instanceof PyFloat ? k.v : k)), g.js_key, "js_key");
});

test("golden textfit: cases", () => {
  const g = loadUnit("textfit.json");
  for (const c of g.cases) {
    const [hard, warn] = textfit.textfitCheck(c.pages);
    assertDeepEqual({ hard, warn }, c.expected, `textfit case ${c.name}`);
  }
});

test("golden textfit: funcs", () => {
  const g = loadUnit("textfit.json");
  const F = g.funcs;
  for (const [k, v] of Object.entries(F.char_w)) {
    const [font, bold] = k.split("|");
    const fn = (font === "null" || font === "None") ? null : font;
    const got = v.map((_, i) => textfit._charW(["A", "a", "Ж", "ж", "5", " ", "%", "→", "—", "€", "😀", "Ё", "i", "W"][i], fn, bold === "true" || bold === "True"));
    assertDeepEqual(got, v, `char_w ${k}`);
  }
  for (const [k, v] of Object.entries(F.text_w)) {
    const [font, bold] = k.split("|");
    assertDeepEqual(textfit.textW("Презентация AB 12—34", 18, bold === "bold", (font === "null" || font === "None") ? null : font), v, `text_w ${k}`);
  }
  for (const [k, v] of Object.entries(F.wrap)) {
    const idx = k.lastIndexOf("|");
    const text = k.slice(0, idx), avail = parseFloat(k.slice(idx + 1));
    assertDeepEqual(textfit._wrap(text, 18, false, avail), v, `wrap ${k}`);
  }
  const probeEls = [
    { id: "t", type: "text", bounds: [66, 60, 900, 70], paragraphs: [{ runs: [{ text: "Обычный текст для estimate", sz: 18 }] }] },
    { id: "t", type: "text", bounds: [66, 200, 500, 60], paragraphs: [{ runs: [{ text: "A\nB\nC", sz: 18 }] }] },
    { id: "t", type: "text", bounds: [884, 300, 312, 90], paragraphs: [{ runs: [{ text: "Переключения", sz: 30, b: true }] }] },
  ];
  for (const [k, v] of Object.entries(F.estimate_need)) assertDeepEqual(textfit.estimateNeed(probeEls[+k]), v, `estimate_need ${k}`);
  for (const [k, v] of Object.entries(F.widest_token)) assertDeepEqual(textfit._widestToken(probeEls[+k]), v, `widest_token ${k}`);
  for (const [k, v] of Object.entries(F.full_line_w)) assertDeepEqual(textfit._fullLineW(probeEls[+k]), v, `full_line_w ${k}`);
  for (const [k, v] of Object.entries(F.min_height_px)) {
    const [need, tol] = k.split("|").map(parseFloat);
    assertDeepEqual(textfit.minHeightPx(need, tol), v, `min_height_px ${k}`);
  }
  for (const [k, v] of Object.entries(F.max_font_pt)) assertDeepEqual(textfit.maxFontPt(probeEls[+k], 45.0, 1.08), v, `max_font_pt ${k}`);
  for (const [k, v] of Object.entries(F.font_k)) assertDeepEqual(textfit._fontK(k === "null" ? null : k), v, `font_k ${k}`);
  for (const [k, v] of Object.entries(F.family_key)) {
    const idx = k.lastIndexOf("|");
    const font = k.slice(0, idx), bold = k.slice(idx + 1) === "True";
    const got = textfit._familyKey((font === "null" || font === "None") ? null : font, bold);
    assertDeepEqual(got, v, `family_key ${k}`);
  }
});
