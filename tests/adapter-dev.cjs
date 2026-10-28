// adapter-dev.cjs — dev harness: build project via PptxGenJS adapter → canon diff vs golden.
// Usage: node tests/adapter-dev.cjs <project> [--theme dark|light]
'use strict';
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { canonText } = require("./lib/canon.cjs");
const { SKILL_JS, GOLD, FIX } = require("./lib/oracle.cjs");

const name = process.argv[2] || "blank-text";
const theme = process.argv.includes("--theme") ? process.argv[process.argv.indexOf("--theme") + 1] : null;

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-dev-"));
  const out = path.join(tmp, name + ".pptx");
  const env = { ...process.env, DECK_SKIP_RENDER: "1", DECK_BUILDER: "pptxgen" };
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  const args = [path.join(SKILL_JS, "tools", "deck.cjs"), "build", path.join(FIX, "projects", name), "--out", out];
  if (theme) args.push("--theme", theme);
  if (name.startsWith("clone-")) {
    const tplName = name === "clone-43" ? "tiny-clone-43" : "tiny-clone";
    const tpl = path.join(FIX, tplName + ".pptx");
    const ref = path.join(tmp, tplName + "-ref");
    execFileSync(process.execPath, [path.join(SKILL_JS, "tools", "deck.cjs"), "unpack", tpl, "--out", ref, "--with-pages", "--no-decor-thumbs"], { env: { ...process.env }, encoding: "utf8" });
    args.push("--template", tpl, "--ref", ref);
  }
  try {
    execFileSync(process.execPath, args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    console.error("BUILD FAIL exit", e.status);
    console.error((e.stderr || "").toString().slice(0, 2000));
    process.exit(1);
  }
  const got = canonText(fs.readFileSync(out));
  const want = fs.readFileSync(path.join(GOLD, "build", name + ".canon.txt"), "utf8");
  if (got === want) { console.log("CANON MATCH", name); return; }
  const gl = want.split("\n"), rl = got.split("\n");
  let shown = 0;
  for (let i = 0; i < Math.max(gl.length, rl.length) && shown < 40; i++) {
    if (gl[i] !== rl[i]) {
      console.log(`line ${i + 1}:`);
      console.log(`  PY : ${gl[i]}`);
      console.log(`  CJS: ${rl[i]}`);
      shown++;
    }
  }
  console.log(`… diff lines shown ${shown}, total py=${gl.length} cjs=${rl.length}`);
  fs.writeFileSync("/tmp/adapter-got.canon.txt", got);
}

main().catch((e) => { console.error(e); process.exit(1); });
