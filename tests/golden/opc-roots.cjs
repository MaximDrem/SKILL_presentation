// opc-roots.cjs — raw-root acceptance: [Content_Types].xml и .rels имеют
// default-namespace корни (не ct:/rel:), отдельно от prefix-agnostic canon.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const { unzipSync } = require("../../vendor/fflate/lib/node.cjs");
const { Package, Part, RT, CT } = require("../../tools/helpers/builder/opc.cjs");
const { El } = require("../../tools/helpers/xml.cjs");

const NS_PML = "http://schemas.openxmlformats.org/presentationml/2006/main";

function buildMinimal() {
  const pkg = new Package();
  const pres = new Part(pkg, "/ppt/presentation.xml", CT.PML_PRESENTATION_MAIN);
  const root = new El(NS_PML, "presentation");
  root.attrs.set("xmlns:a", "ignored"); // парсер-атрибуты не попадают; сериализатор сам
  pres.xmlEl = root;
  pkg.addPart(pres);
  pkg.pkgRels.relateTo(RT.OFFICE_DOCUMENT, "/ppt/presentation.xml");
  return pkg.save();
}

test("opc roots: [Content_Types].xml — default namespace, без ct:", () => {
  const files = unzipSync(buildMinimal());
  const raw = Buffer.from(files["[Content_Types].xml"]).toString("utf8");
  const rootLine = raw.split("\n")[1];
  assert.ok(rootLine.startsWith('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"'), rootLine.slice(0, 200));
  assert.ok(!raw.includes("<ct:") && !raw.includes("</ct:"), "ct: prefix в [Content_Types].xml");
});

test("opc roots: .rels — default namespace, без rel:", () => {
  const files = unzipSync(buildMinimal());
  const raw = Buffer.from(files["_rels/.rels"]).toString("utf8");
  const rootLine = raw.split("\n")[1];
  assert.ok(rootLine.startsWith('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"'), rootLine.slice(0, 200));
  assert.ok(!raw.includes("<rel:") && !raw.includes("</rel:"), "rel: prefix в .rels");
  assert.ok(raw.includes('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'));
});
