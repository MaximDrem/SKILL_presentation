// jsonpy.cjs — Python json.loads strictness: EOF, control chars, escapes, big ints.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const { parse, PyFloat, PyInt, isPyFloat, isPyInt, pyFloatStr, numToken, isNumeric } = require("../../tools/helpers/jsonpy.cjs");

const ERRORS = [
  ['01', 'Extra data: line 1 column 2 (char 1)'],
  ['00', 'Extra data: line 1 column 2 (char 1)'],
  ['1.', 'Extra data: line 1 column 2 (char 1)'],
  ['1e', 'Extra data: line 1 column 2 (char 1)'],
  ['1.e5', 'Extra data: line 1 column 2 (char 1)'],
  ['.5', 'Expecting value: line 1 column 1 (char 0)'],
  ['-', 'Expecting value: line 1 column 1 (char 0)'],
  ['+1', 'Expecting value: line 1 column 1 (char 0)'],
  ['--1', 'Expecting value: line 1 column 1 (char 0)'],
  ['{"a":1} garbage', 'Extra data: line 1 column 9 (char 8)'],
  ['[1] [2]', 'Extra data: line 1 column 5 (char 4)'],
  ['"a\\x"', 'Invalid \\escape: line 1 column 3 (char 2)'],
  ['"a\tb"', 'Invalid control character at: line 1 column 3 (char 2)'],
  ['"a"', 'Invalid control character at: line 1 column 3 (char 2)'],
  ['"a\\u12zz"', 'Invalid \\uXXXX escape: line 1 column 4 (char 3)'],
  [' "unterm', 'Unterminated string starting at: line 1 column 2 (char 1)'],
  ['{} 42', 'Extra data: line 1 column 4 (char 3)'],
  ['[1,]', 'Expecting value: line 1 column 4 (char 3)'],
  ["{\"a\":01}", "Expecting ',' delimiter: line 1 column 7 (char 6)"],
];

test("jsonpy: Python json.loads errors", () => {
  for (const [src, msg] of ERRORS) {
    assert.throws(() => parse(src), (e) => e instanceof SyntaxError && e.message === msg, `${JSON.stringify(src)} → ${msg}`);
  }
});

test("jsonpy: NaN/Infinity как в Python", () => {
  assert.ok(isPyFloat(parse("NaN")) && Number.isNaN(parse("NaN").v));
  assert.strictEqual(parse("Infinity").v, Infinity);
  assert.strictEqual(parse("-Infinity").v, -Infinity);
  assert.strictEqual(parse("[NaN,Infinity,-Infinity]").length, 3);
});

test("jsonpy: big int → PyInt (точность Python int)", () => {
  const v = parse("9007199254740993");
  assert.ok(isPyInt(v));
  assert.strictEqual(v.token, "9007199254740993");
  assert.strictEqual(v.big, 9007199254740993n);
  assert.strictEqual(numToken(v), "9007199254740993");
  assert.strictEqual(parse("-9007199254740993").token, "-9007199254740993");
  // safe-границы остаются Number
  assert.strictEqual(parse("9007199254740991"), 9007199254740991);
  assert.strictEqual(parse("-9007199254740991"), -9007199254740991);
  assert.ok(isPyInt(parse("9007199254740992")));
  // вложенные
  const o = parse('{"x":[9007199254740993, 5]}');
  assert.ok(isPyInt(o.x[0]) && o.x[1] === 5);
});

test("jsonpy: -0.0 знак нуля сохраняется", () => {
  const v = parse("-0.0");
  assert.ok(isPyFloat(v));
  assert.ok(Object.is(v.v, -0));
  assert.strictEqual(pyFloatStr(v.v), "-0.0");
  assert.strictEqual(numToken(v), "-0.0");
  assert.strictEqual(parse("-0"), 0); // Python int -0 → 0
  assert.strictEqual(parse("1e400").v, Infinity); // overflow → inf как в Python
});

test("jsonpy: isNumeric охватывает все числовые формы", () => {
  assert.ok(isNumeric(5) && isNumeric(parse("1.5")) && isNumeric(parse("9007199254740993")));
  assert.ok(isNumeric(NaN)); // Python isinstance(float("nan"), float) → True
  assert.ok(!isNumeric("5") && !isNumeric(null) && !isNumeric(true));
});

test("jsonpy: exponent формы → PyFloat", () => {
  for (const s of ["1e5", "1E5", "1e+5", "1e-5", "0e0", "10E+18"]) {
    const v = parse(s);
    assert.ok(isPyFloat(v), s);
  }
  assert.strictEqual(parse("10E+18").v, 1e19);
});
