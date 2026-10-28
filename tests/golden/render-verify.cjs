// render-verify.cjs — render.cjs через fake renderer: stdout-only / stderr-only /
// mixed логи в единый verify.log, verify.log до обработки ошибки, exit codes,
// partial shots 2/3, natural ordering, thumbs; zero-shot поведение не меняется.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { SKILL_JS, FIX, deckEnv } = require("../lib/oracle.cjs");
const { natKeyCmp, natKey } = require("../../tools/helpers/render.cjs");

const DECK = path.join(SKILL_JS, "tools", "deck.cjs");
const FAKE = path.join(FIX, "fake-renderer.cjs");
const TINY = path.join(FIX, "tiny-clone.pptx"); // 5 слайдов

function runUnpack(envExtra, extraArgs = []) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "render-verify-"));
  const outDir = path.join(tmp, "atlas");
  const env = deckEnv({ __SKILL_JS: SKILL_JS, __FAKE_LOG: "stdout", __FAKE_SLIDES: "5", __FAKE_EXIT: "0", ...envExtra });
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  const args = [DECK, "unpack", TINY, "--out", outDir, "--render",
                "--render-bin", process.execPath, "--render-app", FAKE, ...extraArgs];
  try {
    const stdout = execFileSync(process.execPath, args, { env, encoding: "utf8", timeout: 120000 });
    return { code: 0, stdout, tmp, outDir };
  } catch (e) {
    return { code: e.status ?? 1, stdout: (e.stdout || "").toString(), stderr: (e.stderr || "").toString(), tmp, outDir };
  }
}

test("render: stdout-only → verify.log + actionable lines", () => {
  const r = runUnpack({});
  assert.strictEqual(r.code, 0, (r.stderr || "").slice(0, 400));
  const log = fs.readFileSync(path.join(r.outDir, "shots", "verify.log"), "utf8");
  for (const ln of ["verify start", "TEXT CLIPPED slide 1: t", "bleed note: ок", "verify done"]) {
    assert.ok(log.includes(ln), `verify.log без «${ln}»`);
  }
  // unpack-режим: строки рендера игнорируются, печатается сводка
  assert.ok(r.stdout.includes("verify: 4 строк от рендера референса"), r.stdout.slice(0, 400));
});

test("render: stderr-only → всё равно в едином verify.log", () => {
  const r = runUnpack({ __FAKE_LOG: "stderr" });
  assert.strictEqual(r.code, 0, (r.stderr || "").slice(0, 400));
  const log = fs.readFileSync(path.join(r.outDir, "shots", "verify.log"), "utf8");
  assert.ok(log.includes("TEXT CLIPPED slide 1: t"), log.slice(0, 300));
  assert.ok(log.includes("verify done"), log.slice(0, 300));
});

test("render: mixed stdout+stderr → оба потока в verify.log", () => {
  const r = runUnpack({ __FAKE_LOG: "mixed" });
  assert.strictEqual(r.code, 0, (r.stderr || "").slice(0, 400));
  const log = fs.readFileSync(path.join(r.outDir, "shots", "verify.log"), "utf8");
  for (const ln of ["verify start", "TEXT CLIPPED slide 1: t", "bleed note: ок", "verify done"]) {
    assert.ok(log.includes(ln), `verify.log без «${ln}»`);
  }
});

test("render: nonzero verifier → exit 3, verify.log записан до ошибки", () => {
  const r = runUnpack({ __FAKE_EXIT: "7" });
  assert.strictEqual(r.code, 3, `code=${r.code}`);
  const logPath = path.join(r.outDir, "shots", "verify.log");
  assert.ok(fs.existsSync(logPath), "verify.log должен существовать при ошибке рендера");
  assert.ok(fs.readFileSync(logPath, "utf8").includes("verify start"));
  const env = JSON.parse(r.stderr);
  assert.ok(env.error.includes("кодом 7"), env.error);
});

test("render: partial shots (--render) → exit 3", () => {
  const r = runUnpack({ __FAKE_SLIDES: "3" }); // 3 < 5 слайдов tiny-clone
  assert.strictEqual(r.code, 3, `code=${r.code}`);
  assert.ok((r.stderr || "").includes("шотов 3, слайдов 5"), (r.stderr || "").slice(0, 400));
});

test("render: partial shots (--shots) → exit 2", () => {
  // готовим неполный набор PNG напрямую
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "render-shots-"));
  const shotsSrc = path.join(tmp, "src-shots");
  execFileSync(process.execPath, [FAKE, "--out-dir", shotsSrc], { env: { ...process.env, __SKILL_JS: SKILL_JS, __FAKE_SLIDES: "3", __FAKE_LOG: "" }, encoding: "utf8" });
  const outDir = path.join(tmp, "atlas");
  const env = deckEnv();
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  let code = 0, stderr = "";
  try {
    execFileSync(process.execPath, [DECK, "unpack", TINY, "--out", outDir, "--shots", shotsSrc], { env, encoding: "utf8" });
  } catch (e) {
    code = e.status ?? 1;
    stderr = (e.stderr || "").toString();
  }
  assert.strictEqual(code, 2, `code=${code} ${stderr.slice(0, 300)}`);
  assert.ok(stderr.includes("шотов 3, слайдов 5"), stderr.slice(0, 400));
});

test("render: --shots success → thumbs + natural ordering", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "render-shots-ok-"));
  const shotsSrc = path.join(tmp, "src-shots");
  execFileSync(process.execPath, [FAKE, "--out-dir", shotsSrc], { env: { ...process.env, __SKILL_JS: SKILL_JS, __FAKE_SLIDES: "5", __FAKE_LOG: "" }, encoding: "utf8" });
  const outDir = path.join(tmp, "atlas");
  const env = deckEnv();
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  const stdout = execFileSync(process.execPath, [DECK, "unpack", TINY, "--out", outDir, "--shots", shotsSrc], { env, encoding: "utf8" });
  const thumbs = fs.readdirSync(outDir).filter((f) => /^thumbs(-\d+)?\.png$/.test(f));
  assert.ok(thumbs.length >= 1, "thumbs не созданы");
  void stdout;
});

test("render: natKey natural ordering", () => {
  const names = ["slide-10.png", "slide-2.png", "slide-1.png", "slide-20.png", "slide-3.png"];
  names.sort((a, b) => natKeyCmp(natKey(a), natKey(b)));
  assert.deepStrictEqual(names, ["slide-1.png", "slide-2.png", "slide-3.png", "slide-10.png", "slide-20.png"]);
});

test("render: после suite не остаётся GUI/Chromium процессов", () => {
  const r = runUnpack({});
  assert.strictEqual(r.code, 0, (r.stderr || "").slice(0, 400));
  const ps = execFileSync("ps", ["-eo", "args"], { encoding: "utf8" });
  const stray = ps.split("\n").filter((ln) => ln.includes(r.tmp) && !ln.includes("ps -eo"));
  assert.deepStrictEqual(stray, [], `stray processes:\n${stray.join("\n")}`);
});

test("render: zero-shot поведение без изменений (без --render/--shots)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "render-zero-"));
  const outDir = path.join(tmp, "atlas");
  const env = deckEnv();
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  execFileSync(process.execPath, [DECK, "unpack", TINY, "--out", outDir], { env, encoding: "utf8" });
  assert.ok(!fs.existsSync(path.join(outDir, "shots")), "shots/ не должен создаваться");
});
