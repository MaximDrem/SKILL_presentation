// unit3.cjs — golden suites: colors, text_parse, styles, grammar, typical.
'use strict';
const { test } = require("node:test");
const { loadUnit, assertDeepEqual, normNumKeys } = require("../lib/oracle.cjs");
const uooxml = require("../../tools/helpers/unpack/ooxml.cjs");
const ucolors = require("../../tools/helpers/unpack/colors.cjs");
const ustyles = require("../../tools/helpers/unpack/styles.cjs");
const utext = require("../../tools/helpers/unpack/text.cjs");
const ugrammar = require("../../tools/helpers/unpack/grammar.cjs");
const typical = require("../../tools/helpers/typical.cjs");

const CLR_MAP = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2", accent1: "accent1" };
const THEME = { dk1: "1A1A1A", lt1: "FFFFFF", dk2: "0A0F1F", lt2: "F2F2F7", accent1: "2FE7C4" };

test("golden colors: cases", () => {
  const g = loadUnit("colors.json");
  for (const c of g.cases) {
    const node = uooxml.parseXml(c.xml);
    let got;
    if (c.name.startsWith("grad")) got = ucolors.parseGradXml(node, CLR_MAP, THEME);
    else if (c.name.startsWith("shadow")) got = ucolors.parseShadow(node, CLR_MAP, THEME, 1.0);
    else if (c.name.startsWith("ln_")) got = ucolors.parseLn(node, CLR_MAP, THEME);
    else if (c.name.startsWith("fill_")) got = ucolors.parseFill(node, CLR_MAP, THEME);
    else got = ucolors.parseColor(node, CLR_MAP, THEME);
    assertDeepEqual(got, c.expected, `colors ${c.name}`);
  }
});

