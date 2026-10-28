// corpus.cjs — §8.3 corpus unpack: все *.pptx в корне репозитория → unpack exit 0,
// proto.json непустой, pages/ написаны. Corpus отсутствует → loud skip.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { SKILL_JS, deckEnv } = require("./lib/oracle.cjs");

const DECK = path.join(SKILL_JS, "tools", "deck.cjs");
const REPO = path.dirname(SKILL_JS);

const corpus = fs.readdirSync(REPO).filter((f) => f.endsWith(".pptx"));
const EXPECTED = [
  "Breakfast Anton V12.pptx",
  "SU_шаблон_DARK_2026(Р7, PowerPoint)small (1).pptx",
  "SU_шаблон_LIGHT_2026(Р7, PowerPoint)small.pptx",
  "SberKot_prezentaciya (2).pptx",
  "SberKot_prezentaciya.pptx",
  "product-management.pptx",
  "sberkot-apple.pptx",
  "sberkot-pitch (2).pptx",
  "sberkot-pitch.pptx",
  "ГигаКот_Стратегия_final.pptx",
  "Лучшие_практики_продуктового_управления.pptx",
  "Продуктовое_управление_—_лучшие_практики.pptx",
  "Реестр-кейсов-LLM.pptx",
  "СберКот-презентация.pptx",
  "СберКот_Стратегия.pptx",
];

test("corpus unpack: все реальные pptx читаются", { timeout: 600000 }, (t) => {
  if (!corpus.length) {
    if (process.env.DECK_REQUIRE_RENDERER) {
      assert.fail("DECK_REQUIRE_RENDERER=1, но corpus (*.pptx в корне репозитория) отсутствует — release-гейт невозможен");
    }
    process.stderr.write("[corpus] LOUD SKIP: нет *.pptx в корне репозитория\n");
    t.skip("corpus отсутствует");
    return;
  }
  if (process.env.DECK_REQUIRE_RENDERER) {
    const missing = EXPECTED.filter((f) => !corpus.includes(f));
    assert.deepStrictEqual(missing, [], `release corpus неполный: ${missing.join(", ")}`);
  }
  const problems = [];
  for (const f of corpus) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
    const outDir = path.join(tmp, "atlas");
    const env = deckEnv();
    delete env.GIGATOOL_NODE;
    delete env.MULTITOOL_NODE;
    try {
      execFileSync(process.execPath, [DECK, "unpack", path.join(REPO, f), "--out", outDir, "--with-pages", "--no-decor-thumbs"],
                   { env, encoding: "utf8", timeout: 300000, stdio: ["ignore", "pipe", "pipe"] });
      const proto = JSON.parse(fs.readFileSync(path.join(outDir, "proto.json"), "utf8"));
      const n = Object.keys(proto).length;
      if (!n) problems.push(`${f}: пустой proto.json`);
      const pages = fs.readdirSync(path.join(outDir, "pages")).filter((x) => x.endsWith(".json"));
      if (pages.length !== n) problems.push(`${f}: pages ${pages.length} ≠ protos ${n}`);
      t.diagnostic(`${f}: ${n} protos`);
    } catch (e) {
      problems.push(`${f}: exit ${e.status} ${String(e.stderr || "").slice(0, 200)}`);
    }
  }
  assert.deepStrictEqual(problems, []);
});
