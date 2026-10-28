// regressions.cjs — регрессии production parity fixes v4 (разделы 1.6/2 плана):
// missing fill, slide/image numbering gaps, descendant MC bindings, half-EMU
// rounding, text alpha, opacity 1, chart-title \v, workbook controls.
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const { parseXml, docRoot, serialize, El } = require("../tools/helpers/xml.cjs");
const { parseFrag, findL, deepCopy, NS_A, NS_R } = require("../tools/helpers/builder/xmlbuild.cjs");
const { unzipSync, strToU8 } = require("../vendor/fflate/lib/node.cjs");
const norm = require("../tools/helpers/builder/pptxgen-normalize.cjs");
const { applyBounds } = require("../tools/helpers/builder/pptxgen-adapter.cjs");
const { Package, Part } = require("../tools/helpers/builder/opc.cjs");
const { setTitle } = require("../tools/helpers/builder/chart-normalize.cjs");
const { buildWorkbook } = require("../tools/helpers/builder/xlsxwrite.cjs");
const { encodePng, decodeImage, newImage } = require("../tools/helpers/raster.cjs");

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function mkShape() {
  return parseFrag(`<p:sp ${P} ${A}><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:p/></p:txBody></p:sp>`);
}

test("regression: RGB canvas PNG encode сохраняет каналы", () => {
  const img = newImage(2, 1, [0, 0, 0], 3);
  img.data.set([255, 0, 0, 0, 255, 0]);
  const decoded = decodeImage(encodePng(img), "png");
  assert.deepStrictEqual([...decoded.data], [255, 0, 0, 255, 0, 255, 0, 255]);
});

test("regression: missing/null shape fill → белый solidFill; {none:true} → noFill", () => {
  for (const fill of [undefined, null, {}]) {
    const sp = norm.normalizeShape(mkShape(), { type: "shape", shape: "rect", bounds: [0, 0, 10, 10], fill });
    const sf = findL(findL(sp, "spPr"), "solidFill");
    assert.ok(sf, `fill=${JSON.stringify(fill)}: solidFill отсутствует`);
    assert.strictEqual(findL(sf, "srgbClr").attrs.get("val"), "FFFFFF");
    assert.ok(!findL(findL(sp, "spPr"), "noFill"), "noFill не должен присутствовать");
  }
  const sp = norm.normalizeShape(mkShape(), { type: "shape", shape: "rect", bounds: [0, 0, 10, 10], fill: { none: true } });
  assert.ok(findL(findL(sp, "spPr"), "noFill"), "{none:true} обязан давать noFill");
});

function mkTextSp() {
  return parseFrag(`<p:sp ${P} ${A}><p:nvSpPr><p:cNvPr id="2" name="t"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:p><a:pPr/><a:r><a:rPr lang="en-US" dirty="0"/><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`);
}

test("regression: text run color #RRGGBBAA → только RGB, без alpha child", () => {
  const el = { type: "text", bounds: [0, 0, 10, 10], paragraphs: [{ runs: [{ text: "x", color: "#FF000080" }] }] };
  const sp = norm.normalizeTextShape(mkTextSp(), el);
  const rPr = findL(findL(findL(findL(sp, "txBody"), "p"), "r"), "rPr");
  const sf = findL(rPr, "solidFill");
  assert.ok(sf, "solidFill отсутствует");
  const clr = findL(sf, "srgbClr");
  assert.strictEqual(clr.attrs.get("val"), "FF0000");
  assert.ok(!findL(clr, "alpha"), "alpha child в text run недопустим");
});

