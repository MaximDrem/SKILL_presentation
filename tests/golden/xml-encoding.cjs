// xml-encoding.cjs — декодирование XML по BOM/declaration (UTF-16LE/BE, cp1251),
// не-UTF-8 template parts не повреждаются при parse→serialize round-trip.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const { parseXml, docRoot, serialize, decodeXml } = require("../../tools/helpers/xml.cjs");

const SLIDE = `<?xml version="1.0" encoding="{ENC}" standalone="yes"?>\n` +
  `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
  `<p:cSld><p:spTree><p:sp><p:txBody><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
  `<a:r><a:t>Текст — ё Ё № «кавычки» €</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

function texts(root) {
  const out = [];
  for (const n of root.iter()) {
    if (n.local === "t") out.push(n.children.join(""));
  }
  return out;
}

const EXPECTED_TEXT = "Текст — ё Ё № «кавычки» €";

test("xml encoding: UTF-16LE с BOM", () => {
  const buf = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(SLIDE.replace("{ENC}", "UTF-16"), "utf16le")]);
  const root = docRoot(parseXml(buf));
  assert.strictEqual(root.local, "sld");
  assert.deepStrictEqual(texts(root), [EXPECTED_TEXT]);
});

test("xml encoding: UTF-16BE с BOM", () => {
  const le = Buffer.from(SLIDE.replace("{ENC}", "UTF-16"), "utf16le");
  const be = Buffer.alloc(le.length);
  for (let i = 0; i < le.length; i += 2) { be[i] = le[i + 1]; be[i + 1] = le[i]; }
  const buf = Buffer.concat([Buffer.from([0xFE, 0xFF]), be]);
  assert.deepStrictEqual(texts(docRoot(parseXml(buf))), [EXPECTED_TEXT]);
});

test("xml encoding: UTF-16LE без BOM (sniff по нулевым байтам)", () => {
  const buf = Buffer.from(SLIDE.replace("{ENC}", "UTF-16"), "utf16le");
  assert.deepStrictEqual(texts(docRoot(parseXml(buf))), [EXPECTED_TEXT]);
});

test("xml encoding: windows-1251 по declaration", () => {
  const src = SLIDE.replace("{ENC}", "windows-1251");
  const bytes = [];
  const table = {};
  for (let cp = 0x410; cp <= 0x44F; cp++) table[String.fromCodePoint(cp)] = cp - 0x410 + 0xC0;
  table["ё"] = 0xB8; table["Ё"] = 0xA8; table["№"] = 0xB9; table["—"] = 0x97;
  table["«"] = 0xAB; table["»"] = 0xBB;
  for (const ch of src) {
    const code = ch.codePointAt(0);
    bytes.push(table[ch] !== undefined ? table[ch] : code < 0x80 ? code : 0x3F);
  }
  const buf = Buffer.from(bytes);
  const root = docRoot(parseXml(buf));
  assert.deepStrictEqual(texts(root), ["Текст — ё Ё № «кавычки» ?"]); // € вне cp1251 → ?
});

test("xml encoding: UTF-8 BOM срезается", () => {
  const buf = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(SLIDE.replace("{ENC}", "UTF-8"), "utf8")]);
  assert.deepStrictEqual(texts(docRoot(parseXml(buf))), [EXPECTED_TEXT]);
});

test("xml encoding: round-trip не повреждает контент", () => {
  const buf = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(SLIDE.replace("{ENC}", "UTF-16"), "utf16le")]);
  const root = docRoot(parseXml(buf));
  const out = serialize(root);
  const root2 = docRoot(parseXml(out));
  assert.deepStrictEqual(texts(root2), [EXPECTED_TEXT]);
});
