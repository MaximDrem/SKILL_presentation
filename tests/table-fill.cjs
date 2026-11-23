'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const { El } = require("../tools/helpers/xml.cjs");
const { parseFrag, findL, removeL, NS_A } = require("../tools/helpers/builder/xmlbuild.cjs");
const norm = require("../tools/helpers/builder/pptxgen-normalize.cjs");
const { qaWarnings, tableFillMismatches } = require("../tools/helpers/builder/qa.cjs");

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function fixture(rows) {
  const el = {
    id: "tbl",
    type: "table",
    bounds: [0, 0, 100, 50],
    table: {
      colW: [50, 50],
      rows: rows || [
        [{ text: "H1", fill: "#FFFFFF26" }, { text: "H2", fill: "#12363F" }],
        [{ text: "body1" }, { text: "body2", fill: "none" }],
      ],
      color: "#FFFFFF",
      sz: 14,
    },
  };
  const gf = parseFrag(`<p:graphicFrame ${P} ${A}><p:nvGraphicFramePr><p:cNvPr id="2" name="tbl" descr="gid:1:0"/><p:nvPr/></p:nvGraphicFramePr>` +
    `<a:graphic><a:graphicData><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="476250"/><a:gridCol w="476250"/></a:tblGrid></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`);
  norm.normalizeTable(gf, el, 9525);
  const slide = parseFrag(`<p:sld ${P} ${A}><p:cSld><p:spTree/></p:cSld></p:sld>`);
  findL(findL(slide, "cSld"), "spTree").children.push(gf);
  return {
    slide,
    gf,
    item: { file: "slide-01.json", idx: 1, spec: { elements: [el] } },
  };
}

function cells(gf) {
  const tbl = findL(findL(findL(gf, "graphic"), "graphicData"), "tbl");
  return tbl.children.filter((c) => c instanceof El && c.local === "tr")
    .map((tr) => tr.children.filter((c) => c instanceof El && c.local === "tc"));
}

test("table cell fill preserves RGB alpha and noFill", () => {
  const { slide, gf, item } = fixture();
  const rows = cells(gf);
  const translucent = findL(findL(findL(rows[0][0], "tcPr"), "solidFill"), "srgbClr");
  assert.strictEqual(translucent.attrs.get("val"), "FFFFFF");
  assert.strictEqual(findL(translucent, "alpha").attrs.get("val"), "14902");
  const opaque = findL(findL(findL(rows[0][1], "tcPr"), "solidFill"), "srgbClr");
  assert.strictEqual(opaque.attrs.get("val"), "12363F");
  assert.strictEqual(findL(opaque, "alpha"), null);
  for (const cell of rows[1]) assert.ok(findL(findL(cell, "tcPr"), "noFill"));
  assert.deepStrictEqual(tableFillMismatches(slide, item), []);
});

test("post-build table invariant catches lost alpha", () => {
  const { slide, gf, item } = fixture();
  const clr = findL(findL(findL(cells(gf)[0][0], "tcPr"), "solidFill"), "srgbClr");
  removeL(clr, "alpha");
  assert.deepStrictEqual(tableFillMismatches(slide, item), [{
    page: "slide-01.json",
    el: "tbl",
    cell: [1, 1],
    expected: "#FFFFFF26",
    actual: "#FFFFFF",
  }]);
});

test("post-build table invariant skips merged follower cells", () => {
  const { slide, item } = fixture([
    [{ text: "A", fill: "#FFFFFF26", colSpan: 2 }, { text: "merged", fill: "#FFFFFF" }],
    [{ text: "B" }, { text: "C" }],
  ]);
  assert.deepStrictEqual(tableFillMismatches(slide, item), []);
});

test("source QA accepts translucent table header on dark background", () => {
  const spec = {
    background: { type: "solid", color: "#0C0C0C" },
    elements: [{
      id: "tbl",
      type: "table",
      bounds: [0, 0, 100, 50],
      table: { colW: [100], rows: [[{ text: "Header", color: "#FFFFFF", fill: "#FFFFFF26" }]] },
    }],
  };
  assert.deepStrictEqual(qaWarnings([{ file: "slide-01.json", spec }]), [[], []]);
});
