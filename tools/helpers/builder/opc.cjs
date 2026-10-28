// opc.cjs — OPC package model с семантикой python-pptx (загрузка, rels,
// content-types, save). Все операции бит-совместимы с canon-контрактом v3.2.1.
'use strict';
const { zipSync, unzipSync, strToU8 } = require("../../../vendor/fflate/lib/node.cjs");
const { El, parseXml, docRoot, serialize } = require("../xml.cjs");

const CT = {
  OPC_RELATIONSHIPS: "application/vnd.openxmlformats-package.relationships+xml",
  XML: "application/xml",
  PML_PRESENTATION_MAIN: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  PML_SLIDE: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  PML_SLIDE_LAYOUT: "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  PML_SLIDE_MASTER: "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
  PML_PRES_PROPS: "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml",
  PML_VIEW_PROPS: "application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml",
  PML_THEME: "application/vnd.openxmlformats-officedocument.theme+xml",
  PML_TABLE_STYLES: "application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml",
  DML_CHART: "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
  SML_SHEET: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  CORE_PROPS: "application/vnd.openxmlformats-package.core-properties+xml",
  EXTENDED_PROPS: "application/vnd.openxmlformats-officedocument.extended-properties+xml",
};

const RT = {
  SLIDE: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
  SLIDE_LAYOUT: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
  SLIDE_MASTER: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster",
  THEME: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
  IMAGE: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
  CHART: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart",
  PACKAGE: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/package",
  HYPERLINK: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
  CORE_PROPS: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
  EXTENDED_PROPS: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
  OFFICE_DOCUMENT: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  THUMBNAIL: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail",
};

