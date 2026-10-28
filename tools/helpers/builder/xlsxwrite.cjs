// xlsxwrite.cjs — embedded workbook writer: точное подмножество XlsxWriter 3.2.9
// (как использует python-pptx CategoryWorkbookWriter: General формат, sharedStrings).
'use strict';
const fs = require("fs");
const path = require("path");
const { zipSync, strToU8 } = require("../../../vendor/fflate/lib/node.cjs");
const { exactDecimal } = require("../numfmt.cjs");
const { isNumeric } = require("../jsonpy.cjs");

const TPL_DIR = path.join(__dirname, "..", "..", "..", "vendor", "xlsx-templates");
const tpl = (name) => fs.readFileSync(path.join(TPL_DIR, name.replaceAll("/", "__")), "utf8");

// Python %.16G (format(x, ".16G")): 16 значащих цифр, half-even на точном double
function pyG16(x) {
  if (Object.is(x, -0)) return "-0"; // '%.16G' % -0.0 → '-0'
  if (x === 0) return "0";
  const neg = x < 0;
  let { digits, point } = exactDecimal(Math.abs(x));
  const leadZeros = digits.match(/^0+/);
  if (leadZeros) {
    point -= leadZeros[0].length;
    digits = digits.slice(leadZeros[0].length) || "0";
  }
  // округлить до 16 значащих
  if (digits.length > 16) {
    const rest = digits.slice(16);
    let arr = digits.slice(0, 16).split("");
    const first = rest[0];
    const tail = rest.slice(1);
    let up = first > "5" || (first === "5" && /[1-9]/.test(tail));
    if (first === "5" && !/[1-9]/.test(tail)) up = parseInt(arr[15], 10) % 2 === 1;
    if (up) {
      let i = 15;
      while (i >= 0 && arr[i] === "9") { arr[i] = "0"; i--; }
      if (i < 0) { arr.unshift("1"); point++; } else arr[i] = String(parseInt(arr[i], 10) + 1);
    }
    digits = arr.join("").replace(/0+$/, "") || "0";
  }
  const exp10 = point - 1;
  let out;
  if (exp10 < -4 || exp10 >= 16) {
    let mant = digits[0] + (digits.length > 1 ? "." + digits.slice(1).replace(/0+$/, "") : "");
    if (mant.endsWith(".")) mant = mant.slice(0, -1);
    out = `${mant}E${exp10 >= 0 ? "+" : "-"}${String(Math.abs(exp10)).padStart(2, "0")}`;
  } else if (point <= 0) {
    out = "0." + "0".repeat(-point) + digits;
  } else if (point >= digits.length) {
    out = digits + "0".repeat(point - digits.length);
  } else {
    out = digits.slice(0, point) + "." + digits.slice(point).replace(/0+$/, "");
    if (out.endsWith(".")) out = out.slice(0, -1);
  }
  return neg ? "-" + out : out;
}

function xesc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// XlsxWriter _escape_control_characters: control chars (кроме \t \n \r) → _xHHHH_
function xescCtrl(s) {
  return [...String(s)].map((ch) => {
    const c = ch.codePointAt(0);
    if (c < 0x20 && ch !== "\t" && ch !== "\n" && ch !== "\r") {
      return `_x${c.toString(16).toUpperCase().padStart(4, "0")}_`;
    }
    return ch;
  }).join("");
}

// Excel base-26: 0→A … 25→Z, 26→AA, 27→AB (xlsxwriter xl_col_to_name)
function colLetter(i) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// XlsxWriter write() dispatch: number → number cell; str "="/"{=...}" → formula;
// "" → blank с форматом; прочие str → shared string. URL dispatch (strings_to_urls)
// не воспроизводим — категории-URL вне контракта.
function cellXml(ref, v, fmt) {
  const sAttr = fmt ? ' s="1"' : "";
  if (v === null || v === undefined) return `<c r="${ref}"${sAttr}/>`;
  if (isNumeric(v) && typeof v !== "boolean") return `<c r="${ref}"${sAttr}><v>${pyG16(Number(v))}</v></c>`;
  const str = String(v);
  if (str === "") return `<c r="${ref}"${sAttr}/>`;
  if (str.startsWith("=")) {
    return `<c r="${ref}"${sAttr}><f>${xesc(xescCtrl(str.slice(1)))}</f><v>0</v></c>`;
  }
  if (str.startsWith("{=") && str.endsWith("}")) {
    return `<c r="${ref}"${sAttr}><f t="array" ref="${ref}">${xesc(xescCtrl(str.slice(2, -1)))}</f><v>0</v></c>`;
  }
  return `<c r="${ref}"${sAttr} t="s"><v>${internS(xescCtrl(str))}</v></c>`;
}

