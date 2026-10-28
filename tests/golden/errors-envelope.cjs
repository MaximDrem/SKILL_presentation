// errors-envelope.cjs — JSON envelope в stderr: полная синхронная запись,
// включая envelope больше pipe buffer (64KiB); exit codes сохраняются.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("child_process");
const path = require("path");

const ERRORS = path.join(__dirname, "..", "..", "tools", "helpers", "errors.cjs");

function runFail(code, obj) {
  // payload через temp-файл (argv/env ограничены MAX_ARG_STRLEN=128KiB)
  const fs = require("fs");
  const os = require("os");
  const payload = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bfail-")), "payload.json");
  fs.writeFileSync(payload, JSON.stringify(obj));
  const script = `const {bFail} = require(${JSON.stringify(ERRORS)}); bFail(${code}, JSON.parse(require("fs").readFileSync(${JSON.stringify(payload)}, "utf8")));`;
  try {
    execFileSync(process.execPath, ["-e", script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
    return { code: 0, stderr: "" };
  } catch (e) {
    return { code: e.status, stderr: e.stderr || "" };
  }
}

test("errors: полный envelope > pipe buffer читается и парсится", () => {
  const big = { error: "большая ошибка", suggestion: "x".repeat(200 * 1024), detail: "ё".repeat(50 * 1024) };
  const r = runFail(3, big);
  assert.strictEqual(r.code, 3);
  const parsed = JSON.parse(r.stderr);
  assert.strictEqual(parsed.suggestion.length, 200 * 1024);
  assert.strictEqual(parsed.detail.length, 50 * 1024);
  assert.strictEqual(parsed.error, "большая ошибка");
});

test("errors: exit codes 2/3 сохраняются", () => {
  assert.strictEqual(runFail(2, { error: "e2" }).code, 2);
  assert.strictEqual(runFail(3, { error: "e3" }).code, 3);
});

test("errors: малый envelope парсится", () => {
  const r = runFail(3, { error: "e", suggestion: "s" });
  assert.deepStrictEqual(JSON.parse(r.stderr), { error: "e", suggestion: "s" });
});
