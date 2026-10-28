// oracle.cjs — загрузка goldens и deep-equality с диагностикой path.
'use strict';
const fs = require("fs");
const path = require("path");
const { parse: pyJsonParse, isPyFloat, isPyInt } = require("../../tools/helpers/jsonpy.cjs");

const SKILL_JS = path.resolve(__dirname, "..", "..");
const GOLD = path.join(SKILL_JS, "tests", "goldens");
const FIX = path.join(SKILL_JS, "tests", "fixtures");

function loadUnit(name) {
  // Python json.loads семантика (float → PyFloat) — зеркало oracle-дампов
  return pyJsonParse(fs.readFileSync(path.join(GOLD, "unit", name), "utf8"));
}

function loadCli(name) {
  return JSON.parse(fs.readFileSync(path.join(GOLD, "cli", name + ".json"), "utf8"));
}

// deep equality, key order не важен; числа — бит-в-бит (Object.is, NaN==NaN);
// PyFloat раскрывается к значению
function deepDiff(a, b, p = "$") {
  const diffs = [];
  const unwrap = (v) => (isPyFloat(v) ? v.v : isPyInt(v) ? v.valueOf() : v);
  const walk = (x0, y0, path) => {
    const x = unwrap(x0), y = unwrap(y0);
    if (typeof x === "number" && typeof y === "number") {
      if (!Object.is(x, y)) diffs.push(`${path}: ${x} !== ${y}`);
      return;
    }
    if (x === null || y === null || typeof x !== "object" || typeof y !== "object") {
      if (x !== y) diffs.push(`${path}: ${JSON.stringify(x)} !== ${JSON.stringify(y)}`);
      return;
    }
    if (Array.isArray(x) !== Array.isArray(y)) {
      diffs.push(`${path}: array/object mismatch`);
      return;
    }
    if (Array.isArray(x)) {
      if (x.length !== y.length) {
        diffs.push(`${path}: len ${x.length} !== ${y.length}`);
        return;
      }
      for (let i = 0; i < x.length; i++) walk(x[i], y[i], `${path}[${i}]`);
      return;
    }
    const kx = Object.keys(x).sort();
    const ky = Object.keys(y).sort();
    if (kx.length !== ky.length || kx.some((k, i) => k !== ky[i])) {
      diffs.push(`${path}: keys [${kx}] !== [${ky}]`);
      return;
    }
    for (const k of kx) walk(x[k], y[k], `${path}.${k}`);
  };
  walk(a, b, p);
  return diffs;
}

function assertDeepEqual(actual, expected, label) {
  const diffs = deepDiff(actual, expected);
  if (diffs.length) {
    const err = new Error(`${label}:\n  ${diffs.slice(0, 12).join("\n  ")}${diffs.length > 12 ? `\n  …ещё ${diffs.length - 12}` : ""}`);
    err.diffs = diffs;
    throw err;
  }
}

// canon-дружелюбное чтение goldens/build
function loadCanon(name) {
  return fs.readFileSync(path.join(GOLD, "build", name + ".canon.txt"), "utf8");
}

// нормализация числовых ключей: Python float-ключ 18.0 в JSON → "18.0",
// в JS тот же ключ "18" (семантически равны; видно только в golden-дампах)
function normNumKeys(o) {
  if (isPyFloat(o)) return o;
  if (Array.isArray(o)) return o.map(normNumKeys);
  if (o !== null && typeof o === "object") {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      const m = k.match(/^(-?\d+)\.0+$/);
      out[m ? m[1] : k] = normNumKeys(v);
    }
    return out;
  }
  return o;
}

// env для deck subprocess: ELECTRON_RUN_AS_NODE=1 сохраняется (Electron Node-mode),
// прочие ELECTRON_* снимаются; renderer child снимает его сам в render.cjs
function deckEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const k of Object.keys(env)) {
    if (/^ELECTRON_/.test(k) && k !== "ELECTRON_RUN_AS_NODE") delete env[k];
  }
  env.ELECTRON_RUN_AS_NODE = "1";
  return env;
}

module.exports = { SKILL_JS, GOLD, FIX, loadUnit, loadCli, loadCanon, deepDiff, assertDeepEqual, normNumKeys, deckEnv };
