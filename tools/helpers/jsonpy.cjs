// jsonpy.cjs — JSON-парсер с семантикой Python json.loads:
// числа с '.', 'e'/'E' → PyFloat (Python float), целые в safe-диапазоне → int (Number),
// целые вне safe-диапазона → PyInt (BigInt + исходный token, точность Python int).
// PyFloat/PyInt — boxed: арифметика работает через valueOf, а Number.isInteger()
// возвращает false — ровно как isinstance(float, int) в Python.
'use strict';

class PyFloat {
  constructor(v) { this.v = v; }
  valueOf() { return this.v; }
  toString() { return pyFloatStr(this.v); }
}

// Python int вне Number-safe диапазона: точное значение в BigInt, исходная запись в token.
class PyInt {
  constructor(token) {
    this.token = token;
    this.big = BigInt(token);
  }
  valueOf() { return Number(this.big); }
  toString() { return this.token; }
}

function isPyFloat(x) { return x instanceof PyFloat; }
function isPyInt(x) { return x instanceof PyInt; }
function asNum(x) { return x instanceof PyFloat || x instanceof PyInt ? x.valueOf() : x; }

// Python str(float) / repr(float)
function pyFloatStr(x) {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (Object.is(x, -0)) return "-0.0";
  let s = String(x);
  if (s.includes("e") || s.includes("E")) {
    // JS "1e+21" → Python "1e+21"; JS "1e-7" → Python "1e-07"
    const m = s.match(/^(-?[\d.]+)[eE]([+-]?)(\d+)$/);
    if (m) {
      const sign = m[2] === "-" ? "-" : "+";
      return m[1] + "e" + sign + m[3].padStart(2, "0");
    }
  }
  if (!s.includes(".")) s += ".0";
  return s;
}

// Точная запись числа для сериализации (chart XML / XLSX / page JSON):
// PyInt — исходный token без потерь; PyFloat — Python repr; Number — как есть.
function numToken(x) {
  if (x instanceof PyInt) return x.token;
  if (x instanceof PyFloat) return pyFloatStr(x.v);
  return String(x);
}

// Python isinstance(x, (int, float)) — без bool (JSON bool → Python bool, но валидаторы
// v3 опираются на goldens без bool-в-числе кейсов; NaN float — numeric)
function isNumeric(x) {
  return typeof x === "number" || x instanceof PyFloat || x instanceof PyInt;
}

const SAFE_MIN = -9007199254740991n;
const SAFE_MAX = 9007199254740991n;

function parse(text) {
  let i = 0;
  const n = text.length;
  // Python json.JSONDecodeError: "msg: line L column C (char N)"
  function pyErr(msg, pos) {
    const p = pos === undefined ? i : pos;
    const upto = text.slice(0, p);
    const lineno = upto.split("\n").length;
    const lastNl = upto.lastIndexOf("\n");
    const colno = p - lastNl;
    throw new SyntaxError(`${msg}: line ${lineno} column ${colno} (char ${p})`);
  }
  function skipWs() { while (i < n && " \t\n\r".includes(text[i])) i++; }
  function parseValue() {
    skipWs();
    const c = text[i];
    if (c === "{") return parseObj();
    if (c === "[") return parseArr();
    if (c === '"') return parseStr();
    if (c === "t" && text.startsWith("true", i)) { i += 4; return true; }
    if (c === "f" && text.startsWith("false", i)) { i += 5; return false; }
    if (c === "n" && text.startsWith("null", i)) { i += 4; return null; }
    if (c === "N" && text.startsWith("NaN", i)) { i += 3; return new PyFloat(NaN); }
    if (c === "I" && text.startsWith("Infinity", i)) { i += 8; return new PyFloat(Infinity); }
    if (c === "-" && text.startsWith("-Infinity", i)) { i += 9; return new PyFloat(-Infinity); }
    return parseNum();
  }
  function parseObj() {
    const out = {};
    i++;
    skipWs();
    if (text[i] === "}") { i++; return out; }
    while (true) {
      skipWs();
      if (text[i] !== '"') pyErr("Expecting property name enclosed in double quotes");
      const k = parseStr();
      skipWs();
      if (text[i] !== ":") pyErr("Expecting ':' delimiter");
      i++;
      const v = parseValue();
      // own data property как у JSON.parse: "__proto__" не трогает прототип
      Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
      skipWs();
      if (text[i] === ",") { i++; continue; }
      if (text[i] === "}") { i++; return out; }
      pyErr("Expecting ',' delimiter");
    }
  }
  function parseArr() {
    const out = [];
    i++;
    skipWs();
    if (text[i] === "]") { i++; return out; }
    while (true) {
      out.push(parseValue());
      skipWs();
      if (text[i] === ",") { i++; continue; }
      if (text[i] === "]") { i++; return out; }
      pyErr("Expecting ',' delimiter");
    }
  }
  function parseStr() {
    if (text[i] !== '"') pyErr("Expecting value");
    const strStart = i;
    i++;
    let out = "";
    while (i < n) {
      const c = text[i];
      if (c === '"') { i++; return out; }
      const cp = c.codePointAt(0);
      if (cp < 0x20) pyErr("Invalid control character at", i);
      if (c === "\\") {
        const bs = i;
        const e = text[i + 1];
        if (e === '"' || e === "\\" || e === "/") out += e;
        else if (e === "b") out += "\b";
        else if (e === "f") out += "\f";
        else if (e === "n") out += "\n";
        else if (e === "r") out += "\r";
        else if (e === "t") out += "\t";
        else if (e === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9A-Fa-f]{4}$/.test(hex)) pyErr("Invalid \\uXXXX escape", bs + 1);
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else if (e === undefined) {
          break; // "\" в конце ввода → Unterminated string
        } else {
          pyErr("Invalid \\escape", bs);
        }
        i += 2;
        continue;
      }
      out += c;
      i++;
    }
    pyErr("Unterminated string starting at", strStart);
  }
  function parseNum() {
    // Python: -?(?:0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?
    const m = /^-?(?:0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?/.exec(text.slice(i));
    if (!m || !m[0]) pyErr("Expecting value");
    i += m[0].length;
    const isFloat = m[1] !== undefined || m[2] !== undefined;
    if (isFloat) return new PyFloat(parseFloat(m[0]));
    const big = BigInt(m[0]);
    if (big >= SAFE_MIN && big <= SAFE_MAX) return Number(big);
    return new PyInt(m[0]);
  }
  const v = parseValue();
  skipWs();
  if (i < n) pyErr("Extra data", i);
  return v;
}

module.exports = { PyFloat, PyInt, isPyFloat, isPyInt, asNum, pyFloatStr, numToken, isNumeric, parse };
