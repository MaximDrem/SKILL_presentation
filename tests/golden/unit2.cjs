// unit2.cjs — golden suites: overlap, validate, proto, qa, svgshape, image.
'use strict';
const { test } = require("node:test");
const path = require("path");
const { loadUnit, assertDeepEqual, FIX } = require("../lib/oracle.cjs");
const overlap = require("../../tools/helpers/builder/overlap.cjs");
const validate = require("../../tools/helpers/builder/validate.cjs");
const proto = require("../../tools/helpers/builder/proto.cjs");
const qa = require("../../tools/helpers/builder/qa.cjs");
const svgshape = require("../../tools/helpers/builder/svgshape.cjs");
const { imageInfo } = require("../../tools/helpers/unpack/image.cjs");
const fs = require("fs");

test("golden overlap: cases", () => {
  const g = loadUnit("overlap.json");
  for (const c of g.cases) {
    const [hard, warn] = overlap.overlapCheck(c.pages, c.underlays ?? null);
    assertDeepEqual({ hard, warn }, c.expected, `overlap ${c.name}`);
  }
});

test("golden validate: cases", () => {
  const g = loadUnit("validate.json");
  const a = { projectDir: path.join(FIX, "validate-media"), theme: g.a.theme, mode: g.a.mode };
  for (const c of g.cases) {
    const failures = validate.validate(a, c.pages);
    assertDeepEqual(failures, c.expected, `validate ${c.name}`);
  }
});

test("golden proto: cases", () => {
  const g = loadUnit("proto.json");
  const archInput = [
    { elements: [{ mediaClass: "background", coverage: 0.99, src: "image5.png" }], background: { type: "none" } },
    { elements: [], background: { type: "image", media: "image7.png" } },
    { elements: [], background: { type: "solid", color: "#0A0F1F" } },
    { elements: [], background: { type: "solid", scheme: "bg1" } },
    { elements: [], background: { type: "theme", idx: 1001, scheme: "bg1" } },
    { elements: [], background: { type: "none" } },
    { elements: [{ mediaClass: "background", coverage: 0.5, src: "image9.png" }], background: { type: "solid", color: "#111111" } },
  ];
  for (const c of g.cases) {
    if (c.name === "arch_keys") {
      assertDeepEqual(archInput.map(proto.atlasArchKey), c.expected, "arch_keys");
      continue;
    }
    if (c.name === "pages_proto_info") {
      assertDeepEqual(proto.pagesProtoInfo(c.input), c.expected, "pages_proto_info");
      continue;
    }
    const [mappings, failures] = proto.resolveProtos(c.a, c.pages, c.info, c.auto);
    assertDeepEqual({ mappings: mappings.map(({ file, proto: p, how }) => ({ file, page: null, proto: p, how })), failures },
                    c.expected, `proto ${c.name}`);
  }
});

test("golden qa: cases", () => {
  const g = loadUnit("qa.json");
  const d = path.join(FIX, "qa-media");
  for (const c of g.cases) {
    const [hard, warn] = qa.qaWarnings(c.pages, c.underlays ?? null, d);
    assertDeepEqual({ hard, warn }, c.expected, `qa ${c.name}`);
  }
});

