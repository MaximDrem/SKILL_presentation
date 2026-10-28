// numfmt.cjs — точные числовые семантики Python↔JS для parity.
'use strict';
const { isPyFloat, isPyInt, asNum } = require("./jsonpy.cjs");
const _uw = (v) => (isPyFloat(v) || isPyInt(v)) ? v.valueOf() : v;

// OOXML-округление (python helpers/unpack/ooxml.py::_js_round): floor(v+0.5)
function jsRound(v) { return Math.floor(_uw(v) + 0.5); }

// Python round() — ties-to-even, результат целый
function pyRound(v) {
  v = _uw(v);
  if (!Number.isFinite(v)) return v;
  const f = Math.floor(v);
  const diff = v - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1; // ровно посередине — к чётному
}

// Точная десятичная запись double: [digits, pointPos] — 0.digits × 10^pointPos
function exactDecimal(x) {
  if (x === 0) return { digits: "0", point: 0 };
  const buf = new DataView(new Float64Array([x]).buffer);
  const lo = buf.getUint32(0, true); // платформа little-endian
  const hi = buf.getUint32(4, true);
  const expBits = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e;
  if (expBits === 0) {
    e = -1074; // subnormal
  } else {
    m |= 1n << 52n;
    e = expBits - 1075;
  }
  let digits, point;
  if (e >= 0) {
    digits = (m << BigInt(e)).toString();
    point = digits.length;
  } else {
    const k = -e;
    const d = (m * 5n ** BigInt(k)).toString(); // x × 10^k
    const pad = Math.max(0, k + 1 - d.length);
    digits = "0".repeat(pad) + d;
    point = digits.length - k;
  }
  // trim trailing zeros (не влияет на значение)
  digits = digits.replace(/0+$/, "") || "0";
  return { digits, point };
}

// Python f"{x:.<f>f}" — корректное округление точного значения, half-even
function pyFixed(x, f) {
  x = _uw(x);
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  const neg = x < 0 || Object.is(x, -0);
  const { digits, point } = exactDecimal(Math.abs(x));
  // позиция среза: столько цифр, сколько point + f
  let cut = point + f;
  let d = digits;
  if (cut < 0) {
    // всё округляется в 0 (срез левее первой цифры)
    const halfIdx = cut; // цифра на позиции cut — первая значащая при cut==-1
    d = "0";
    cut = 0;
    // решаем округление: значение < 0.5·10^-f гарантированно (cut < -1), при cut==-1 смотрим первую цифру
    if (halfIdx === -1) {
      const first = digits[0];
      const rest = digits.slice(1);
      const gt = first > "5" || (first === "5" && /[1-9]/.test(rest));
      const eq = first === "5" && !/[1-9]/.test(rest);
      if (gt || (eq && false)) d = "1"; // половина — к чётному (0 чётное)
    }
    const body = f > 0 ? "0." + "0".repeat(f) : "0";
    if (d === "1") return (neg ? "-" : "") + (f > 0 ? "0." + "0".repeat(f - 1) + "1" : "1");
    return (neg ? "-" : "") + body;
  }
  let intFrac = d.slice(0, cut);
  let rest = d.slice(cut);
  let roundUp = false;
  if (rest) {
    const first = rest[0];
    const tail = rest.slice(1);
    if (first > "5" || (first === "5" && /[1-9]/.test(tail))) roundUp = true;
    else if (first === "5") {
      // ровно половина — к чётному
      const last = intFrac ? intFrac[intFrac.length - 1] : "0";
      roundUp = (parseInt(last, 10) % 2) === 1;
    }
  }
  let arr = (intFrac || "").padEnd(cut, "0").split("");
  if (arr.length === 0) arr = ["0"];
  if (roundUp) {
    let i = arr.length - 1;
    while (i >= 0 && arr[i] === "9") { arr[i] = "0"; i--; }
    if (i < 0) arr.unshift("1");
    else arr[i] = String(parseInt(arr[i], 10) + 1);
  }
  const s = arr.join("").padEnd(cut, "0");
  const intPart = f > 0 ? s.slice(0, s.length - f) || "0" : s;
  const fracPart = f > 0 ? s.slice(s.length - f) : "";
  return (neg ? "-" : "") + intPart + (f > 0 ? "." + fracPart : "");
}

// Python f"{x:.0%}"
function pyPercent0(x) { return pyFixed(x * 100, 0) + "%"; }

// int если значение целое (python ooxml._num)
function num(x) { return Number.isInteger(x) ? Math.trunc(x) : x; }

