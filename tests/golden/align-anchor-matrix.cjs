// align-anchor-matrix.cjs — полная матрица align×anchor через production adapter
// (PptxGenJS → normalizer → shell spTree): algn/anchor атрибуты в XML текстбокса.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const { renderContentDeck, graftSlideContent } = require("../../tools/helpers/builder/pptxgen-adapter.cjs");
const { Package } = require("../../tools/helpers/builder/opc.cjs");
const { NS_P, NS_A, mk } = require("../../tools/helpers/builder/xmlbuild.cjs");
const { serialize } = require("../../tools/helpers/xml.cjs");

const ALIGNS = { l: "l", ctr: "ctr", r: "r", just: "just" };
const ANCHORS = ["t", "ctr", "b"];

async function buildTextXml(align, anchor) {
  const el = { id: "t", type: "text", bounds: [60, 100, 200, 40],
               paragraphs: [{ runs: [{ text: "x", sz: 18 }], ...(align ? { align } : {}) }],
               ...(anchor ? { anchor } : {}) };
  const buf = await renderContentDeck([{ file: "s.json", spec: { pageType: "content", proto: 1, elements: [el] } }],
                                      { k: 9525, projectDir: ".", slideWEmu: 12192000, slideHEmu: 6858000 });
  const pkg = Package.load(buf);
  const contentSlide = pkg.parts.get("/ppt/slides/slide1.xml");
  const spTree = mk(NS_P, "spTree");
  const grafted = graftSlideContent(spTree, contentSlide, [el], { importImageRel: () => "rId1", k: 9525 });
  for (const sh of grafted) spTree.children.push(sh);
  return serialize(spTree);
}

test("align×anchor: полная матрица", async () => {
  for (const [align, algn] of Object.entries(ALIGNS)) {
    for (const anchor of ANCHORS) {
      const xml = await buildTextXml(align, anchor);
      assert.ok(xml.includes(`algn="${algn}"`), `${align}/${anchor}: algn в ${xml.slice(0, 400)}`);
      assert.ok(xml.includes(`anchor="${anchor}"`), `${align}/${anchor}: anchor в ${xml.slice(0, 400)}`);
    }
  }
});

test("align×anchor: дефолты не пишут лишних атрибутов", async () => {
  const xml = await buildTextXml(null, null);
  assert.ok(!xml.includes("algn="), xml.slice(0, 400));
  assert.ok(!xml.includes("anchor="), xml.slice(0, 400));
});
