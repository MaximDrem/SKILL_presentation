// vendor-smoke.cjs — smoke-load каждого vendor entry (Node; Electron Node-mode —
// тот же V8/require). Официальные entry layouts, licenses присутствуют.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { SKILL_JS } = require("./lib/oracle.cjs");

const VENDOR = path.join(SKILL_JS, "vendor");

test("vendor smoke: все entries загружаются", () => {
  // fflate: official lib/ layout + package-root CJS/ESM entries
  const fflate = require(path.join(VENDOR, "fflate", "lib", "node.cjs"));
  assert.strictEqual(typeof fflate.zipSync, "function");
  const fflateRoot = require(path.join(VENDOR, "fflate"));
  assert.strictEqual(typeof fflateRoot.zipSync, "function", "package-root CJS entry");
  const { PNG } = require(path.join(VENDOR, "pngjs"));
  assert.strictEqual(typeof PNG, "function");
  const jpeg = require(path.join(VENDOR, "jpeg-js"));
  assert.strictEqual(typeof jpeg.decode, "function");
  // единый bundle (весь runtime closure pptxgenjs внутри)
  const PptxGenJS = require(path.join(VENDOR, "pptxgenjs.bundle.cjs"));
  assert.strictEqual(typeof PptxGenJS, "function");
});

test("vendor smoke: fflate package-root ESM entry загружается", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fflate-esm-smoke-"));
  try {
    fs.mkdirSync(path.join(tmp, "node_modules"));
    fs.symlinkSync(path.join(VENDOR, "fflate"), path.join(tmp, "node_modules", "fflate"), "dir");
    execFileSync(process.execPath, ["--input-type=module", "-e", "import('fflate').then(m => { if (typeof m.zipSync !== 'function') process.exit(2); })"],
                 { cwd: tmp, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("vendor smoke: licenses присутствуют у всех пакетов", () => {
  const missing = [];
  const check = (dir) => {
    if (!fs.existsSync(path.join(dir, "package.json"))) return;
    const names = fs.readdirSync(dir);
    if (!names.some((n) => /^licen[cs]e/i.test(n))) missing.push(path.relative(VENDOR, dir));
  };
  for (const d of fs.readdirSync(VENDOR)) {
    const full = path.join(VENDOR, d);
    if (fs.statSync(full).isDirectory()) check(full);
  }
  assert.deepStrictEqual(missing, []);
});

test("vendor smoke: bundled transitive notices полные", () => {
  const notice = fs.readFileSync(path.join(VENDOR, "THIRD_PARTY_NOTICES"), "utf8");
  for (const name of [
    "pptxgenjs@4.0.1", "jszip@3.10.2", "pako@1.0.11", "lie@3.3.0",
    "immediate@3.0.6", "readable-stream@2.3.8", "core-util-is@1.0.3",
    "inherits@2.0.4", "process-nextick-args@2.0.1", "safe-buffer@5.1.2",
    "string_decoder@1.1.1", "util-deprecate@1.0.2", "setimmediate@1.0.5",
    "image-size@1.2.1", "queue@6.0.2", "isarray@1.0.0",
  ]) assert.ok(notice.includes(name), `notice отсутствует: ${name}`);
  assert.ok(notice.includes("Permission is hereby granted"), "нет MIT permission notice");
  assert.ok(notice.includes("The ISC License"), "нет ISC notice");
  assert.ok(notice.includes("additional zlib license"), "нет Zlib notice");
  assert.ok(notice.includes("Stuart Knightley") && notice.includes("Jesse Tane"), "нет copyright attribution");
});

test("vendor smoke: нет runtime node_modules imports/requires", () => {
  assert.ok(!fs.existsSync(path.join(VENDOR, "node_modules")), "vendor/node_modules обязан быть удалён после bundle");
  const hits = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f);
      const st = fs.statSync(fp);
      if (st.isDirectory()) { walk(fp); continue; }
      if (!/\.cjs$/.test(f)) continue;
      const src = fs.readFileSync(fp, "utf8");
      for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (m[1].includes("node_modules")) hits.push(`${path.relative(SKILL_JS, fp)}: ${m[1]}`);
      }
    }
  };
  walk(path.join(SKILL_JS, "tools"));
  assert.deepStrictEqual(hits, []);
});
