// cli-parity.cjs — CLI golden parity: exit/stdout/stderr после нормализации путей.
'use strict';
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { SKILL_JS, GOLD, FIX } = require("./oracle.cjs");

const DECK = path.join(SKILL_JS, "tools", "deck.cjs");

function cleanEnv(extra) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(GIGATOOL_|MULTITOOL_|DECK_)/.test(k)) delete env[k];
    // deck subprocess — чистый Node/Electron Node-mode: ELECTRON_RUN_AS_NODE сохраняем,
    // прочие ELECTRON_* (GUI-режим) снимаем; renderer child снимает флаг сам (render.cjs)
    else if (/^ELECTRON_/.test(k) && k !== "ELECTRON_RUN_AS_NODE") delete env[k];
  }
  return { ...env, ...extra };
}

// нормализация вывода к канонической форме (общей с Python-goldens)
function normOut(s, tmp) {
  if (!s) return s;
  s = s.replace(/\/tmp\/oracle-cli-[\w-]+/g, "<TMP>");
  s = s.split(CAPTURE_SKILL_JS).join("<SKILL_JS>");
  s = s.split(SKILL_JS).join("<SKILL_JS>");
  s = s.split(tmp).join("<TMP>");
  // recovery-команды → канонический маркер (кавычки могут быть \" в JSON)
  const Q = '\\\\?"';
  s = s.replace(new RegExp(`ELECTRON_RUN_AS_NODE=1 ${Q}\\$GIGATOOL_NODE${Q} ${Q}<SKILL_JS>[/\\\\]+tools[/\\\\]+deck\\.(cjs|py)${Q}`, "g"), "<DECK>");
  s = s.replace(new RegExp(`PYTHONPATH=${Q}<SKILL>[/\\\\]+site-packages${Q} ${Q}<PY>${Q} ${Q}<SKILL>[/\\\\]+tools[/\\\\]+deck(\\.py)?${Q}`, "g"), "<DECK>");
  s = s.replace(new RegExp(`ELECTRON_RUN_AS_NODE=1 ${Q}\\$GIGATOOL_NODE${Q} ${Q}<SKILL_JS>[/\\\\]+tools[/\\\\]+helpers[/\\\\]+build_templates[/\\\\]+prepare_templates\\.(cjs|py)${Q}`, "g"), "<PREPARE>");
  s = s.replace(new RegExp(`PYTHONPATH=${Q}<SKILL>[/\\\\]+site-packages${Q} ${Q}<PY>${Q} ${Q}<SKILL>[/\\\\]+tools[/\\\\]+helpers[/\\\\]+build_templates[/\\\\]+prepare_templates\\.py${Q}`, "g"), "<PREPARE>");
  s = s.replace(/deck\.cjs/g, "deck.py");
  s = s.replace(/prepare_templates\.cjs/g, "prepare_templates.py");
  return s;
}

const CAPTURE_SKILL_JS = "/home/maksi/gigatool_skill_v3/SKILL_WORK_js";

function runCli(name) {
  const golden = JSON.parse(fs.readFileSync(path.join(GOLD, "cli", name + ".json"), "utf8"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cli-parity-"));
  const argv = golden.argv.map((a) =>
    a.replaceAll("<TMP>", tmp)
     .replace(/\/tmp\/oracle-cli-[\w-]+/g, tmp)
     .replaceAll(CAPTURE_SKILL_JS, SKILL_JS)
     .replaceAll("<SKILL_JS>", SKILL_JS)
     .replaceAll("<SKILL>", SKILL_JS)
     .replaceAll("<PY>", "node")
  );
  // особые случаи: побочные файлы
  if (name === "unpack-corrupt") {
    fs.writeFileSync(path.join(tmp, "bad.pptx"), "not a zip");
  }
  // generic: --template X.pptx + --ref <dir under tmp> (не существует) → unpack X → dir,
  // но НЕ если сценарий тестирует отсутствующий/протухший атлас
  {
    const tIdx = argv.indexOf("--template"), rIdx = argv.indexOf("--ref");
    const atlasScenario = /_source\.json|атлас/.test(golden.stderr || "");
    if (tIdx >= 0 && rIdx >= 0 && !atlasScenario) {
      const refDir = argv[rIdx + 1];
      const tpl = argv[tIdx + 1];
      if (refDir.includes(tmp) && !fs.existsSync(refDir)) {
        execFileSync(process.execPath, [DECK, "unpack", tpl, "--out", refDir, "--with-pages", "--no-decor-thumbs"], { env: cleanEnv() });
      }
    }
  }
  if (name === "check-stale-atlas") {
    // unpack вручную (provision отключён из-за atlasScenario), затем добавить байт
    const stalePptx = path.join(tmp, "stale.pptx");
    const staleRef = path.join(tmp, "stale-ref");
    fs.copyFileSync(path.join(FIX, "tiny-clone.pptx"), stalePptx);
    execFileSync(process.execPath, [DECK, "unpack", stalePptx, "--out", staleRef, "--no-decor-thumbs"], { env: cleanEnv() });
    fs.appendFileSync(stalePptx, "x");
  }
  const envExtra = {};
  if (name.startsWith("build-") && name !== "build-render-fail") envExtra.DECK_SKIP_RENDER = "1";
  let exit = 0, stdout = "", stderr = "";
  try {
    stdout = execFileSync(process.execPath, [DECK, ...argv], { env: cleanEnv(envExtra), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 900000 });
  } catch (e) {
    exit = e.status ?? 1;
    stdout = e.stdout ? e.stdout.toString() : "";
    stderr = e.stderr ? e.stderr.toString() : "";
  }
  return {
    golden, tmp, argv, result: { exit, stdout: normOut(stdout, tmp), stderr: normOut(stderr, tmp) },
  };
}

function assertCliParity(name) {
  const { golden, tmp, argv, result } = runCli(name);
  const exp = { exit: golden.exit, stdout: normOut(golden.stdout, "<TMP>"), stderr: normOut(golden.stderr, "<TMP>") };
  const problems = [];
  if (result.exit !== exp.exit) problems.push(`exit: ${result.exit} !== ${exp.exit}`);
  if (result.stdout !== exp.stdout) problems.push(`stdout:\n--- CJS ---\n${result.stdout.slice(0, 600)}\n--- PY ---\n${exp.stdout.slice(0, 600)}`);
  if (result.stderr !== exp.stderr) problems.push(`stderr:\n--- CJS ---\n${result.stderr.slice(0, 600)}\n--- PY ---\n${exp.stderr.slice(0, 600)}`);
  if (golden.outExists !== undefined) {
    const outIdx = argv.indexOf("--out");
    if (outIdx >= 0) {
      const exists = fs.existsSync(argv[outIdx + 1]);
      if (exists !== golden.outExists) problems.push(`outExists: ${exists} !== ${golden.outExists} (${argv[outIdx + 1]})`);
    } else {
      problems.push("outExists в golden, но нет --out в argv");
    }
  }
  void tmp;
  if (problems.length) throw new Error(`${name}: ${problems.join("; ")}`);
}

module.exports = { runCli, assertCliParity, cleanEnv };