function mkPic() {
  return parseFrag(`<p:pic ${P} ${A}><p:nvPicPr><p:cNvPr id="2" name="i"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
}

test("regression: image opacity >= 1 не создаёт alphaModFix; 0.5 → amt=50000", () => {
  for (const op of [1, 1.0, undefined, null]) {
    const pic = norm.normalizePic(mkPic(), { type: "image", bounds: [0, 0, 10, 10], src: "media/x.png", opacity: op });
    const blip = findL(findL(pic, "blipFill"), "blip");
    assert.ok(!findL(blip, "alphaModFix"), `opacity=${op}: alphaModFix недопустим`);
  }
  const pic = norm.normalizePic(mkPic(), { type: "image", bounds: [0, 0, 10, 10], src: "media/x.png", opacity: 0.5 });
  const amf = findL(findL(findL(pic, "blipFill"), "blip"), "alphaModFix");
  assert.ok(amf, "opacity=0.5: alphaModFix обязателен");
  assert.strictEqual(amf.attrs.get("amt"), "50000");
});

test("regression: half-EMU rounding — bounds перезаписываются pyRound (ties-to-even)", () => {
  // k = 1/128 (binary-exact): 320*k=2.5 → 2 (не Math.round → 3), 448*k=3.5 → 4,
  // 576*k=4.5 → 4, 640*k=5 → 5
  const k = 1 / 128;
  const sp = mkShape();
  const off0 = findL(findL(findL(sp, "spPr"), "xfrm"), "off");
  off0.attrs.set("x", "3"); // «как PptxGenJS» Math.round(2.5)
  applyBounds(sp, { bounds: [320, 448, 576, 640] }, k);
  const xf = findL(findL(sp, "spPr"), "xfrm");
  assert.strictEqual(findL(xf, "off").attrs.get("x"), "2", "half-EMU 2.5: ties-to-even");
  assert.strictEqual(findL(xf, "off").attrs.get("y"), "4", "half-EMU 3.5: ties-to-even");
  assert.strictEqual(findL(xf, "ext").attrs.get("cx"), "4", "half-EMU 4.5: ties-to-even");
  assert.strictEqual(findL(xf, "ext").attrs.get("cy"), "5");
  // graphicFrame: xfrm прямо на gf
  const gf = parseFrag(`<p:graphicFrame ${P} ${A}><p:nvGraphicFramePr/><p:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></p:xfrm></p:graphicFrame>`);
  applyBounds(gf, { bounds: [320, 0, 0, 0] }, k);
  assert.strictEqual(findL(findL(gf, "xfrm"), "off").attrs.get("x"), "2");
});

test("regression: slide/image part allocation — первый свободный полный partname", () => {
  const pkg = new Package();
  const mkp = (pn) => pkg.addPart(new Part(pkg, pn, "application/xml"));
  // gaps: slide1 + slide3 заняты → slide2
  mkp("/ppt/slides/slide1.xml");
  mkp("/ppt/slides/slide3.xml");
  assert.strictEqual(pkg.nextSlidePartname(), "/ppt/slides/slide2.xml");
  // mixed extensions: image1.png занят, image1.jpeg свободен
  mkp("/ppt/media/image1.png");
  assert.strictEqual(pkg.nextImagePartname("jpeg"), "/ppt/media/image1.jpeg");
  assert.strictEqual(pkg.nextImagePartname("png"), "/ppt/media/image2.png");
  // только что добавленные (ещё unreachable) учитываются
  mkp("/ppt/media/image2.png");
  assert.strictEqual(pkg.nextImagePartname("png"), "/ppt/media/image3.png");
  // chart template: первый свободный
  mkp("/ppt/charts/chart1.xml");
  assert.strictEqual(pkg.nextPartname("/ppt/charts/chart%d.xml"), "/ppt/charts/chart2.xml");
});

test("regression: addPart отказывается перезаписывать reachable part", () => {
  const pkg = new Package();
  const pres = new Part(pkg, "/ppt/presentation.xml", "application/xml");
  pres.xmlEl = new El(null, "presentation");
  pkg.addPart(pres);
  const slide = new Part(pkg, "/ppt/slides/slide1.xml", "application/xml");
  slide.xmlEl = new El(null, "sld");
  pkg.addPart(slide);
  // делаем slide reachable: pkg rel → presentation, presentation rel → slide
  pkg.pkgRels.relateTo("http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument", "/ppt/presentation.xml");
  pres.rels.relateTo("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide", "/ppt/slides/slide1.xml");
  assert.throws(() => pkg.addPart(new Part(pkg, "/ppt/slides/slide1.xml", "application/xml")), /reachable/);
  // unreachable с тем же именем (нет в pkg) — обычный новый part проходит
  assert.doesNotThrow(() => pkg.addPart(new Part(pkg, "/ppt/slides/slide9.xml", "application/xml")));
});

test("regression: descendant MC bindings и QName-valued attrs сохраняются", () => {
  // x14 объявлен на descendant: его scope действует на QName-attrs внутри него
  const xml = `<a:root xmlns:a="urn:a" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">` +
    `<a:child xmlns:x14="urn:x14" mc:Ignorable="x14"><mc:Choice Requires="x14"><a:x/></mc:Choice></a:child></a:root>`;
  const root = docRoot(parseXml(xml));
  const out = serialize(root, { docBindings: { a: "urn:a", mc: "http://schemas.openxmlformats.org/markup-compatibility/2006" } });
  // URI urn:x14 не в root bindings → получает авто-префикс nsN; QName-токены
  // descendant scope обязаны быть remapped на него, декларация поднята на root
  const m = out.match(/xmlns:(ns\d+)="urn:x14"/);
  assert.ok(m, `descendant binding потерян: ${out}`);
  assert.ok(out.includes(`Ignorable="${m[1]}"`), out);
  assert.ok(out.includes(`Requires="${m[1]}"`), out);
  assert.strictEqual(serialize(deepCopy(root), { docBindings: { a: "urn:a", mc: "http://schemas.openxmlformats.org/markup-compatibility/2006" } }), out,
                     "deepCopy обязан сохранять descendant nsScope");
  // root bindings работают как раньше
  const xml2 = `<a:root xmlns:a="urn:a" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:x14="urn:x14" mc:Ignorable="x14"><a:x/></a:root>`;
  const out2 = serialize(docRoot(parseXml(xml2)), { docBindings: { a: "urn:a", mc: "http://schemas.openxmlformats.org/markup-compatibility/2006", x14: "urn:x14" } });
  assert.ok(out2.includes('Ignorable="x14"') && out2.includes('xmlns:x14="urn:x14"'), out2);
});

