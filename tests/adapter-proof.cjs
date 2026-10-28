// adapter-proof.cjs — production build вызывает PptxGenJS: отсутствие vendored
// пакета/адаптера → явный exit 3 (silent legacy fallback запрещён, legacy writers
// удалены — зелёный suite без них это доказывает).
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { SKILL_JS, FIX } = require("./lib/oracle.cjs");

const DECK = path.join(SKILL_JS, "tools", "deck.cjs");
const BUNDLE = path.join(SKILL_JS, "vendor", "pptxgenjs.bundle.cjs");
const ADAPTER = path.join(SKILL_JS, "tools", "helpers", "builder", "pptxgen-adapter.cjs");

function runBuild() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-proof-"));
  const out = path.join(tmp, "out.pptx");
  const env = { ...process.env, DECK_SKIP_RENDER: "1" };
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  try {
    execFileSync(process.execPath, [DECK, "build", path.join(FIX, "projects", "blank-text"), "--out", out],
                 { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
    return { code: 0, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stderr: (e.stderr || "").toString() };
  }
}

test("adapter proof: отсутствие vendored pptxgenjs bundle → exit 3, без silent fallback", () => {
  const stash = BUNDLE + ".stashed";
  fs.renameSync(BUNDLE, stash);
  try {
    const r = runBuild();
    assert.strictEqual(r.code, 3, `ожидался exit 3, получили ${r.code}: ${r.stderr.slice(0, 300)}`);
    assert.ok(r.stderr.includes("pptxgen"), r.stderr.slice(0, 300));
  } finally {
    fs.renameSync(stash, BUNDLE);
  }
  // после восстановления — build снова работает
  const ok = runBuild();
  assert.strictEqual(ok.code, 0, ok.stderr.slice(0, 300));
});

test("adapter proof: отсутствие adapter module → exit 3", () => {
  const stash = ADAPTER + ".stashed";
  fs.renameSync(ADAPTER, stash);
  try {
    const r = runBuild();
    assert.strictEqual(r.code, 3, `ожидался exit 3, получили ${r.code}: ${r.stderr.slice(0, 300)}`);
  } finally {
    fs.renameSync(stash, ADAPTER);
  }
});

test("adapter proof: bundle — официальный pptxgenjs@4.0.1 entry загружается", () => {
  const P = require(BUNDLE);
  assert.strictEqual(typeof P, "function");
  const head = fs.readFileSync(BUNDLE, "utf8").slice(0, 4096);
  assert.ok(head.includes("pptxgenjs@4.0.1"), "provenance header без pptxgenjs@4.0.1");
});
