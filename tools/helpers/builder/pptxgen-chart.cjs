// pptxgen-chart.cjs — chart model через slide.addChart (PptxGenJS создаёт chart
// part/workbook/rels в content-деке), при OPC merge chart XML нормализуется к
// python-pptx контракту (chart-normalize), workbook заменяется на xlsxwrite.cjs
// (XlsxWriter-compatible), naming/relations — Python contract.
'use strict';
const { El, docRoot, parseXml } = require("../xml.cjs");
const { NS_A, NS_P, NS_R, NS_C, mk, sub, findL, removeL, parseFrag } = require("./xmlbuild.cjs");
const { asNum } = require("../jsonpy.cjs");
const { Part, CT, RT } = require("./opc.cjs");
const { normalizeImportedChartDom, setChartFontColor, setLegend, setTitle, setSeriesColors } = require("./chart-normalize.cjs");
const { buildWorkbook } = require("./xlsxwrite.cjs");

const PGX_TYPE = { bar: "bar", line: "line", pie: "pie", doughnut: "doughnut" };

// page model → PptxGenJS addChart (структурный plumbing: parts, rels, graphicFrame)
function addChartEl(slide, el, k) {
  const [x, y, w, h] = el.bounds.map((v) => asNum(v) * k / 914400);
  const c = el.chart;
  const s0 = c.series[0];
  const categories = (s0.categories || [...Array(s0.values.length).keys()].map((i) => String(i + 1)));
  const data = c.series.map((s, i) => ({
    name: s.name || `Ряд ${i + 1}`,
    labels: categories,
    values: s.values,
  }));
  slide.addChart(PGX_TYPE[c.kind], data, {
    x, y, w, h,
    barDir: "col",
    chartColors: (c.colors || []).map((hex) => String(hex).replace(/^#/, "").slice(0, 6).toUpperCase()),
  });
}

// workbook naming: первый свободный /ppt/embeddings/Microsoft_Excel_Sheet%d.xlsx
// среди ВСЕХ parts (включая ещё unreachable добавленные)
function nextWorkbookPartname(pkg) {
  const used = new Set([...pkg.parts.keys(), ...pkg.reachablePartnames()]);
  let i = 1;
  while (used.has(`/ppt/embeddings/Microsoft_Excel_Sheet${i}.xlsx`)) i++;
  return `/ppt/embeddings/Microsoft_Excel_Sheet${i}.xlsx`;
}

// OPC merge: ФАКТИЧЕСКИЙ chart part, сгенерированный PptxGenJS в content-деке,
// импортируется в shell pkg (first-free partname), DOM нормализуется к
// python-pptx contract; workbook заменяется на xlsxwrite (XlsxWriter-compatible).
// gf — graphicFrame в content slide; el — source element; ctx: {pkg, shellSlidePart, k, textRgb}
function importChart(gf, el, contentSlidePart, ctx) {
  const { pkg, shellSlidePart, k, textRgb } = ctx;
  const c = el.chart;
  const s0 = c.series[0];
  const categories = (s0.categories || [...Array(s0.values.length).keys()].map((i) => String(i + 1)));
  const series = c.series.map((s, i) => ({ name: s.name || `Ряд ${i + 1}`, values: s.values }));

  // c:chart/@r:id сгенерированного graphicFrame → фактический chart part content-деки
  const gdSrc = findL(findL(gf, "graphic"), "graphicData");
  const srcRef = gdSrc ? findL(gdSrc, "chart") : null;
  const rid = srcRef ? srcRef.attrs.get(`{${NS_R}}id`) : null;
  const rel = rid ? contentSlidePart.rels.get(rid) : null;
  if (!rel) {
    throw new Error("importChart: сгенерированный PptxGenJS graphicFrame не ссылается на chart part (c:chart/@r:id)");
  }
  const srcPart = contentSlidePart.pkg.parts.get(rel.target);
  if (!srcPart || !srcPart.xmlEl) {
    throw new Error(`importChart: chart part ${rel.target} отсутствует в content deck — legacy writer запрещён`);
  }
  // импортированный DOM — нормализация существующего дерева (новый корень НЕ создаётся)
  const root = srcPart.xmlEl;
  normalizeImportedChartDom(root, c.kind, series, categories);
  if (textRgb) {
    const hex = [textRgb[0], textRgb[1], textRgb[2]].map((v) => Math.max(0, Math.min(255, v)).toString(16).toUpperCase().padStart(2, "0")).join("");
    setChartFontColor(root, hex);
  }
  setLegend(root, !!c.legend);
  if (c.title) setTitle(root, c.title);
  if (Array.isArray(c.colors) && c.colors.length) setSeriesColors(root, c.kind, c.colors); // [] — Python falsey

  // parts в shell pkg (first free); docBindings импортированного part сохраняем
  const chartPartname = pkg.nextPartname("/ppt/charts/chart%d.xml");
  const chartPart = pkg.addPart(new Part(pkg, chartPartname, CT.DML_CHART));
  chartPart.xmlEl = root;
  chartPart.docBindings = srcPart.docBindings || null;
  const xlsxPart = pkg.addPart(new Part(pkg, nextWorkbookPartname(pkg), CT.SML_SHEET));
  xlsxPart.blob = buildWorkbook(categories, series);
  // chart→workbook rel
  const workbookRId = chartPart.rels.relateTo(RT.PACKAGE, xlsxPart.partname);
  const extData = findL(root, "externalData");
  if (!extData) throw new Error("importChart: c:externalData отсутствует после нормализации");
  extData.attrs.set(`{${NS_R}}id`, workbookRId);
  // slide→chart rel
  const slideRId = shellSlidePart.rels.relateTo(RT.CHART, chartPartname);

  // graphicFrame нормализация: nvPr без extLst, graphicFrameLocks, точный xfrm, c:chart r:id
  const nv = findL(gf, "nvGraphicFramePr");
  const nvPr = nv ? findL(nv, "nvPr") : null;
  if (nvPr) removeL(nvPr, "extLst");
  let cNvGf = nv ? findL(nv, "cNvGraphicFramePr") : null;
  if (!cNvGf) {
    cNvGf = mk(NS_P, "cNvGraphicFramePr");
    nv.children.push(cNvGf);
  }
  if (!findL(cNvGf, "graphicFrameLocks")) {
    cNvGf.children.push(mk(NS_A, "graphicFrameLocks", { noGrp: "1" }));
  }
  const xfrm = findL(gf, "xfrm");
  const { px } = require("./elhelpers.cjs");
  const b = el.bounds;
  let off = findL(xfrm, "off");
  let ext = findL(xfrm, "ext");
  if (!off) { off = mk(NS_A, "off"); xfrm.children.unshift(off); }
  if (!ext) { ext = mk(NS_A, "ext"); xfrm.children.push(ext); }
  off.attrs.set("x", String(px(b[0], k)));
  off.attrs.set("y", String(px(b[1], k)));
  ext.attrs.set("cx", String(px(b[2], k)));
  ext.attrs.set("cy", String(px(b[3], k)));
  const graphic = findL(gf, "graphic");
  const gd = findL(graphic, "graphicData");
  gd.attrs.set("uri", "http://schemas.openxmlformats.org/drawingml/2006/chart");
  gd.children = [];
  const chartRef = mk(NS_C, "chart");
  chartRef.attrs.set(`{${NS_R}}id`, slideRId);
  gd.children.push(chartRef);
  return gf;
}

module.exports = { addChartEl, importChart };
