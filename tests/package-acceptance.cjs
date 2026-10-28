// package-acceptance.cjs — target-application acceptance: CJS build → штатный
// --pptx-verify приложения → точное число PNG/slides. Canon alone недостаточен.
// Требует GIGATOOL_NODE (бинарь приложения); без него — loud skip, а при
// DECK_REQUIRE_RENDERER=1 — явный FAIL (release-гейт §8.5).
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const { SKILL_JS, FIX, deckEnv } = require("./lib/oracle.cjs");
const { unzipSync } = require("../vendor/fflate/lib/node.cjs");

const DECK = path.join(SKILL_JS, "tools", "deck.cjs");
const BINARY = process.env.GIGATOOL_NODE || process.env.MULTITOOL_NODE || "";
const REQUIRE = !!process.env.DECK_REQUIRE_RENDERER;

function countSlides(pptxPath) {
  const parts = unzipSync(new Uint8Array(fs.readFileSync(pptxPath)));
  return Object.keys(parts).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length;
}

function acceptCase(t, project, exactSlides, { template = null } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-accept-"));
  const out = path.join(tmp, "deck.pptx");
  const env = deckEnv();
  delete env.DECK_SKIP_RENDER;
  const args = [DECK, "build", path.join(FIX, "projects", project)];
  if (template) {
    const ref = path.join(tmp, "ref");
    execFileSync(process.execPath, [DECK, "unpack", template, "--out", ref, "--with-pages", "--no-decor-thumbs"],
                 { env, encoding: "utf8", timeout: 600000 });
    args.push("--template", template, "--ref", ref);
  }
  // build сам вызывает --pptx-verify (рендер-гейт включён)
  execFileSync(process.execPath, [...args, "--out", out], { env, encoding: "utf8", timeout: 600000 });
  assert.ok(fs.existsSync(out), "build не создал pptx");
  const nSlides = countSlides(out);
  assert.strictEqual(nSlides, exactSlides, `slides ${nSlides} ≠ ${exactSlides}`);
  // независимый вызов рендера в отдельный каталог (создаётся самим приложением):
  // PNG на каждый слайд, verify.log с stdout/stderr рендера
  const renderDir = path.join(tmp, "independent-render");
  const renv = { ...process.env };
  delete renv.ELECTRON_RUN_AS_NODE;
  const app = process.env.GIGATOOL_APP_PATH || process.env.MULTITOOL_APP_PATH;
  const rendered = spawnSync(BINARY, [...(app ? [app] : []), "--pptx-verify", out, "--out-dir", renderDir],
                             { env: renv, encoding: "utf8", timeout: 600000 });
  const rstdout = rendered.stdout || "";
  const rstderr = rendered.stderr || "";
  if (rendered.error || rendered.status !== 0) {
    fs.mkdirSync(renderDir, { recursive: true });
    fs.writeFileSync(path.join(renderDir, "verify.log"), rstdout + rstderr);
    throw new Error(`independent --pptx-verify exit ${rendered.status}: ${(rstdout + rstderr).slice(0, 400)}`);
  }
  const pngs = fs.readdirSync(renderDir).filter((f) => f.endsWith(".png"));
  assert.strictEqual(pngs.length, nSlides, `PNG ${pngs.length} ≠ slides ${nSlides}`);
  fs.writeFileSync(path.join(renderDir, "verify.log"), rstdout + rstderr);
  t.diagnostic(`acceptance ${project}: ${nSlides} slides, ${pngs.length} PNG`);
}

test("package-acceptance: build → --pptx-verify → PNG == slides", async (t) => {
  if (!BINARY) {
    if (REQUIRE) assert.fail("DECK_REQUIRE_RENDERER=1, но GIGATOOL_NODE не задан — acceptance невозможен");
    process.stderr.write("[package-acceptance] LOUD SKIP: GIGATOOL_NODE не задан — acceptance-гейт не выполнялся\n");
    t.skip("нет бинаря приложения (GIGATOOL_NODE)");
    return;
  }
  await t.test("blank-text (1 slide)", (t2) => acceptCase(t2, "blank-text", 1));
  await t.test("climate-multi-chart (2 slides)", (t2) => acceptCase(t2, "climate-multi-chart", 2));
  await t.test("clone-tiny (2 slides)", (t2) => acceptCase(t2, "clone-tiny", 2, { template: path.join(FIX, "tiny-clone.pptx") }));
  await t.test("clone-43 (2 slides, 4:3)", (t2) => acceptCase(t2, "clone-43", 2, { template: path.join(FIX, "tiny-clone-43.pptx") }));
});
