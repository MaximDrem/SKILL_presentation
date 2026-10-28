// build-parity.cjs — CJS build → canon == golden canon (oracle v3.2.1).
'use strict';
const { test } = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { SKILL_JS, GOLD, FIX, loadCanon } = require("../lib/oracle.cjs");
const { canonText } = require("../lib/canon.cjs");

const DECK = path.join(SKILL_JS, "tools", "deck.cjs");

function build(name, extraArgs = []) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bp-"));
  const out = path.join(tmp, name + ".pptx");
  const env = { ...process.env, DECK_SKIP_RENDER: "1" };
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  const r = execFileSync(process.execPath, [DECK, "build", path.join(FIX, "projects", name), "--out", out, ...extraArgs], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  void r;
  return canonText(fs.readFileSync(out));
}

const CASES = [
  ["blank-text", []],
  ["explicit-bg", []],
  ["charts", []],
  ["merge-shadow", []],
  ["elements-all", []],
  ["climate-multi-chart", []],
  ["chart-edges", []],
  ["dark-text", ["--theme", "dark"]],
  ["light-text", ["--theme", "light"]],
];

for (const [name, extra] of CASES) {
  test(`build parity: ${name}`, () => {
    const got = build(name, extra);
    const want = loadCanon(name);
    if (got !== want) {
      const gl = want.split("\n"), rl = got.split("\n");
      let first = -1;
      for (let i = 0; i < Math.max(gl.length, rl.length); i++) {
        if (gl[i] !== rl[i]) { first = i; break; }
      }
      throw new Error(`${name}: canon diff на строке ${first + 1}:\n  CJS: ${rl[first]}\n  PY : ${gl[first]}`);
    }
  });
}

test("build parity: clone-tiny", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bp-clone-"));
  const ref = path.join(tmp, "tiny-ref");
  const env = { ...process.env };
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  delete env.DECK_SKIP_RENDER;
  execFileSync(process.execPath, [DECK, "unpack", path.join(FIX, "tiny-clone.pptx"), "--out", ref, "--with-pages", "--no-decor-thumbs"], { env });
  const out = path.join(tmp, "clone-tiny.pptx");
  execFileSync(process.execPath, [DECK, "build", path.join(FIX, "projects", "clone-tiny"), "--template", path.join(FIX, "tiny-clone.pptx"), "--ref", ref, "--out", out], { env: { ...env, DECK_SKIP_RENDER: "1" } });
  const got = canonText(fs.readFileSync(out));
  const want = loadCanon("clone-tiny");
  if (got !== want) throw new Error("clone-tiny canon diff");
});

test("build parity: clone-43 (4:3, k из sldSz)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bp-clone43-"));
  const ref = path.join(tmp, "tiny-ref-43");
  const env = { ...process.env };
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  delete env.DECK_SKIP_RENDER;
  const tpl = path.join(FIX, "tiny-clone-43.pptx");
  execFileSync(process.execPath, [DECK, "unpack", tpl, "--out", ref, "--with-pages", "--no-decor-thumbs"], { env });
  const out = path.join(tmp, "clone-43.pptx");
  execFileSync(process.execPath, [DECK, "build", path.join(FIX, "projects", "clone-43"), "--template", tpl, "--ref", ref, "--out", out], { env: { ...env, DECK_SKIP_RENDER: "1" } });
  const got = canonText(fs.readFileSync(out));
  const want = loadCanon("clone-43");
  if (got !== want) {
    const gl = want.split("\n"), rl = got.split("\n");
    let first = -1;
    for (let i = 0; i < Math.max(gl.length, rl.length); i++) {
      if (gl[i] !== rl[i]) { first = i; break; }
    }
    throw new Error(`clone-43: canon diff на строке ${first + 1}:\n  CJS: ${rl[first]}\n  PY : ${gl[first]}`);
  }
});
