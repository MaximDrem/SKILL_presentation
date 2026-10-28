// mc-namespaces.cjs — p14/p15/a14 + mc:AlternateContent CLONE fixtures:
// исходные prefix bindings сохраняются, QName-valued attrs (mc:Ignorable,
// mc:Choice/@Requires) ремапятся вместе с префиксами, undeclared prefixes нет.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { unzipSync } = require("../../vendor/fflate/lib/node.cjs");
const { Package, RT } = require("../../tools/helpers/builder/opc.cjs");
const { parseXml, docRoot, serialize } = require("../../tools/helpers/xml.cjs");
const { FIX } = require("../lib/oracle.cjs");

const P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main";
const P15 = "http://schemas.microsoft.com/office/powerpoint/2012/main";
const A14 = "http://schemas.microsoft.com/office/drawing/2010/main";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:p14="${P14}" xmlns:p15="${P15}" xmlns:a14="${A14}" xmlns:mc="${MC}" mc:Ignorable="p14 p15">
  <p:cSld><p:spTree>
    <mc:AlternateContent>
      <mc:Choice Requires="p14">
        <p:sp><p:txBody><a:p><a:r><a:rPr lang="ru-RU"><a14:modId val="1"/></a:rPr><a:t>новый</a:t></a:r></a:p></p:txBody></p:sp>
      </mc:Choice>
      <mc:Fallback>
        <p:sp><p:txBody><a:p><a:r><a:t>старый</a:t></a:r></a:p></p:txBody></p:sp>
      </mc:Fallback>
    </mc:AlternateContent>
    <p15:notesRef id="7"/>
  </p:spTree></p:cSld>
</p:sld>`;

// все prefix-токены, использованные в тегах/атрибутах/QName-значениях, объявлены
function assertNoUndeclaredPrefixes(xml) {
  const declared = new Set();
  for (const m of xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)=/g)) declared.add(m[1]);
  const used = new Set();
  for (const m of xml.matchAll(/<(\/?)([A-Za-z_][\w.-]*):/g)) used.add(m[2]);
  for (const m of xml.matchAll(/\s([A-Za-z_][\w.-]*):[\w.-]+=/g)) { if (m[1] !== "xmlns") used.add(m[1]); }
  for (const m of xml.matchAll(/(?:Ignorable|Requires)="([^"]+)"/g)) {
    for (const tok of m[1].split(/\s+/)) if (tok) used.add(tok);
  }
  used.delete("xml");
  const undeclared = [...used].filter((p) => !declared.has(p));
  assert.deepStrictEqual(undeclared, [], `undeclared prefixes; xml: ${xml.slice(0, 300)}`);
}

test("mc: AlternateContent + p14/p15/a14 — bindings сохраняются", () => {
  const parsed = parseXml(SLIDE_XML);
  const root = docRoot(parsed);
  const out = serialize(root, { docBindings: parsed.docBindings });
  // исходные префиксы на месте
  assert.ok(out.includes('xmlns:p14="'), out.slice(0, 400));
  assert.ok(out.includes('xmlns:p15="'), out.slice(0, 400));
  assert.ok(out.includes('xmlns:a14="'), out.slice(0, 400));
  assert.ok(out.includes('mc:Ignorable="p14 p15"'), out.slice(0, 400));
  assert.ok(out.includes('Requires="p14"'), out.slice(0, 400));
  assert.ok(out.includes("<p15:notesRef"), out.slice(0, 400));
  assert.ok(!out.includes("ns1:"), out.slice(0, 400));
  assertNoUndeclaredPrefixes(out);
});

test("mc: CLONE round-trip через Package.save/load сохраняет bindings", () => {
  const pkg = Package.load(fs.readFileSync(path.join(FIX, "tiny-clone.pptx")));
  const slide = pkg.parts.get("/ppt/slides/slide1.xml");
  const parsed = parseXml(SLIDE_XML);
  slide.xmlEl = docRoot(parsed);
  slide.docBindings = parsed.docBindings;
  const buf = pkg.save();
  const files = unzipSync(buf);
  const raw = Buffer.from(files["ppt/slides/slide1.xml"]).toString("utf8");
  assert.ok(raw.includes('mc:Ignorable="p14 p15"'), raw.slice(0, 400));
  assert.ok(raw.includes("<mc:AlternateContent>"), raw.slice(0, 400));
  assertNoUndeclaredPrefixes(raw);
  // повторная загрузка: те же расширенные имена
  const pkg2 = Package.load(buf);
  const s2 = pkg2.parts.get("/ppt/slides/slide1.xml");
  let sawChoice = false, sawP15 = false;
  for (const n of s2.xmlEl.iter()) {
    if (n.ns === MC && n.local === "Choice") {
      sawChoice = true;
      assert.strictEqual(n.attrs.get(`{${MC}}Requires`) ?? n.attrs.get("Requires"), "p14");
    }
    if (n.ns === P15 && n.local === "notesRef") sawP15 = true;
  }
  assert.ok(sawChoice && sawP15, "Choice/notesRef потерялись");
});

test("mc: remap QName-valued attrs при смене префикса", () => {
  // документ объявляет p14 → URI; сериализация с opts.prefixes переназначает p14 → zz
  const parsed = parseXml(SLIDE_XML);
  const root = docRoot(parsed);
  const out = serialize(root, { docBindings: parsed.docBindings, prefixes: { [P14]: "zz" } });
  assert.ok(out.includes(`xmlns:zz="${P14}"`), out.slice(0, 500));
  assert.ok(out.includes('mc:Ignorable="zz p15"'), out.slice(0, 500));
  assert.ok(out.includes('Requires="zz"'), out.slice(0, 500));
  assertNoUndeclaredPrefixes(out);
});

test("mc: URI только из mc:Ignorable (без элементов) объявляется", () => {
  const xml = `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:p15="${P15}" xmlns:mc="${MC}" mc:Ignorable="p15"><p:cSld/></p:sld>`;
  const parsed = parseXml(xml);
  const out = serialize(docRoot(parsed), { docBindings: parsed.docBindings });
  assert.ok(out.includes(`xmlns:p15="${P15}"`), out);
  assert.ok(out.includes('mc:Ignorable="p15"'), out);
  assertNoUndeclaredPrefixes(out);
});