test("golden colors: funcs", () => {
  const g = loadUnit("colors.json");
  for (const [h, v] of Object.entries(g.funcs.hex_to_rgb)) assertDeepEqual(ucolors.hexToRgb(h), v, `hexToRgb ${h}`);
  for (const [k, v] of Object.entries(g.funcs.rgb_to_hex)) {
    const rgb = JSON.parse(k.replace(/^\(/, "[").replace(/\)$/, "]"));
    assertDeepEqual(ucolors.rgbToHex(rgb), v, `rgbToHex ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.rgb_to_hsl)) {
    const rgb = JSON.parse(k.replace(/^\(/, "[").replace(/\)$/, "]"));
    assertDeepEqual(ucolors.rgbToHsl(rgb), v, `rgbToHsl ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.hsl_to_rgb)) {
    const hsl = JSON.parse(k.replace(/^\(/, "[").replace(/\)$/, "]"));
    assertDeepEqual(ucolors.hslToRgb(hsl), v, `hslToRgb ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.geo_facts)) {
    const b = JSON.parse(k);
    assertDeepEqual(ucolors.geoFacts(b), v, `geoFacts ${k}`);
  }
  const ns = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
  for (const [k, v] of Object.entries(g.funcs.apply_color_mods)) {
    const [base, mod, val] = k.split("|");
    const xml = `<a:srgbClr ${ns} val="${base}"><a:${mod} val="${Math.trunc(parseFloat(val) * 100000)}"/></a:srgbClr>`;
    assertDeepEqual(ucolors.applyColorMods(base, uooxml.parseXml(xml)), v, `mods ${k}`);
  }
});

test("golden text_parse: bodies", () => {
  const g = loadUnit("text_parse.json");
  const ctxBase = {
    clrMap: { tx1: "dk1", bg1: "lt1" }, theme: { dk1: "1A1A1A", lt1: "FFFFFF" },
    themeFonts: { major: "SB Sans Display", minor: "SB Sans Text" },
    rels: { rId5: { Target: "https://example.com/", Type: "..hyperlink.." } },
    chain: [],
  };
  for (const c of g.cases) {
    if (c.name === "chain_sz") continue;
    const counters = { fonts: {}, sizes: {}, colors: {} };
    const node = uooxml.parseXml(c.xml);
    const got = utext.parseText(node, { ...ctxBase }, counters);
    const bodyPr = utext.parseBodyPr(node);
    assertDeepEqual(normNumKeys({ paragraphs: got, bodyPr, counters }), normNumKeys({ paragraphs: c.paragraphs, bodyPr: c.bodyPr, counters: c.counters }), `text_parse ${c.name}`);
  }
  // chain_sz
  const chain = [{ 2: { sz: 22.0, fontRaw: "Chain Font", colorNode: null }, 1: { sz: 18.0 } }, { 1: { sz: 28.0, b: true } }];
  const counters = { fonts: {}, sizes: {}, colors: {} };
  const simpleXml = g.cases.find((c) => c.name === "simple").xml;
  const got = utext.parseText(uooxml.parseXml(simpleXml), { ...ctxBase, chain }, counters);
  const expected = g.cases.find((c) => c.name === "chain_sz");
  assertDeepEqual(normNumKeys({ paragraphs: got, counters }), normNumKeys({ paragraphs: expected.paragraphs, counters: expected.counters }), "text_parse chain_sz");
});

test("golden styles", () => {
  const g = loadUnit("styles.json");
  const lvl = ustyles.parseLvlStyles(uooxml.parseXml(g.xml_lvl));
  const lvlSer = Object.fromEntries(Object.entries(lvl).map(([k, v]) => [k,
    { ...v, ...(v.colorNode ? { colorNode: "<node>" } : {}) }]));
  assertDeepEqual(lvlSer, g.lvl, "lvl styles");
  assertDeepEqual(ustyles.parseTxStyles(uooxml.parseXml(g.xml_master)), g.tx, "tx styles");
  const ph = ustyles.parsePhLstStyles(uooxml.parseXml(g.xml_part));
  const phSer = Object.fromEntries(Object.entries(ph).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, { ...vv, ...(vv.colorNode ? { colorNode: "<node>" } : {}) }]))]));
  assertDeepEqual(phSer, g.ph, "ph styles");
  for (const [t, v] of Object.entries(g.funcs.tx_style_class)) {
    assertDeepEqual(ustyles.txStyleClass(t === "None" ? null : t), v, `tx_style_class ${t}`);
  }
  for (const [name, v] of Object.entries(g.funcs.resolve_chain)) {
    const inputs = {
      first_hit: [[{ 1: { sz: 11 } }, { 1: { sz: 22 } }], 1, "sz"],
      second_hit: [[{ 1: {} }, { 1: { sz: 22 } }], 1, "sz"],
      lvl_fallback: [[{ 2: { sz: 33 } }], 2, "sz"],
      lvl_missing_to_1: [[{ 1: { sz: 44 } }], 3, "sz"],
      miss: [[{ 1: {} }], 1, "sz"],
      empty: [[], 1, "sz"],
    };
    const [chain, lvl2, key] = inputs[name];
    assertDeepEqual(ustyles.resolveChain(chain, lvl2, key), v, `resolve_chain ${name}`);
  }
});

test("golden grammar", () => {
  const g = loadUnit("grammar.json");
  const input = g.input.map((el) => deepCopyPy(el));
  function deepCopyPy(v) {
    const { isPyFloat, PyFloat } = require("../../tools/helpers/jsonpy.cjs");
    if (isPyFloat(v)) return new PyFloat(v.v);
    if (Array.isArray(v)) return v.map(deepCopyPy);
    if (v !== null && typeof v === "object") {
      const out = {};
      for (const [k, x] of Object.entries(v)) out[k] = deepCopyPy(x);
      return out;
    }
    return v;
  }
  assertDeepEqual(ugrammar.atlasToPageGrammar(input), g.expected, "atlas_to_page_grammar");
  for (const [k, v] of Object.entries(g.funcs.page_run)) {
    const r = k === "None" ? null : JSON.parse(k);
    assertDeepEqual(ugrammar.pageRun(r), v, `page_run ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.page_para)) {
    assertDeepEqual(ugrammar.pagePara(JSON.parse(k)), v, `page_para ${k}`);
  }
});

test("golden typical", () => {
  const g = loadUnit("typical.json");
  for (const c of g.cases) {
    const got = typical.typicalExample(c.input, "content", 3, c.media_class, (b) => `media/${b}`);
    assertDeepEqual(got, c.expected, "typical_example");
    assertDeepEqual(typical.dumpExampleLines(got), g.dump_lines, "dump_example_lines");
  }
  for (const [k, v] of Object.entries(g.funcs.dsl_color)) {
    assertDeepEqual(typical.dslColor(JSON.parse(k)), v, `dsl_color ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.dsl_fill)) {
    assertDeepEqual(typical.dslFill(JSON.parse(k)), v, `dsl_fill ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.clamp_canvas)) {
    assertDeepEqual(typical.clampCanvas(JSON.parse(k)), v, `clamp_canvas ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.placeholder)) {
    const m = k.match(/^\((\[.*\]), (\d+), (True|False)\)$/);
    assertDeepEqual(typical._placeholder(JSON.parse(m[1]), +m[2], m[3] === "True"), v, `placeholder ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.fits_width)) {
    const m = k.match(/^(.*)\|(\d+)\|(\d+)$/);
    assertDeepEqual(typical._fitsWidth(m[1], +m[2], m[1] === "Заголовок" && +m[2] === 40, +m[3]), v, `fits_width ${k}`);
  }
});