test("golden qa: funcs", () => {
  const g = loadUnit("qa.json");
  for (const [h, v] of Object.entries(g.funcs.parse)) assertDeepEqual(qa._parse(h), v, `parse ${h}`);
  for (const [h, v] of Object.entries(g.funcs.lum)) assertDeepEqual(qa._lum(qa._parse(h).slice(0, 3)), v, `lum ${h}`);
  for (const [k, v] of Object.entries(g.funcs.contrast)) {
    const [a, b] = k.split("|");
    assertDeepEqual(qa._contrast(qa._parse(a).slice(0, 3), qa._parse(b).slice(0, 3)), v, `contrast ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.composite)) {
    const [a, b] = k.split("|");
    assertDeepEqual(qa._composite(qa._parse(a), qa._parse(b).slice(0, 3)), v, `composite ${k}`);
  }
  for (const [k, v] of Object.entries(g.funcs.fix_color)) {
    const [a, b] = k.split("|");
    const got = qa._fixColor(qa._parse(a).slice(0, 3), qa._parse(b).slice(0, 3));
    assertDeepEqual(got, v, `fix_color ${k}`);
  }
});

test("golden svgshape: cases", () => {
  const g = loadUnit("svgshape.json");
  const inputs = {
    ok_simple: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2 L22 22 L2 22 Z" fill="#A0B0C0"/></svg>',
    ok_multi: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 4 100 50"><path d="M0 0 C10 10 20 10 30 0 L40 40 Z" fill="#FF0000" fill-opacity="0.5"/><path d="M50 50 L60 60 Z" fill="none"/></svg>',
    reject_rect: '<svg viewBox="0 0 10 10"><rect x="1" y="1" width="2" height="2"/></svg>',
    reject_relative: '<svg viewBox="0 0 10 10"><path d="m1 1 l2 2 z" fill="#111111"/></svg>',
    reject_no_viewbox: '<svg><path d="M1 1 L2 2 Z"/></svg>',
    reject_no_path: '<svg viewBox="0 0 10 10"></svg>',
    reject_stroke: '<svg viewBox="0 0 10 10"><path d="M1 1 L2 2 Z" fill="#111111" stroke="#000"/></svg>',
    reject_garbage_d: '<svg viewBox="0 0 10 10"><path d="M1 1 X2 2 Z" fill="#111111"/></svg>',
  };
  for (const c of g.cases) {
    try {
      const [vw, vh, paths] = svgshape.parseSvg(inputs[c.name]);
      assertDeepEqual({ ok: true, vw, vh, paths }, { ok: true, vw: c.vw, vh: c.vh, paths: c.paths }, `svg ${c.name}`);
    } catch (e) {
      const got = `${e.name === "SvgError" ? "SvgError" : e.constructor.name}: ${e.message}`;
      if (!c.ok) {
        if (got !== c.error) throw new Error(`svg ${c.name}: ${JSON.stringify(got)} !== ${JSON.stringify(c.error)}`);
      } else {
        throw new Error(`svg ${c.name}: unexpected throw ${got}`);
      }
    }
  }
  const F = g.funcs;
  assertDeepEqual(svgshape._dToOoxml("M0 0 L10 10 Z", 9525.0, 9525.0), F.d_to_ooxml.simple, "d_to_ooxml simple");
  assertDeepEqual(svgshape._dToOoxml("M1 2 C3 4 5 6 7 8", 100.0, 50.0), F.d_to_ooxml.cubic, "d_to_ooxml cubic");
  assertDeepEqual(svgshape._dToOoxml("M0.4 0.6 L1.5 2.5", 9525.0, 9525.0), F.d_to_ooxml.frac, "d_to_ooxml frac");
  assertDeepEqual(svgshape._spXml(7, "M0 0 L10 10 Z", "#A0B0C0", 0.5, 571500, 1143000, 2286000, 457200,
                                  2286000 / 24, 457200 / 24, ' rot="900000"', ' flipH="1"'), F.sp_xml, "sp_xml");
  assertDeepEqual(svgshape._spXml(8, "M0 0 L10 10 Z", null, 1.0, 0, 0, 100, 100, 10, 10, "", ""), F.sp_xml_nofill, "sp_xml_nofill");
});

test("golden image_info: buffers", () => {
  const g = loadUnit("image_info.json");
  const bdir = path.join(FIX, "buffers");
  for (const c of g.cases) {
    const buf = fs.readFileSync(path.join(bdir, c.file));
    assertDeepEqual(imageInfo(buf, c.ext), c.expected, `image_info ${c.file}`);
  }
});