// pptx.opc.spec.default_content_types (ext.lower(), ct)
const DEFAULT_CONTENT_TYPES = new Set([
  ["bin", "application/vnd.openxmlformats-officedocument.presentationml.printerSettings"],
  ["bin", "application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"],
  ["bin", "application/vnd.openxmlformats-officedocument.wordprocessingml.printerSettings"],
  ["bmp", "image/bmp"], ["emf", "image/x-emf"], ["fntdata", "application/x-fontdata"],
  ["gif", "image/gif"], ["jpe", "image/jpeg"], ["jpeg", "image/jpeg"], ["jpg", "image/jpeg"],
  ["mov", "video/quicktime"], ["mp4", "video/mp4"], ["mpg", "video/mpeg"], ["png", "image/png"],
  ["rels", "application/vnd.openxmlformats-package.relationships+xml"],
  ["tif", "image/tiff"], ["tiff", "image/tiff"], ["vid", "video/unknown"],
  ["wdp", "image/vnd.ms-photo"], ["wmf", "image/x-wmf"], ["wmv", "video/x-ms-wmv"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["xml", "application/xml"],
].map(([a, b]) => `${a}|${b}`));

const IMAGE_CONTENT_TYPES = { bmp: "image/bmp", emf: "image/x-emf", gif: "image/gif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", tiff: "image/tiff", wmf: "image/x-wmf" };

function relsUriFor(partname) {
  const dir = partname.slice(0, partname.lastIndexOf("/"));
  const base = partname.slice(partname.lastIndexOf("/") + 1);
  return `${dir}/_rels/${base}.rels`;
}
function partUriForRels(relsUri) {
  const m = relsUri.match(/^(.*)\/_rels\/(.*)\.rels$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

class Rel {
  constructor(rId, reltype, target, isExternal = false) {
    this.rId = rId;
    this.reltype = reltype;
    this.target = target;       // partname (string, "/ppt/...") или URL если external
    this.isExternal = isExternal;
  }
  get targetRef() { return this.target; }
}

class RelSet {
  constructor(baseUri) {
    this.baseUri = baseUri;
    this.rels = new Map(); // rId → Rel (insertion order)
  }
  get size() { return this.rels.size; }
  has(rId) { return this.rels.has(rId); }
  get(rId) { return this.rels.get(rId); }
  values() { return this.rels.values(); }
  // python-pptx _next_rId: первая свободная позиция от len+1 вниз
  nextRId() {
    for (let n = this.rels.size + 1; n > 0; n--) {
      const cand = "rId" + n;
      if (!this.rels.has(cand)) return cand;
    }
    throw new Error("no rId available");
  }
  relateTo(reltype, target, isExternal = false) {
    // get_or_add: переиспользовать совпадающую rel
    for (const rel of this.rels.values()) {
      if (rel.reltype === reltype && rel.isExternal === isExternal && rel.target === target) return rel.rId;
    }
    const rId = this.nextRId();
    this.rels.set(rId, new Rel(rId, reltype, target, isExternal));
    return rId;
  }
  dropRel(rId) { this.rels.delete(rId); }
  findByReltype(substr) {
    for (const rel of this.rels.values()) if (rel.reltype.includes(substr)) return rel;
    return null;
  }
}

class Part {
  constructor(pkg, partname, contentType) {
    this.pkg = pkg;
    this.partname = partname;         // "/ppt/slides/slide1.xml"
    this.contentType = contentType;   // для новых; при load — из content types
    this.blob = null;                 // Buffer (binary)
    this.xmlEl = null;                // El root (xml parts)
    this.rels = new RelSet(this.baseUri);
  }
  get baseUri() {
    return this.partname.slice(0, this.partname.lastIndexOf("/")) || "/";
  }
  get isXml() {
    return this.xmlEl !== null || (this.blob === null);
  }
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const NS_CONTENT_TYPES = "http://schemas.openxmlformats.org/package/2006/content-types";
const NS_RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships";

function serializePartXml(el, opts = {}) {
  return XML_DECL + serialize(el, opts);
}

class Package {
  constructor() {
    this.parts = new Map();      // partname → Part
    this.pkgRels = new RelSet("/");
    this.defaults = new Map();   // ext → content-type (loaded)
    this.overrides = new Map();  // partname → content-type (loaded)
  }

  static load(data) {
    const pkg = new Package();
    const files = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data));
    const names = Object.keys(files);
    // content types
    const ctXml = parseXml(files["[Content_Types].xml"]);
    const typesRoot = docRoot(ctXml);
    for (const child of typesRoot.children) {
      if (!(child instanceof El)) continue;
      const a = Object.fromEntries(child.attrs);
      if (child.local === "Default") pkg.defaults.set(a.Extension, a.ContentType);
      else if (child.local === "Override") pkg.overrides.set(a.PartName, a.ContentType);
    }
    // parts
    for (const name of names) {
      if (name.endsWith("/") || name === "[Content_Types].xml") continue;
      const partname = "/" + name;
      if (name.endsWith(".rels")) continue; // rels обработаем вторым проходом
      const raw = Buffer.from(files[name]);
      const isXml = /\.(xml|rels)$/i.test(name) || (pkg.overrides.get(partname) || "").includes("xml");
      const part = new Part(pkg, partname, pkg.overrides.get(partname) || pkg.defaults.get(extOf(partname)) || null);
      if (isXml) {
        const parsed = parseXml(raw);
        part.xmlEl = docRoot(parsed);
        part.docBindings = parsed.docBindings || null; // исходные prefix→uri корня
      }
      else part.blob = raw;
      pkg.parts.set(partname, part);
    }
    // rels
    for (const name of names) {
      if (!name.endsWith(".rels")) continue;
      const relsPath = "/" + name;
      const targetPart = partUriForRels(relsPath);
      const root = docRoot(parseXml(files[name]));
      const set = targetPart === null || targetPart === "" ? pkg.pkgRels : pkg.parts.get(targetPart)?.rels;
      const owner = targetPart === null ? pkg.pkgRels : (set || null);
      const dest = targetPart === "/" || targetPart === "" ? pkg.pkgRels : owner;
      const relSet = relsPath === "/_rels/.rels" ? pkg.pkgRels : dest;
      if (!relSet) continue;
      for (const child of root.children) {
        if (!(child instanceof El) || child.local !== "Relationship") continue;
        const a = Object.fromEntries(child.attrs);
        let target = a.Target;
        if (a.TargetMode !== "External") {
          // rel → абсолютный partname
          target = target.startsWith("/") ? target : posixNormalize(joinRel(relsBaseOf(relsPath), target));
        }
        relSet.rels.set(a.Id, new Rel(a.Id, a.Type, target, a.TargetMode === "External"));
      }
    }
    return pkg;
  }

  contentTypeOf(partname) {
    return this.overrides.get(partname) || this.defaults.get(extOf(partname)) || null;
  }

  addPart(part) {
    const existing = this.parts.get(part.partname);
    if (existing && existing !== part && this.reachablePartnames().includes(part.partname)) {
      throw new Error(`addPart: отказ перезаписывать reachable part ${part.partname}`);
    }
    this.parts.set(part.partname, part);
    if (part.contentType && part.contentType.includes("xml")) {
      // xml parts хранят DOM
    }
    return part;
  }

  nextSlidePartname() {
    // первый свободный полный partname /ppt/slides/slideN.xml (gaps допустимы)
    const used = new Set([...this.parts.keys(), ...this.reachablePartnames()]);
    for (let n = 1; ; n++) {
      const pn = `/ppt/slides/slide${n}.xml`;
      if (!used.has(pn)) return pn;
    }
  }

  nextPartname(template) {
    // "/ppt/charts/chart%d.xml": первый свободный полный partname среди всех
    // parts (включая только что добавленные, ещё не reachable)
    const re = new RegExp("^" + template.split("%d").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(\\d+)") + "$");
    const used = new Set([...this.parts.keys(), ...this.reachablePartnames()]);
    const idxs = [...used].map((pn) => pn.match(re)).filter(Boolean).map((m) => parseInt(m[1], 10));
    for (let n = 1; ; n++) {
      const pn = template.replace("%d", String(n));
      if (!idxs.includes(n) && !used.has(pn)) return pn;
    }
  }

  nextImagePartname(ext) {
    // первый свободный ПОЛНЫЙ partname (mixed extensions: image1.png не занимает
    // image1.jpeg); учитываются все parts, включая ещё unreachable добавленные
    const used = new Set([...this.parts.keys(), ...this.reachablePartnames()]);
    for (let n = 1; ; n++) {
      const pn = `/ppt/media/image${n}.${ext}`;
      if (!used.has(pn)) return pn;
    }
  }

  // DFS по графу rels от корня (python-pptx iter_parts)
  reachableParts() {
    const out = [];
    const seen = new Set();
    const walk = (relSet) => {
      for (const rel of relSet.values()) {
        if (rel.isExternal) continue;
        if (seen.has(rel.target)) continue;
        const part = this.parts.get(rel.target);
        if (!part) continue;
        seen.add(rel.target);
        out.push(part);
        walk(part.rels);
      }
    };
    walk(this.pkgRels);
    return out;
  }

  reachablePartnames() {
    return this.reachableParts().map((p) => p.partname);
  }

  save() {
    const parts = this.reachableParts();
    // [Content_Types].xml
    const defaults = new Map();
    defaults.set("rels", CT.OPC_RELATIONSHIPS);
    defaults.set("xml", CT.XML);
    const overrides = new Map();
    for (const part of parts) {
      const ext = extOf(part.partname);
      const ct = part.contentType || this.contentTypeOf(part.partname);
      if (!ct) throw new Error(`no content type for ${part.partname}`);
      if (DEFAULT_CONTENT_TYPES.has(`${ext.toLowerCase()}|${ct}`)) {
        if (!defaults.has(ext)) defaults.set(ext, ct);
      } else {
        overrides.set(part.partname, ct);
      }
    }
    const typesRoot = new El("http://schemas.openxmlformats.org/package/2006/content-types", "Types");
    for (const [ext, ct] of [...defaults.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)) {
      const d = new El("http://schemas.openxmlformats.org/package/2006/content-types", "Default");
      d.attrs.set("Extension", ext);
      d.attrs.set("ContentType", ct);
      typesRoot.children.push(d);
    }
    for (const [pn, ct] of [...overrides.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)) {
      const o = new El("http://schemas.openxmlformats.org/package/2006/content-types", "Override");
      o.attrs.set("PartName", pn);
      o.attrs.set("ContentType", ct);
      typesRoot.children.push(o);
    }

    const files = {};
    files["[Content_Types].xml"] = strToU8(serializePartXml(typesRoot, { defaultNs: NS_CONTENT_TYPES }));
    files["_rels/.rels"] = strToU8(relsXml(this.pkgRels, "/"));
    for (const part of parts) {
      const name = part.partname.slice(1);
      files[name] = part.xmlEl ? strToU8(serializePartXml(part.xmlEl, { docBindings: part.docBindings })) : new Uint8Array(part.blob);
      if (part.rels.size) {
        files[relsUriFor(part.partname).slice(1)] = strToU8(relsXml(part.rels, part.baseUri));
      }
    }
    return Buffer.from(zipSync(files, { level: 6 }));
  }
}

function extOf(partname) {
  const m = partname.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1] : "";
}

function relsBaseOf(relsUri) {
  // "/ppt/_rels/presentation.xml.rels" → "/ppt"
  const m = relsUri.match(/^(.*)\/_rels\/[^/]+\.rels$/);
  return m ? m[1] : "/";
}

function joinRel(base, target) {
  return base === "/" ? "/" + target : base + "/" + target;
}

function posixNormalize(p) {
  const out = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return "/" + out.join("/");
}

// Сериализация .rels: <Relationship> в числовом порядке rId (python-pptx).
// Target для внутренних — относительный путь от baseUri.
function relsXml(relSet, baseUri) {
  const rels = [...relSet.values()].sort((a, b) => rIdNum(a.rId) - rIdNum(b.rId));
  const root = new El("http://schemas.openxmlformats.org/package/2006/relationships", "Relationships");
  for (const rel of rels) {
    const r = new El("http://schemas.openxmlformats.org/package/2006/relationships", "Relationship");
    r.attrs.set("Id", rel.rId);
    r.attrs.set("Type", rel.reltype);
    let target = rel.target;
    if (!rel.isExternal) {
      target = target.startsWith("/") ? relTargetFromBase(baseUri, target) : target;
    }
    r.attrs.set("Target", target);
    if (rel.isExternal) r.attrs.set("TargetMode", "External");
    root.children.push(r);
  }
  return serializePartXml(root, { defaultNs: NS_RELATIONSHIPS });
}

function rIdNum(rId) {
  return rId.startsWith("rId") && /^\d+$/.test(rId.slice(3)) ? parseInt(rId.slice(3), 10) : 0;
}

// python-pptx PackURI target_ref: rel target записывается относительно base
function relTargetFromBase(baseUri, target) {
  // python-pptx хранит Target как заданный при relate_to; при сохранении пишет
  // rel.target_ref — target_ref у Part-таргета = относительный путь.
  if (baseUri === "/") return target.startsWith("/") ? target.slice(1) : target;
  const baseSegs = baseUri.split("/").filter(Boolean);
  const tgtSegs = target.split("/").filter(Boolean);
  let i = 0;
  while (i < baseSegs.length && i < tgtSegs.length && baseSegs[i] === tgtSegs[i]) i++;
  return "../".repeat(baseSegs.length - i) + tgtSegs.slice(i).join("/");
}

function findLocal(el, local) {
  if (!el) return null;
  for (const n of el.iter()) if (n.local === local) return n;
  return null;
}

module.exports = {
  Package, Part, Rel, RelSet, CT, RT, IMAGE_CONTENT_TYPES, relsUriFor, serializePartXml, findLocal,
};
