// render.cjs — вызов --pptx-verify приложения и работа с шотами
// (порт helpers/render.py v3.2.1). Растровые операции — helpers/raster.cjs.
'use strict';
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { bFail } = require("./errors.cjs");
const raster = require("./raster.cjs");

const RENDER_HINT = 'env -u ELECTRON_RUN_AS_NODE "<бинарь приложения>" [<путь приложения из GIGATOOL_APP_PATH> -- для dev] --pptx-verify "<deck>" --out-dir "<dir>"';

// bounded timeout: зависший Chromium не блокирует build/check навсегда
const VERIFY_TIMEOUT_MS = 10 * 60 * 1000;

function runVerify(pptxPath, shotsDir, { app = null, binary = null, quiet = false } = {}) {
  binary = binary || process.env.GIGATOOL_NODE || process.env.MULTITOOL_NODE;
  if (!binary) {
    bFail(3, { error: "рендер невозможен: не задан GIGATOOL_NODE (бинарь приложения)",
               suggestion: RENDER_HINT });
  }
  app = app || process.env.GIGATOOL_APP_PATH || process.env.MULTITOOL_APP_PATH;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const renderer = process.env.GIGATOOL_RENDERER_URL || process.env.MULTITOOL_RENDERER_URL;
  if (renderer) env.ELECTRON_RENDERER_URL = renderer;
  const cmd = [binary, ...(app ? [app] : []), "--pptx-verify", String(pptxPath), "--out-dir", String(shotsDir)];
  let stdout = "";
  let code = 0;
  let timedOut = false;
  const log = path.join(String(shotsDir), "verify.log");
  const spawnOpts = { env, timeout: VERIFY_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 64 * 1024 * 1024, detached: true };
  if (quiet) {
    // stdout+stderr → единый verify.log (fd-level merge, как stderr=STDOUT в Python),
    // лог пишется ДО обработки кода возврата
    fs.mkdirSync(String(shotsDir), { recursive: true });
    const fd = fs.openSync(log, "w");
    let r;
    try {
      r = spawnSync(cmd[0], cmd.slice(1), { ...spawnOpts, stdio: ["ignore", fd, fd] });
    } finally {
      fs.closeSync(fd);
    }
    if (r.error && r.error.code === "ETIMEDOUT") timedOut = true;
    code = r.status === null ? (timedOut ? 124 : 1) : r.status;
    stdout = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
    if (!stdout) { try { fs.unlinkSync(log); } catch { /* noop */ } }
    if (timedOut && r.pid) { try { process.kill(-r.pid, "SIGKILL"); } catch { /* уже умерли */ } }
  } else {
    const r = spawnSync(cmd[0], cmd.slice(1), { ...spawnOpts, stdio: "inherit" });
    if (r.error && r.error.code === "ETIMEDOUT") timedOut = true;
    code = r.status === null ? (timedOut ? 124 : 1) : r.status;
    if (timedOut && r.pid) { try { process.kill(-r.pid, "SIGKILL"); } catch { /* уже умерли */ } }
  }
  if (timedOut) {
    bFail(3, { error: `рендер --pptx-verify превысил ${Math.round(VERIFY_TIMEOUT_MS / 60000)} мин и был остановлен`,
               suggestion: "проверьте зависший процесс приложения; полный лог: " + log });
  }
  let nBad = 0;
  if (quiet && stdout) {
    const lines = stdout.split("\n").filter((ln) => ln.trim());
    if (quiet === "unpack") {
      console.log(`verify: ${lines.length} строк от рендера референса — игнорируем (чужой дизайн); полный лог: ${log}`);
    } else {
      const ACTIONABLE = ["TEXT CLIPPED", "TEXT OVERLAP", "LOW CONTRAST"];
      const bad = lines.filter((ln) => ACTIONABLE.some((k) => ln.includes(k)));
      nBad = bad.length;
      const rest = lines.length - bad.length;
      for (const ln of bad) console.log(ln);
      if (!bad.length) console.log("verify: дефектов текста не найдено (TEXT CLIPPED / TEXT OVERLAP / LOW CONTRAST отсутствуют)");
      if (rest) console.log(`verify: ещё ${rest} строк — bleed/прочее, не требует действий`);
    }
  }
  if (code !== 0) {
    if (quiet && stdout) console.log(stdout);
    bFail(3, { error: `рендер --pptx-verify завершился с кодом ${code}`,
               suggestion: "смотрите вывод рендера выше; частая причина — нерендеримое медиа или битый граф в спеке" });
  }
  const rep = path.join(String(shotsDir), "report.json");
  if (fs.existsSync(rep)) fs.unlinkSync(rep);
  return nBad;
}

function natKey(p) {
  return path.basename(String(p)).split(/(\d+)/).map((t) => /^\d+$/.test(t) ? parseInt(t, 10) : t);
}

function rasterizeSvg(p, px = 160) {
  return raster.rasterizeSvg(p, px);
}

function decorThumbs(files, dstDir, { gridCols = 4, gridRows = 4, cell = 400 } = {}) {
  return raster.decorThumbs(files, dstDir, { gridCols, gridRows, cell });
}

function cropViewportStrips(shots, px = 8) {
  return raster.cropViewportStrips(shots, px);
}

function thumbsFromShots(shots, dstDir, { gridCols = 4, gridRows = 4, tileW = 480, prefix = "thumbs" } = {}) {
  return raster.thumbsFromShots(shots, dstDir, { gridCols, gridRows, tileW, prefix });
}

function renderAndThumbs(outPath, deckDir, app, pageCount) {
  const shotsDir = path.join(deckDir, "shots");
  fs.mkdirSync(shotsDir, { recursive: true });
  for (const old of fs.readdirSync(shotsDir)) fs.unlinkSync(path.join(shotsDir, old));
  const nBad = runVerify(outPath, shotsDir, { app, quiet: "build" });
  const shots = fs.readdirSync(shotsDir).filter((f) => f.endsWith(".png"))
    .map((f) => path.join(shotsDir, f))
    .sort((a, b) => natKeyCmp(natKey(a), natKey(b)));
  if (shots.length !== pageCount) {
    bFail(3, { error: `шотов ${shots.length}, страниц ${pageCount} — рендер неполный`,
               suggestion: `смотрите лог рендера: ${shotsDir}/verify.log; исправьте причину и повторите build` });
  }
  const nCropped = cropViewportStrips(shots);
  if (nCropped) console.log(`shots: кроп полос вьюпорта у ${nCropped} шотов`);
  const files = thumbsFromShots(shots, deckDir, { prefix: "preview" });
  return [shots, files, nBad];
}

function natKeyCmp(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i >= a.length) return -1;
    if (i >= b.length) return 1;
    const [x, y] = [a[i], b[i]];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

module.exports = { RENDER_HINT, runVerify, natKey, natKeyCmp, rasterizeSvg, decorThumbs, cropViewportStrips, thumbsFromShots, renderAndThumbs };