test("regression: chart title \\n → paragraphs, \\v → a:br", () => {
  const root = docRoot(parseXml(`<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ${A}><c:chart><c:plotArea/></c:chart></c:chartSpace>`));
  setTitle(root, "one\vtwo\nthree");
  const title = findL(findL(root, "chart"), "title");
  const rich = findL(findL(title, "tx"), "rich");
  const ps = rich.children.filter((c) => c instanceof El && c.local === "p");
  assert.strictEqual(ps.length, 2, "должно быть 2 параграфа");
  assert.strictEqual(findL(ps[0], "br") !== null, true, "мягкий перенос \\v → a:br");
  const texts = (p) => p.children.filter((c) => c instanceof El && c.local === "r").map((r) => findL(r, "t").children.join(""));
  assert.deepStrictEqual(texts(ps[0]), ["one", "two"]);
  assert.deepStrictEqual(texts(ps[1]), ["three"]);
});

test("regression: importChart без сгенерированного chart part → явная ошибка (legacy fallback запрещён)", () => {
  const { importChart } = require("../tools/helpers/builder/pptxgen-chart.cjs");
  const { Package: Pkg, Part: Prt } = require("../tools/helpers/builder/opc.cjs");
  const contentPkg = new Pkg();
  const cslide = new Prt(contentPkg, "/ppt/slides/slide1.xml", "application/xml");
  contentPkg.addPart(cslide); // rels пусты — chart part не сгенерирован
  const gf = parseFrag(`<p:graphicFrame ${P} ${A}><p:nvGraphicFramePr/><p:xfrm/>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
    `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>` +
    `</a:graphicData></a:graphic></p:graphicFrame>`);
  const shell = new Pkg();
  const shellSlide = new Prt(shell, "/ppt/slides/slide1.xml", "application/xml");
  shell.addPart(shellSlide);
  const el = { type: "chart", bounds: [0, 0, 10, 10], chart: { kind: "bar", series: [{ name: "s", values: [1] }] } };
  assert.throws(() => importChart(gf, el, cslide, { pkg: shell, shellSlidePart: shellSlide, k: 9525 }),
                /chart part|graphicFrame/);
});

test("regression: chart import использует сгенерированный PptxGenJS chart part (DOM identity)", async () => {
  const adapter = require("../tools/helpers/builder/pptxgen-adapter.cjs");
  const { Package: Pkg, Part: Prt, RT } = require("../tools/helpers/builder/opc.cjs");
  const elements = [{ id: "c1", type: "chart", bounds: [100, 100, 400, 300],
                      chart: { kind: "bar", series: [{ name: "S\u0001", categories: ["A\u0001B", "plain"], values: [1, 2] }] } }];
  const buf = await adapter.renderContentDeck([{ file: "p", idx: 0, spec: { elements } }],
                                              { k: 9525, projectDir: ".", slideWEmu: 12192000, slideHEmu: 6858000 });
  const cpkg = Pkg.load(buf);
  const cslide = cpkg.parts.get("/ppt/slides/slide1.xml");
  const chartPn = [...cpkg.parts.keys()].find((p) => /^\/ppt\/charts\/chart\d+\.xml$/.test(p));
  assert.ok(chartPn, "PptxGenJS не сгенерировал chart part в content deck");
  const contentChartEl = cpkg.parts.get(chartPn).xmlEl;
  findL(contentChartEl, "externalData").attrs.set(`{${NS_R}}id`, "rId2");
  const shell = new Pkg();
  const pres = new Prt(shell, "/ppt/presentation.xml", "application/xml");
  pres.xmlEl = new El(null, "presentation");
  shell.addPart(pres);
  shell.pkgRels.relateTo(RT.OFFICE_DOCUMENT, "/ppt/presentation.xml");
  const shellSlide = new Prt(shell, "/ppt/slides/slide1.xml", "application/xml");
  shellSlide.xmlEl = new El(null, "sld");
  shell.addPart(shellSlide);
  adapter.graftSlideContent(null, cslide, elements,
                          { importImageRel: () => "rIdX", k: 9525, pkg: shell, shellSlidePart: shellSlide });
  const shellChart = shell.parts.get("/ppt/charts/chart1.xml");
  assert.ok(shellChart, "chart part не импортирован в shell");
  assert.strictEqual(shellChart.xmlEl, contentChartEl,
                     "shell chart обязан быть ИМПОРТИРОВАННЫМ DOM content-деки, не новым корнем");
  const wbRel = shellChart.rels.findByReltype("package");
  assert.strictEqual(findL(shellChart.xmlEl, "externalData").attrs.get(`{${NS_R}}id`), wbRel.rId,
                     "externalData обязан ссылаться на фактически созданный workbook rel");
  const chartText = serialize(shellChart.xmlEl);
  assert.ok(chartText.includes("S_x0001_") && chartText.includes("A_x0001_B"), chartText);
  assert.ok(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(chartText.replace(/_x[0-9A-F]{4}_/g, "")),
            "сырые control chars в chart XML");
  const wb = [...shell.parts.keys()].find((p) => /^\/ppt\/embeddings\/Microsoft_Excel_Sheet\d+\.xlsx$/.test(p));
  assert.ok(wb, "workbook (XlsxWriter-compatible) не создан");
});

test("regression: workbook — XML control chars → _xHHHH_ (XlsxWriter)", () => {
  const buf = buildWorkbook(["A\x0BB", "plain"], [{ name: "s\x01name", values: [1, 2] }]);
  const parts = unzipSync(new Uint8Array(buf));
  const sst = Buffer.from(parts["xl/sharedStrings.xml"]).toString("utf8");
  assert.ok(sst.includes("A_x000B_B"), sst);
  assert.ok(sst.includes("s_x0001_name"), sst);
  assert.ok(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(sst.replace(/_x[0-9A-F]{4}_/g, "")), "сырые control chars в sharedStrings");
  const formulas = unzipSync(new Uint8Array(buildWorkbook(["=1+1\u0001"], [{ name: "{=SUM(A1:A2)\u0001}", values: [1] }])));
  const sheet = Buffer.from(formulas["xl/worksheets/sheet1.xml"]).toString("utf8");
  assert.ok(sheet.includes("_x0001_"), sheet);
  assert.ok(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(sheet.replace(/_x[0-9A-F]{4}_/g, "")),
            "сырые control chars в formula cells");
});
