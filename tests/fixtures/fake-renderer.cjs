// fake-renderer.cjs — фейковый --pptx-verify: пишет N PNG и логи в stdout/stderr.
// Управление через env:
//   __FAKE_SLIDES  — сколько PNG записать (default 5)
//   __FAKE_LOG     — "stdout" | "stderr" | "mixed" | "" (default stdout)
//   __FAKE_EXIT    — код возврата (default 0)
//   __FAKE_HANG    — "1" → повиснуть (для timeout-тестов, не используется в CI)
'use strict';
const fs = require("fs");
const path = require("path");

const outDir = process.argv[process.argv.indexOf("--out-dir") + 1];
fs.mkdirSync(outDir, { recursive: true });

// валидный PNG 32×24 через vendored pngjs
const { PNG } = require(path.join(process.env.__SKILL_JS, "vendor", "pngjs"));
const n = parseInt(process.env.__FAKE_SLIDES || "5", 10);
for (let i = 1; i <= n; i++) {
  const png = new PNG({ width: 32, height: 24 });
  for (let j = 0; j < png.data.length; j += 4) {
    png.data[j] = 30 * i; png.data[j + 1] = 60; png.data[j + 2] = 90; png.data[j + 3] = 255;
  }
  fs.writeFileSync(path.join(outDir, `slide-${i}.png`), PNG.sync.write(png));
}

const LINES = ["verify start", "TEXT CLIPPED slide 1: t", "bleed note: ок", "verify done"];
const mode = process.env.__FAKE_LOG ?? "stdout";
if (mode === "stdout") {
  for (const ln of LINES) process.stdout.write(ln + "\n");
} else if (mode === "stderr") {
  for (const ln of LINES) process.stderr.write(ln + "\n");
} else if (mode === "mixed") {
  process.stdout.write(LINES[0] + "\n" + LINES[1] + "\n");
  process.stderr.write(LINES[2] + "\n" + LINES[3] + "\n");
}

if (process.env.__FAKE_HANG === "1") {
  setInterval(() => {}, 1000);
} else {
  process.exit(parseInt(process.env.__FAKE_EXIT || "0", 10));
}
