// chart-normalize.cjs — schema-driven normalizer ИМПОРТИРОВАННОГО PptxGenJS chart
// DOM к python-pptx contract (chart/xmlwriter.py) + мутации builder'а
// (legend/title/colors/axes/varyColors). Новый корень не создаётся: работаем
// по существующему дереву сгенерированного chart part.
'use strict';
const { El, parseXml, docRoot } = require("../xml.cjs");
const { removeL, sub, mk, findL, NS_A, NS_C } = require("./xmlbuild.cjs");
const { numToken, isNumeric } = require("../jsonpy.cjs");

function xmlEscape(s) {
  const text = [...String(s)].map((ch) => {
    const c = ch.codePointAt(0);
    if (c < 0x20 && ch !== "\t" && ch !== "\n" && ch !== "\r") {
      return `_x${c.toString(16).toUpperCase().padStart(4, "0")}_`;
    }
    return ch;
  }).join("");
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// str(value) в Python для chart c:v (int → "2", float → "2.0"/"1.5", PyInt → точный token)
function chartNumStr(v) {
  return numToken(v);
}

const C_DECL = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"';
const A_DECL = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

const frag = (xml) => docRoot(parseXml(xml));

// chartSpace-level c:txPr из python-pptx chart template (defRPr sz=1800)
const TX_PR = (withLang) =>
  `<c:txPr ${C_DECL} ${A_DECL}><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1800"/></a:pPr><a:endParaRPr${withLang ? ' lang="en-US"' : ""}/></a:p></c:txPr>`;

// фиксированные axId из python-pptx chart template
const AX_IDS = { bar: ["-2068027336", "-2113994440"], line: ["2118791784", "2140495176"] };

function txXml(nameRef, name) {
  return `<c:tx ${C_DECL}><c:strRef><c:f>${nameRef}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${xmlEscape(name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`;
}

function catXml(catRef, categories) {
  // python-pptx are_numeric: по ПЕРВОЙ категории (int/float, не строка)
  const numeric = categories.length > 0 && isNumeric(categories[0]) && typeof categories[0] !== "boolean";
  if (numeric) {
    const pts = categories.map((c, i) => `<c:pt idx="${i}"><c:v>${xmlEscape(numToken(c))}</c:v></c:pt>`).join("");
    return `<c:cat ${C_DECL}><c:numRef><c:f>${catRef}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${categories.length}"/>${pts}</c:numCache></c:numRef></c:cat>`;
  }
  const pts = categories.map((c, i) => `<c:pt idx="${i}"><c:v>${xmlEscape(String(c))}</c:v></c:pt>`).join("");
  return `<c:cat ${C_DECL}><c:strRef><c:f>${catRef}</c:f><c:strCache><c:ptCount val="${categories.length}"/>${pts}</c:strCache></c:strRef></c:cat>`;
}

function valXml(valRef, values) {
  let xml = `<c:ptCount val="${values.length}"/>`;
  values.forEach((v, i) => {
    if (v === null || v === undefined) return;
    xml += `<c:pt idx="${i}"><c:v>${chartNumStr(v)}</c:v></c:pt>`;
  });
  return `<c:val ${C_DECL}><c:numRef><c:f>${valRef}</c:f><c:numCache><c:formatCode>General</c:formatCode>${xml}</c:numCache></c:numRef></c:val>`;
}

// Excel base-26: series i → колонка B..Z, AA… (depth=1)
function colLetter(i) {
  let s2 = "";
  let n = i + 2; // B = 2-я колонка
  while (n > 0) {
    const r = (n - 1) % 26;
    s2 = String.fromCharCode(65 + r) + s2;
    n = Math.floor((n - 1) / 26);
  }
  return s2;
}

// --- нормализация импортированного DOM (in-place мутации узлов) ---

// ser: idx/order/tx(+marker)/cat/val(+smooth) из source model — кэши и formulas
// по python-pptx contract; сам элемент ser — импортированный
function normalizeSer(serEl, kind, s, i, categories) {
  const catRef = `Sheet1!$A$2:$A$${categories.length + 1}`;
  const nameRef = `Sheet1!$${colLetter(i)}$1`;
  const valRef = `Sheet1!$${colLetter(i)}$2:$${colLetter(i)}$${s.values.length + 1}`;
  serEl.children = [];
  sub(serEl, NS_C, "idx", { val: i });
  sub(serEl, NS_C, "order", { val: i });
  serEl.children.push(frag(txXml(nameRef, s.name)));
  if (kind === "line") serEl.children.push(frag(`<c:marker ${C_DECL}><c:symbol val="none"/></c:marker>`));
  serEl.children.push(frag(catXml(catRef, categories)));
  serEl.children.push(frag(valXml(valRef, s.values)));
  if (kind === "line") sub(serEl, NS_C, "smooth", { val: "0" });
}

// axis: привести импортированный catAx/valAx к python contract
// (scaling orientation=minMax, без numFmt/spPr/txPr/crossBetween, фикс. axId)
function normalizeAxis(ax, id, pos, isCat, crossId) {
  ax.children = [];
  sub(ax, NS_C, "axId", { val: id });
  const sc = sub(ax, NS_C, "scaling");
  sub(sc, NS_C, "orientation", { val: "minMax" });
  sub(ax, NS_C, "delete", { val: "0" });
  sub(ax, NS_C, "axPos", { val: pos });
  if (!isCat) sub(ax, NS_C, "majorGridlines");
  sub(ax, NS_C, "majorTickMark", { val: "out" });
  sub(ax, NS_C, "minorTickMark", { val: "none" });
  sub(ax, NS_C, "tickLblPos", { val: "nextTo" });
  sub(ax, NS_C, "crossAx", { val: crossId });
  sub(ax, NS_C, "crosses", { val: "autoZero" });
  if (isCat) {
    sub(ax, NS_C, "auto", { val: "1" });
    sub(ax, NS_C, "lblAlgn", { val: "ctr" });
    sub(ax, NS_C, "lblOffset", { val: "100" });
    sub(ax, NS_C, "noMultiLvlLbl", { val: "0" });
  }
}

// doughnut dLbls по contract: show* 0 + showLeaderLines 1
function doughnutDLbls() {
  return frag(`<c:dLbls ${C_DECL}><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/>` +
    `<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>`);
}

// Главная схема: imported chartSpace → python-pptx contract для kind.
// series: [{name, values}], categories: [str|number]
function normalizeImportedChartDom(root, kind, series, categories) {
  const chart = findL(root, "chart");
  if (!chart) throw new Error("imported chart: c:chart отсутствует");
  const plotArea = findL(chart, "plotArea");
  if (!plotArea) throw new Error("imported chart: c:plotArea отсутствует");
  const plotTag = { bar: "barChart", line: "lineChart", pie: "pieChart", doughnut: "doughnutChart" }[kind];
  const plot = findL(plotArea, plotTag);
  if (!plot) throw new Error(`imported chart: ${plotTag} отсутствует — не тот chart kind`);
  const effSeries = kind === "pie" ? series.slice(0, 1) : series;
  const sers = plot.children.filter((c) => c instanceof El && c.local === "ser");
  if (sers.length !== effSeries.length) {
    throw new Error(`imported chart: серий ${sers.length} ≠ ожидаемых ${effSeries.length}`);
  }

  // --- plot (chartType) ---
  const hasAxes = kind === "bar" || kind === "line";
  const [id1, id2] = hasAxes ? AX_IDS[kind] : [null, null];
  if (kind === "bar") {
    const bd = findL(plot, "barDir") || frag(`<c:barDir ${C_DECL} val="col"/>`);
    bd.attrs.set("val", "col");
    const gr = findL(plot, "grouping") || frag(`<c:grouping ${C_DECL} val="clustered"/>`);
    gr.attrs.set("val", "clustered");
    plot.children = [bd, gr];
  } else if (kind === "line") {
    const gr = findL(plot, "grouping") || frag(`<c:grouping ${C_DECL} val="standard"/>`);
    gr.attrs.set("val", "standard");
    const vc = findL(plot, "varyColors") || sub(plot, NS_C, "varyColors");
    vc.attrs.set("val", "0");
    plot.children = [gr, vc];
  } else {
    // pie/doughnut: varyColors val=1 первым
    const vc = findL(plot, "varyColors") || new El(NS_C, "varyColors");
    vc.attrs.set("val", "1");
    plot.children = [vc];
  }
  sers.forEach((ser, i) => {
    normalizeSer(ser, kind, effSeries[i], i, categories);
    plot.children.push(ser);
  });
  if (kind === "line") {
    const mk1 = findL(plot, "marker") || mk(NS_C, "marker");
    mk1.children = [];
    mk1.attrs.set("val", "1");
    plot.children.push(mk1);
    const sm = findL(plot, "smooth") || mk(NS_C, "smooth");
    sm.attrs.set("val", "0");
    plot.children.push(sm);
  }
  if (kind === "doughnut") {
    plot.children.push(doughnutDLbls());
    const fsa = findL(plot, "firstSliceAng") || mk(NS_C, "firstSliceAng");
    fsa.attrs.set("val", "0");
    plot.children.push(fsa);
    const hs = findL(plot, "holeSize") || mk(NS_C, "holeSize");
    hs.attrs.set("val", "50");
    plot.children.push(hs);
  }
  if (hasAxes) {
    plot.children.push(mkEl("axId", id1), mkEl("axId", id2));
  }

  // --- plotArea: (layout только doughnut), plot, axes; spPr убрать ---
  plotArea.children = plotArea.children.filter((c) => !(c instanceof El) || c.local !== "spPr");
  const layout = findL(plotArea, "layout");
  const ordered = [];
  if (kind === "doughnut") ordered.push(layout || sub(plotArea, NS_C, "layout"));
  ordered.push(plot);
  if (hasAxes) {
    const catAx = findL(plotArea, "catAx") || new El(NS_C, "catAx");
    normalizeAxis(catAx, id1, "b", true, id2);
    const valAx = findL(plotArea, "valAx") || new El(NS_C, "valAx");
    normalizeAxis(valAx, id2, "l", false, id1);
    ordered.push(catAx, valAx);
  }
  plotArea.children = ordered;

  // --- chart: autoTitleDeleted 0, plotArea, legend?, plotVisOnly?, dispBlanksAs gap, showDLblsOverMax? ---
  removeL(chart, "title");
  const atd = findL(chart, "autoTitleDeleted") || mk(NS_C, "autoTitleDeleted");
  atd.attrs.set("val", "0");
  const disp = findL(chart, "dispBlanksAs") || mk(NS_C, "dispBlanksAs");
  disp.attrs.set("val", "gap");
  chart.children = [atd, plotArea];
  if (kind === "line") {
    // python line template: legend (pos r, layout, overlay 0) до setLegend-мутации
    let lg = findL(chart, "legend");
    if (!lg) {
      lg = frag(`<c:legend ${C_DECL}><c:legendPos val="r"/><c:layout/><c:overlay val="0"/></c:legend>`);
    }
    chart.children.push(lg);
  }
  if (kind === "line" || kind === "doughnut") {
    const pv = findL(chart, "plotVisOnly") || mk(NS_C, "plotVisOnly");
    pv.attrs.set("val", "1");
    chart.children.push(pv);
  }
  chart.children.push(disp);
  if (kind === "line" || kind === "doughnut") {
    const sd = findL(chart, "showDLblsOverMax") || mk(NS_C, "showDLblsOverMax");
    sd.attrs.set("val", "0");
    chart.children.push(sd);
  }

  // --- chartSpace: date1904 (кроме pie), roundedCorners (только doughnut, val 0),
  // chart, txPr (TX_PR), externalData; spPr/прочее убрать ---
  const extData = findL(root, "externalData");
  if (!extData) throw new Error("imported chart: c:externalData отсутствует");
  const autoUpd = findL(extData, "autoUpdate") || sub(extData, NS_C, "autoUpdate");
  autoUpd.attrs.set("val", "0");
  const head = [];
  if (kind !== "pie") {
    const d = findL(root, "date1904") || mk(NS_C, "date1904");
    d.attrs.set("val", "0");
    head.push(d);
  }
  if (kind === "doughnut") {
    const rc = findL(root, "roundedCorners") || mk(NS_C, "roundedCorners");
    rc.attrs.set("val", "0");
    head.push(rc);
  }
  root.children = [...head, chart, frag(TX_PR(kind !== "doughnut")), extData];
  return root;
}

function mkEl(local, val) {
  return mk(NS_C, local, { val });
}

// --- мутации на DOM (семантика python-pptx Chart API) ---

function setChartFontColor(root, hex) {
  const txPr = findL(root, "txPr");
  const p = txPr.children.find((c) => c instanceof El && c.local === "p");
  const pPr = findL(p, "pPr");
  const defRPr = findL(pPr, "defRPr");
  removeL(defRPr, "solidFill");
  const sf = new El("http://schemas.openxmlformats.org/drawingml/2006/main", "solidFill");
  const c = new El("http://schemas.openxmlformats.org/drawingml/2006/main", "srgbClr");
  c.attrs.set("val", hex);
  sf.children.push(c);
  defRPr.children.push(sf);
}

function setLegend(root, enabled) {
  const chartEl = findL(root, "chart");
  const legend = findL(chartEl, "legend");
  if (!enabled) {
    if (legend) chartEl.children = chartEl.children.filter((c) => c !== legend);
    return;
  }
  let lg = legend;
  if (!lg) {
    // python-pptx chart.has_legend=True: CT_Legend new — без layout (layout добавляет
    // только template line chart); insert перед plotVisOnly/dispBlanksAs (schema order)
    lg = docRoot(parseXml('<c:legend xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:legendPos val="r"/><c:overlay val="0"/></c:legend>'));
    const plotVis = findL(chartEl, "plotVisOnly") || findL(chartEl, "dispBlanksAs");
    if (plotVis) chartEl.children.splice(chartEl.children.indexOf(plotVis), 0, lg);
    else chartEl.children.push(lg);
  }
  const pos = findL(lg, "legendPos");
  pos.attrs.set("val", "b"); // XL_LEGEND_POSITION.BOTTOM
  const overlay = findL(lg, "overlay");
  overlay.attrs.set("val", "0"); // include_in_layout=False
}

function setTitle(root, title) {
  const chartEl = findL(root, "chart");
  const titleXml = '<c:title xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:layout/><c:overlay val="0"/></c:title>';
  const titleEl = docRoot(parseXml(titleXml));
  // text_frame.text = title: multiline → параграфы (python-pptx \n → отдельные a:p)
  const tx = new El("http://schemas.openxmlformats.org/drawingml/2006/chart", "tx");
  const rich = sub(tx, NS_C, "rich");
  sub(rich, NS_A, "bodyPr");
  sub(rich, NS_A, "lstStyle");
  // \n → paragraphs; \v → a:br (python-pptx text_frame семантика)
  for (const line of String(title).split("\n")) {
    const p = sub(rich, NS_A, "p");
    const segs = line.split("\v");
    segs.forEach((seg, si) => {
      if (si > 0) sub(p, NS_A, "br");
      const r = sub(p, NS_A, "r");
      sub(r, NS_A, "t", null, escapeCtrl(seg));
    });
  }
  titleEl.children.splice(0, 0, tx);
  // insert в начало c:chart (первый по _tag_seq)
  chartEl.children.splice(0, 0, titleEl);
}

function escapeCtrl(text) {
  // python-pptx: control chars (кроме \t\n) → _xHHHH_
  return [...String(text)].map((ch) => {
    const c = ch.codePointAt(0);
    if (c < 0x20 && ch !== "\t") return `_x${c.toString(16).toUpperCase().padStart(4, "0")}_`;
    return ch;
  }).join("");
}

function setSeriesColors(root, kind, colors) {
  const hexes = colors.map((x) => String(x).replace(/^#/, "").slice(0, 6).toUpperCase());
  const plotArea = findL(findL(root, "chart"), "plotArea");
  const chartNode = findL(plotArea, kind === "bar" ? "barChart" : kind === "line" ? "lineChart" : kind === "pie" ? "pieChart" : "doughnutChart");
  const sers = chartNode.children.filter((c) => c instanceof El && c.local === "ser");
  sers.forEach((ser, i) => {
    const col = hexes[i % hexes.length];
    // ser.format.fill.solid() + fore_color → c:spPr с solidFill; insert после tx (перед cat/marker/dPt)
    let spPr = findL(ser, "spPr");
    if (!spPr) {
      spPr = new El("http://schemas.openxmlformats.org/drawingml/2006/chart", "spPr");
      const tx = findL(ser, "tx");
      ser.children.splice(ser.children.indexOf(tx) + 1, 0, spPr);
    }
    removeL(spPr, "solidFill");
    removeL(spPr, "noFill");
    const sf = sub(spPr, NS_A, "solidFill");
    sub(sf, NS_A, "srgbClr", { val: col });
    if (kind === "pie" || kind === "doughnut") {
      // точки: dPt по индексу с цветом
      const values = seriesValuesCount(root, ser);
      for (let j = 0; j < values; j++) {
        const dPt = new El("http://schemas.openxmlformats.org/drawingml/2006/chart", "dPt");
        sub(dPt, NS_C, "idx", { val: j });
        const dsp = sub(dPt, NS_C, "spPr");
        const dsf = sub(dsp, NS_A, "solidFill");
        sub(dsf, NS_A, "srgbClr", { val: hexes[j % hexes.length] });
        // insert перед c:cat (после spPr и существующих dPt)
        const cat = findL(ser, "cat");
        ser.children.splice(ser.children.indexOf(cat), 0, dPt);
      }
    }
  });
}

function seriesValuesCount(root, ser) {
  const val = findL(ser, "val");
  const cache = findL(findL(val, "numRef"), "numCache");
  const ptCount = findL(cache, "ptCount");
  return parseInt(ptCount.attrs.get("val"), 10);
}

module.exports = { normalizeImportedChartDom, setChartFontColor, setLegend, setTitle, setSeriesColors, chartNumStr };
