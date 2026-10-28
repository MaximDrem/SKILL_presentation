// errors.cjs — JSON-envelope ошибки (stderr + exit code) и recovery-строки.
'use strict';
const fs = require("fs");
const path = require("path");
const { pyJsonDumps } = require("./numfmt.cjs");

function bFail(code, obj) {
  // синхронный цикл записи ВСЕГО envelope в fd 2 до полного количества байт:
  // writeSync может вернуться с частичной записью; process.exit обрезает async
  // pipe-запись (конверт больше pipe buffer терялся). EAGAIN (non-blocking pipe
  // с полным буфером) — короткое ожидание и повтор, иначе envelope маскируется.
  const buf = Buffer.from(pyJsonDumps(obj, 2) + "\n", "utf8");
  const sab = new Int32Array(new SharedArrayBuffer(4));
  let off = 0;
  while (off < buf.length) {
    try {
      off += fs.writeSync(2, buf, off, buf.length - off);
    } catch (e) {
      if (e && e.code === "EAGAIN") { Atomics.wait(sab, 0, 0, 1); continue; }
      throw e;
    }
  }
  process.exit(code);
}

function skillRoot() {
  return path.resolve(__dirname, "..", "..");
}

// Копипастабельная команда под Electron Node-mode (v4): ELECTRON_RUN_AS_NODE=1 $GIGATOOL_NODE.
function skillCmd(script, ...args) {
  const skill = skillRoot();
  const tail = args.map((a) => `"${a}"`).join(" ");
  return `ELECTRON_RUN_AS_NODE=1 "$GIGATOOL_NODE" "${path.join(skill, script)}"` + (tail ? ` ${tail}` : "");
}

function deckCmd(...args) {
  return skillCmd(path.join("tools", "deck.cjs"), ...args);
}

module.exports = { bFail, skillCmd, deckCmd, skillRoot };
