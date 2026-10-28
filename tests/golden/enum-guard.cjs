// enum-guard.cjs — prototype-ключи (toString/constructor/__proto__/hasOwnProperty)
// не проходят enum-проверки chart.kind/align/anchor (own-property semantics).
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const validate = require("../../tools/helpers/builder/validate.cjs");

const PROTO_KEYS = ["toString", "constructor", "__proto__", "hasOwnProperty"];

function vfail(el) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "enum-guard-"));
  return validate.validate({ projectDir: d, theme: "dark", mode: "create" },
    [{ file: "slide-01.json", spec: { pageType: "content", proto: 1, elements: [el] } }]);
}

const chartOf = (kind) => ({ id: "c", type: "chart", bounds: [60, 100, 400, 300],
  chart: { kind, series: [{ name: "s", values: [1, 2] }], categories: ["a", "b"] } });
const textAlign = (align) => ({ id: "t", type: "text", bounds: [60, 100, 200, 40],
  paragraphs: [{ runs: [{ text: "x", sz: 18 }], align }] });
const cellAlign = (align) => ({ id: "tb", type: "table", bounds: [60, 100, 400, 100],
  table: { colW: [400], rows: [[{ text: "x", align }]] } });
const anchorEl = (anchor) => ({ id: "t", type: "text", bounds: [60, 100, 200, 40], anchor,
  paragraphs: [{ runs: [{ text: "x", sz: 18 }] }] });

test("enum-guard: chart.kind отклоняет prototype-ключи", () => {
  for (const k of PROTO_KEYS) {
    const fails = vfail(chartOf(k));
    assert.ok(fails.some((f) => /chart\.kind/.test(f.msg)), `${k}: ${JSON.stringify(fails)}`);
  }
  assert.ok(!vfail(chartOf("bar")).some((f) => /chart\.kind/.test(f.msg)));
});

test("enum-guard: paragraphs[].align отклоняет prototype-ключи", () => {
  for (const k of PROTO_KEYS) {
    const fails = vfail(textAlign(k));
    assert.ok(fails.some((f) => /align/.test(f.msg)), `${k}: ${JSON.stringify(fails)}`);
  }
  assert.ok(!vfail(textAlign("ctr")).some((f) => /align/.test(f.msg)));
});

test("enum-guard: table cell align отклоняет prototype-ключи", () => {
  for (const k of PROTO_KEYS) {
    const fails = vfail(cellAlign(k));
    assert.ok(fails.some((f) => /align/.test(f.msg)), `${k}: ${JSON.stringify(fails)}`);
  }
  assert.ok(!vfail(cellAlign("r")).some((f) => /align/.test(f.msg)));
});

test("enum-guard: anchor отклоняет prototype-ключи", () => {
  for (const k of PROTO_KEYS) {
    const fails = vfail(anchorEl(k));
    assert.ok(fails.some((f) => /anchor/.test(f.msg)), `${k}: ${JSON.stringify(fails)}`);
  }
  assert.ok(!vfail(anchorEl("ctr")).some((f) => /anchor/.test(f.msg)));
});

test("enum-guard: __proto__ доходит до валидатора как own key", () => {
  // JSON.parse-style парсер: __proto__ — own data property, не сеттер прототипа
  const { parse } = require("../../tools/helpers/jsonpy.cjs");
  const el = parse('{"id":"t","type":"text","bounds":[60,100,200,40],"anchor":"__proto__","paragraphs":[{"runs":[{"text":"x","sz":18}]}]}');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(el, "anchor"), true);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "enum-guard-"));
  const fails = validate.validate({ projectDir: d, theme: "dark", mode: "create" },
    [{ file: "slide-01.json", spec: { pageType: "content", proto: 1, elements: [el] } }]);
  assert.ok(fails.some((f) => /anchor/.test(f.msg)), JSON.stringify(fails));
});