// sharedStrings (module-scope state на один buildWorkbook — см. internS)
let _sst = null, _sstIdx = null, _strCount = 0;
function internS(s) {
  _strCount++;
  if (!_sstIdx.has(s)) {
    _sstIdx.set(s, _sst.length);
    _sst.push(s);
  }
  return _sstIdx.get(s);
}

// categories: [str|number], series: [{name, values:[number|PyFloat|PyInt|null]}]
function buildWorkbook(categories, series) {
  const nCols = 1 + series.length;
  // dimension — по максимальной используемой строке (серии могут быть длиннее/короче categories)
  const maxDataRows = Math.max(categories.length, ...series.map((s) => s.values.length));
  const nRows = 1 + maxDataRows;
  const dim = `A1:${colLetter(nCols - 1)}${nRows}`;

  _sst = []; _sstIdx = new Map(); _strCount = 0;

  // XlsxWriter write order: categories col A сначала (write_categories), затем по сериям
  // (name, затем values) — intern-порядок sharedStrings = порядок записи
  const catCells = categories.map((cat, ci) => cellXml(`A${ci + 2}`, cat, true));
  const nameCells = [];
  const valCells = [];
  series.forEach((s, i) => {
    nameCells.push(cellXml(`${colLetter(i + 1)}1`, s.name, false));
    valCells.push(s.values.map((v, ci) => cellXml(`${colLetter(i + 1)}${ci + 2}`, v, true)));
  });
  const rowXml = [];
  rowXml.push(`<row r="1" spans="1:${nCols}">${nameCells.join("")}</row>`);
  for (let ci = 0; ci < maxDataRows; ci++) {
    let cells = ci < catCells.length ? catCells[ci] : "";
    // строки только с реально записанными ячейками (XlsxWriter не пишет пустые row)
    let any = ci < catCells.length;
    series.forEach((s, i) => {
      if (ci < s.values.length) { cells += valCells[i][ci]; any = true; }
    });
    if (any) rowXml.push(`<row r="${ci + 2}" spans="1:${nCols}">${cells}</row>`);
  }
  const sst = _sst, strCount = _strCount;

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="${dim}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="10.7109375" customWidth="1"/></cols>` +
    `<sheetData>${rowXml.join("")}</sheetData>` +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;

  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strCount}" uniqueCount="${sst.length}">` +
    sst.map((s) => `<si><t${s !== s.trim() ? ' xml:space="preserve"' : ""}>${xesc(s)}</t></si>`).join("") + `</sst>`;

  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const core = tpl("docProps/core.xml").replace(/(<dcterms:(?:created|modified)[^>]*>)[^<]*(<\/dcterms:(?:created|modified)>)/g, `$1${now}$2`);

  return Buffer.from(zipSync({
    "[Content_Types].xml": strToU8(tpl("[Content_Types].xml")),
    "_rels/.rels": strToU8(tpl("_rels/.rels")),
    "xl/_rels/workbook.xml.rels": strToU8(tpl("xl/_rels/workbook.xml.rels")),
    "xl/workbook.xml": strToU8(tpl("xl/workbook.xml")),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    "xl/sharedStrings.xml": strToU8(sharedStrings),
    "xl/styles.xml": strToU8(tpl("xl/styles.xml")),
    "xl/theme/theme1.xml": strToU8(tpl("xl/theme/theme1.xml")),
    "docProps/core.xml": strToU8(core),
    "docProps/app.xml": strToU8(tpl("docProps/app.xml")),
  }));
}

module.exports = { buildWorkbook, pyG16 };