// JS-like Number→String — точный порт python unpack/cli.py::_js_num_str
// (oracle; в т.ч. «2.0» для целых float в диапазоне [1e-6, 1e21)).
function jsNumStr(x) {
  if (Number.isNaN(x) || !Number.isFinite(x)) return "null";
  if (x === 0) return "0";
  const ax = Math.abs(x);
  if (ax >= 1e-6 && ax < 1e21) {
    // Python repr: <1e16 — plain (целые с «.0»); ≥1e16 — экспонента → Decimal(f)
    let s = String(x);
    if (s.includes("e") || s.includes("E")) s = expandExp(s);
    if (ax < 1e16 && !s.includes(".")) s += ".0";
    return s;
  }
  const m = String(x).match(/^(-?[\d.]+)[eE]([+-]?)(\d+)$/);
  if (!m) return String(x);
  const e = parseInt(m[3], 10) * (m[2] === "-" ? -1 : 1);
  return `${m[1]}e${e >= 0 ? "+" : "-"}${Math.abs(e)}`;
}

function expandExp(s) {
  const m = s.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?)(\d+)$/);
  if (!m) return s;
  const sign = m[1], intd = m[2], frac = m[3] || "", e = parseInt(m[5], 10) * (m[4] === "-" ? -1 : 1);
  const digits = intd + frac;
  const point = intd.length + e;
  if (point <= 0) return sign + "0." + "0".repeat(-point) + digits;
  if (point >= digits.length) return sign + digits + "0".repeat(point - digits.length);
  return sign + digits.slice(0, point) + "." + digits.slice(point);
}

// Python repr() для значений в сообщениях
function pyRepr(v) {
  if (isPyInt(v)) return v.token;
  if (isPyFloat(v)) return require("./jsonpy.cjs").pyFloatStr(v.v);
  if (typeof v === "string") return "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) < 1e21) return String(v);
    return pyExpFix(String(v));
  }
  return String(v);
}

// Python float repr: экспонента всегда со знаком и ≥2 цифрами (1e-07)
function pyExpFix(s) {
  const m = s.match(/^(-?[\d.]+)[eE]([+-]?)(\d+)$/);
  if (!m) return s;
  const sign = m[2] === "-" ? "-" : "+";
  return m[1] + "e" + sign + m[3].padStart(2, "0");
}

// Python json.dumps(ensure_ascii=False) — строки
function pyJsonString(s) {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 0x20) out += "\\u" + c.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + '"';
}

// Python json.dumps(obj, ensure_ascii=False, indent=indent|None)
// compact=true → separators=(",", ":")
function pyJsonDumps(obj, indent, compact) {
  return pyJsonDumpInner(obj, indent, 0, compact);
}

function pyJsonDumpInner(obj, indent, level, compact) {
  const hasIndent = indent !== undefined && indent !== null;
  const pad = hasIndent ? " ".repeat(indent * (level + 1)) : "";
  const padEnd = hasIndent ? " ".repeat(indent * level) : "";
  const kvSep = hasIndent ? ": " : (compact ? ":" : ": ");
  const itemSep = hasIndent ? ",\n" : (compact ? "," : ", ");
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (isPyInt(obj)) return obj.token; // Python json.dumps(int) — точная запись
  if (isPyFloat(obj)) {
    // Python json.dumps(float) — repr
    const v = obj.valueOf();
    if (Number.isNaN(v)) return "NaN";
    if (!Number.isFinite(v)) return v > 0 ? "Infinity" : "-Infinity";
    return require("./jsonpy.cjs").pyFloatStr(v);
  }
  if (typeof obj === "number") {
    if (Number.isNaN(obj)) return "NaN";
    if (obj === Infinity) return "Infinity";
    if (obj === -Infinity) return "-Infinity";
    // в наших данных целые приходят как int — Python печатает без .0
    return pyExpFix(String(obj));
  }
  if (typeof obj === "string") return pyJsonString(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const items = obj.map((v) => pad + pyJsonDumpInner(v, indent, level + 1, compact));
    return "[" + (hasIndent ? "\n" : "") + items.join(itemSep) + (hasIndent ? "\n" + padEnd : "") + "]";
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  const items = keys.map((k) => pad + pyJsonString(String(k)) + kvSep + pyJsonDumpInner(obj[k], indent, level + 1, compact));
  return "{" + (hasIndent ? "\n" : "") + items.join(itemSep) + (hasIndent ? "\n" + padEnd : "") + "}";
}

// Python 3.12+ sum() по float — Neumaier compensated summation
function pySum(arr) {
  let sum = 0.0, c = 0.0;
  for (const x0 of arr) {
    const x = _uw(x0);
    const t = sum + x;
    if (Math.abs(sum) >= Math.abs(x)) c += (sum - t) + x;
    else c += (x - t) + sum;
    sum = t;
  }
  return sum + c;
}

// Python str(float): целые float → "60.0" (для float-полей unpack: sz и пр.)
function pyStrNum(v) {
  if (Object.is(v, -0)) return "-0.0";
  if (Number.isInteger(v) && Math.abs(v) < 1e21) return String(v) + ".0";
  return String(v);
}

module.exports = { pyStrNum, jsRound, pyRound, pyFixed, pyPercent0, num, jsNumStr, pyRepr, pyJsonDumps, pyJsonString, exactDecimal, pySum };
