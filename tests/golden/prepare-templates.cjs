// prepare-templates.cjs — require.main entry, идемпотентность полного prepared
// tree, missing-atlas recovery. Все прогоны — в temp-копии templates/:
// checkout не изменяется, races с параллельными build/unpack suites исключены.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { SKILL_JS } = require("../lib/oracle.cjs");

const PREPARE = path.join(SKILL_JS, "tools", "helpers", "build_templates", "prepare_templates.cjs");

function hashTree(dir, filter) {
  const crypto = require("crypto");
  const h = crypto.createHash("sha256");
  const walk = (d) => {
    for (const f of fs.readdirSync(d).sort()) {
      const fp = path.join(d, f);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else if (!filter || filter(fp)) {
        h.update(fp);
        h.update(fs.readFileSync(fp));
      }
    }
  };
  walk(dir);
  return h.digest("hex");
}

// изолированная копия скилла: tools + vendor + templates (без shell cp — fs.cpSync)
function makeSandbox({ withTemplates = true } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "prepare-sbx-"));
  const root = path.join(tmp, "skill");
  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(path.join(SKILL_JS, "tools"), path.join(root, "tools"), { recursive: true });
  fs.cpSync(path.join(SKILL_JS, "vendor"), path.join(root, "vendor"), { recursive: true });
  if (withTemplates) {
    fs.cpSync(path.join(SKILL_JS, "templates"), path.join(root, "templates"), { recursive: true });
  } else {
    fs.mkdirSync(path.join(root, "templates"));
  }
  return root;
}

function runPrepare(root, extraArgs = []) {
  return execFileSync(process.execPath,
                      [path.join(root, "tools", "helpers", "build_templates", "prepare_templates.cjs"), ...extraArgs],
                      { encoding: "utf8", timeout: 600000 });
}

test("prepare: обязательные fixture шаблонов присутствуют", () => {
  for (const f of ["default_dark.pptx", "default_light.pptx"]) {
    assert.ok(fs.existsSync(path.join(SKILL_JS, "templates", f)),
              `обязательный fixture templates/${f} отсутствует — prepare-тесты невозможны`);
  }
});

test("prepare: повторный запуск идемпотентен (полное prepared tree)", { timeout: 600000 }, () => {
  const root = makeSandbox();
  const tree = path.join(root, "templates");
  const filter = (fp) => !/[\\/]pages[\\/]/.test(fp);
  runPrepare(root);
  const h1 = hashTree(tree, filter);
  for (const f of ["default_dark-ref/template.json", "default-ref/slides.md",
                   "default-ref/decor/CATALOG.md", "default-ref/decor/pictograms/picto-index.json"]) {
    assert.ok(fs.existsSync(path.join(tree, f)), `prepare не создал ${f}`);
  }
  runPrepare(root);
  const h2 = hashTree(tree, filter);
  runPrepare(root);
  const h3 = hashTree(tree, filter);
  assert.strictEqual(h2, h1, "2-й прогон изменил prepared tree");
  assert.strictEqual(h3, h2, "3-й прогон изменил prepared tree");
});

test("prepare: неполные shots не заменяют существующие contact sheets", { timeout: 600000 }, () => {
  const root = makeSandbox();
  runPrepare(root);
  const tree = path.join(root, "templates");
  const mediaDir = path.join(tree, "default_dark-ref", "media");
  const sampleName = fs.readdirSync(mediaDir).find((f) => f.endsWith(".png"));
  assert.ok(sampleName, "нет PNG fixture для contact sheet");
  const sample = fs.readFileSync(path.join(mediaDir, sampleName));
  const sheet = path.join(tree, "default-ref", "protos-dark.png");
  fs.writeFileSync(sheet, sample);
  const shots = path.join(tree, "default_dark-ref", "shots");
  fs.mkdirSync(shots, { recursive: true });
  fs.writeFileSync(path.join(shots, "slide-01.png"), sample);
  runPrepare(root);
  assert.deepStrictEqual(fs.readFileSync(sheet), sample, "неполный render заменил прежний sheet");
  assert.ok(!fs.existsSync(path.join(tree, "default-ref", "protos-dark-2.png")),
            "неполный render создал replacement sheets");
});

test("prepare: missing-atlas recovery — --force пересобирает, затем идемпотентно", { timeout: 600000 }, () => {
  const root = makeSandbox();
  runPrepare(root, ["--force"]);
  const tree = path.join(root, "templates");
  // _source.json — freshness cache (mtime копии), не deliverable
  const filter = (fp) => !/[\\/]pages[\\/]/.test(fp) && !fp.endsWith("_source.json");
  const stable = hashTree(tree, filter);
  // missing-atlas recovery: удалить машинный атлас и восстановить точной командой
  fs.rmSync(path.join(tree, "default_dark-ref"), { recursive: true, force: true });
  runPrepare(root, ["--force"]);
  assert.ok(fs.existsSync(path.join(tree, "default_dark-ref", "template.json")), "recovery не восстановил template.json");
  runPrepare(root);
  assert.strictEqual(hashTree(tree, filter), stable, "после recovery дерево отличается от эталонного");
});

test("prepare: pictogram metadata/CATALOG не теряются без pages/", { timeout: 600000 }, () => {
  const root = makeSandbox();
  runPrepare(root);
  const darkRef = path.join(root, "templates", "default_dark-ref");
  const catalog = path.join(root, "templates", "default-ref", "decor", "CATALOG.md");
  assert.ok(!fs.existsSync(path.join(darkRef, "pages")), "pages/ должны быть удалены prepare");
  assert.ok(/## Pictograms \(\d+\)/.test(fs.readFileSync(catalog, "utf8")), "CATALOG потерял пиктограммы");
});

test("prepare: отсутствие обязательного fixture → ненулевой exit", () => {
  const root = makeSandbox({ withTemplates: false });
  let code = 0;
  try {
    runPrepare(root);
  } catch (e) {
    code = e.status ?? 1;
  }
  assert.notStrictEqual(code, 0, "prepare обязан падать без templates/default_*.pptx");
});

test("prepare: failure → ненулевой exit (require.main entry)", () => {
  // sandbox: tools+vendor скилла, битый default_dark.pptx → unpack падает, exit != 0
  const root = makeSandbox({ withTemplates: false });
  fs.writeFileSync(path.join(root, "templates", "default_dark.pptx"), "not a zip");
  fs.writeFileSync(path.join(root, "templates", "default_light.pptx"), "not a zip");
  let code = 0;
  try {
    execFileSync(process.execPath, [path.join(root, "tools", "helpers", "build_templates", "prepare_templates.cjs")],
                 { encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    code = e.status ?? 1;
  }
  assert.notStrictEqual(code, 0, "битые шаблоны обязаны давать ненулевой exit");
});
