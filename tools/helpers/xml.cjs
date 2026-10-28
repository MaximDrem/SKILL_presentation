// xml.cjs — order-preserving XML DOM (парсер/сериализатор) для OPC-слоя.
// Семантика парсера зеркалит lxml: entity decode, нормализация \t\n\r в
// значениях атрибутов, namespace expansion {uri}local, текст как есть.
'use strict';

class El {
  constructor(ns, local) {
    this.ns = ns || null;      // namespace URI или null
    this.local = local;        // local name
    this.attrs = new Map();    // expanded name ({uri}local или local) → value
    this.children = [];        // El | string
  }
  get tag() { return this.ns ? `{${this.ns}}${this.local}` : this.local; }
  find(expanded) { for (const c of this.children) if (c instanceof El && c.tag === expanded) return c; return null; }
  findAll(expanded) { return this.children.filter((c) => c instanceof El && c.tag === expanded); }
  *iter() { yield this; for (const c of this.children) if (c instanceof El) yield* c.iter(); }
  makeElement(expandedTag, attrs) {
    const m = expandedTag.match(/^\{([^}]*)\}(.*)$/);
    const el = new El(m ? m[1] : null, m ? m[2] : expandedTag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) el.attrs.set(k, String(v));
    return el;
  }
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(s, isAttr) {
  if (!s.includes("&")) return isAttr ? s.replace(/[\t\n\r]/g, " ") : s.replace(/\r\n?/g, "\n");
  let out = s.replace(/&(#x[0-9A-Fa-f]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[e];
  });
  return isAttr ? out.replace(/[\t\n\r]/g, " ") : out.replace(/\r\n?/g, "\n");
}

// Декодирование XML по BOM/XML declaration (lxml-семантика): UTF-8/16LE/16BE,
// BOM-приоритет, sniff "<?xml" для UTF-16 без BOM, encoding= из declaration.
function decodeXml(data) {
  if (typeof data === "string") return data;
  const b = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return new TextDecoder("utf-8").decode(b.subarray(3));
  if (b.length >= 2) {
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder("utf-16le").decode(b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder("utf-16be").decode(b.subarray(2));
  }
  if (b.length >= 4) {
    if (b[0] === 0x3C && b[1] === 0x00) return new TextDecoder("utf-16le").decode(b);
    if (b[0] === 0x00 && b[1] === 0x3C) return new TextDecoder("utf-16be").decode(b);
  }
  const head = b.subarray(0, 256).toString("latin1");
  const m = head.match(/<\?xml[^?]*?encoding\s*=\s*["']([^"']+)["']/i);
  if (m) {
    const enc = m[1].toLowerCase();
    if (enc === "utf-16" || enc === "utf-16le") return new TextDecoder("utf-16le").decode(b);
    if (enc === "utf-16be") return new TextDecoder("utf-16be").decode(b);
    if (enc !== "utf-8" && enc !== "utf8" && enc !== "us-ascii") {
      try { return new TextDecoder(enc).decode(b); } catch { /* неизвестная кодировка → utf-8 */ }
    }
  }
  return new TextDecoder("utf-8").decode(b);
}

// Простой конечный автомат; OOXML — строгий XML без mixed tricks.
function parseXml(data) {
  const s = typeof data === "string" ? data : decodeXml(data);
  let i = 0;
  const n = s.length;
  const root = new El(null, "#root");
  const stack = [root];
  const nsStack = [{}]; // prefix → uri

  function err(msg) { throw new Error(`XML parse error @${i}: ${msg}`); }

  while (i < n) {
    const c = s[i];
    if (c === "<") {
      if (s.startsWith("<!--", i)) {
        const end = s.indexOf("-->", i + 4);
        i = end < 0 ? n : end + 3;
        continue;
      }
      if (s.startsWith("<![CDATA[", i)) {
        const end = s.indexOf("]]>", i + 9);
        const text = end < 0 ? s.slice(i + 9) : s.slice(i + 9, end);
        stack[stack.length - 1].children.push(text);
        i = end < 0 ? n : end + 3;
        continue;
      }
      if (s.startsWith("<?", i)) {
        const end = s.indexOf("?>", i + 2);
        i = end < 0 ? n : end + 2;
        continue;
      }
      if (s.startsWith("<!DOCTYPE", i) || s.startsWith("<!doctype", i)) {
        const end = s.indexOf(">", i + 2);
        i = end < 0 ? n : end + 1;
        continue;
      }
      if (s.startsWith("</", i)) {
        const end = s.indexOf(">", i + 2);
        if (end < 0) err("unterminated close tag");
        i = end + 1;
        stack.pop();
        nsStack.pop();
        continue;
      }
      // open tag
      let j = i + 1;
      while (j < n && !/[\s/>]/.test(s[j])) j++;
      const qname = s.slice(i + 1, j);
      const attrs = [];
      let selfClose = false;
      while (j < n) {
        while (j < n && /\s/.test(s[j])) j++;
        if (s[j] === ">") { j++; break; }
        if (s[j] === "/" && s[j + 1] === ">") { j += 2; selfClose = true; break; }
        let k = j;
        while (k < n && s[k] !== "=" && !/[\s/>]/.test(s[k])) k++;
        const aname = s.slice(j, k);
        while (k < n && /\s/.test(s[k])) k++;
        let avalue = "";
        if (s[k] === "=") {
          k++;
          while (k < n && /\s/.test(s[k])) k++;
          const q = s[k];
          const e2 = s.indexOf(q, k + 1);
          avalue = s.slice(k + 1, e2 < 0 ? n : e2);
          k = (e2 < 0 ? n : e2) + 1;
        }
        attrs.push([aname, avalue]);
        j = k;
      }
      i = j;
      // namespaces этого элемента
      const scope = { ...nsStack[nsStack.length - 1] };
      for (const [an, av] of attrs) {
        if (an === "xmlns") scope[""] = decodeEntities(av, true);
        else if (an.startsWith("xmlns:")) scope[an.slice(6)] = decodeEntities(av, true);
      }
      const colon = qname.indexOf(":");
      const prefix = colon >= 0 ? qname.slice(0, colon) : "";
      const local = colon >= 0 ? qname.slice(colon + 1) : qname;
      const uri = prefix ? (scope[prefix] || null) : (scope[""] || null);
      const el = new El(uri, local);
      el.qname = qname;
      el.nsScope = scope; // effective namespace scope узла (descendant bindings)
      for (const [an, av] of attrs) {
        if (an === "xmlns" || an.startsWith("xmlns:")) continue;
        const ac = an.indexOf(":");
        if (ac >= 0) {
          const ap = an.slice(0, ac), al = an.slice(ac + 1);
          el.attrs.set(scope[ap] ? `{${scope[ap]}}${al}` : al, decodeEntities(av, true));
        } else {
          el.attrs.set(an, decodeEntities(av, true));
        }
      }
      stack[stack.length - 1].children.push(el);
      if (!selfClose) {
        stack.push(el);
        nsStack.push(scope);
      }
      // привязки prefix→uri корневого элемента — для сохранения QName-valued
      // атрибутов (mc:Ignorable, mc:Choice/@Requires) при сериализации
      if (root.docBindings === undefined && stack.length === 2) {
        root.docBindings = scope;
      }
      continue;
    }
    // text
    const end = s.indexOf("<", i);
    const text = end < 0 ? s.slice(i) : s.slice(i, end);
    if (text) stack[stack.length - 1].children.push(decodeEntities(text, false));
    i = end < 0 ? n : end;
  }
  return root;
}

// Вернуть первый реальный элемент (пропуская текст)
function docRoot(root) {
  for (const c of root.children) if (c instanceof El) return c;
  return null;
}

// ---- сериализатор (build/normalizer) ----

const DEFAULT_PREFIXES = {
  "http://schemas.openxmlformats.org/drawingml/2006/main": "a",
  "http://schemas.openxmlformats.org/presentationml/2006/main": "p",
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships": "r",
  "http://schemas.openxmlformats.org/drawingml/2006/chart": "c",
  "http://schemas.microsoft.com/office/drawing/2016/SVG/main": "asvg",
  "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing": "xdr",
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main": "x",
  "http://schemas.openxmlformats.org/package/2006/relationships": "rel",
  "http://schemas.openxmlformats.org/package/2006/content-types": "ct",
  "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties": "ep",
  "http://purl.org/dc/elements/1.1/": "dc",
  "http://purl.org/dc/terms/": "dcterms",
  "http://schemas.openxmlformats.org/package/2006/metadata/core-properties": "cp",
  "http://www.w3.org/2001/XMLSchema-instance": "xsi",
  "http://purl.org/dc/dcmitype/": "dcmitype",
};

function escapeXml(s, isAttr) {
  let out = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (isAttr) out = out.replace(/"/g, "&quot;");
  return out;
}

const MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006";

// QName-valued атрибуты MC: mc:Ignorable и mc:Choice/@Requires. PowerPoint пишет
// Requires без префикса — распознаём по родителю (элемент в MC namespace).
function isMcQnameAttr(node, k, m) {
  if (m && m[1] === MC_NS && (m[2] === "Ignorable" || m[2] === "Requires")) return true;
  return !m && node.ns === MC_NS && (k === "Ignorable" || k === "Requires");
}

function serialize(el, opts = {}) {
  const defaultNs = opts.defaultNs || null; // URI, сериализуемый без префикса (xmlns="…")
  const docBindings = opts.docBindings || null; // исходные prefix→uri корня part
  // предпочтение исходных префиксов документа, затем DEFAULT_PREFIXES
  const base = { ...DEFAULT_PREFIXES };
  if (docBindings) {
    for (const [pfx, uri] of Object.entries(docBindings)) {
      if (pfx && uri && base[uri] === undefined) base[uri] = pfx;
    }
  }
  const wanted = { ...base, ...(opts.prefixes || {}) };
  // effective scope узла: descendant bindings при парсинге, иначе корневые
  const scopeOf = (node) => node.nsScope || docBindings || {};
  // собрать использованные namespace URI (+ URI из QName-valued атрибутов)
  const used = new Set();
  for (const n of el.iter()) {
    if (n.ns) used.add(n.ns);
    for (const [k, v] of n.attrs) {
      const m = k.match(/^\{([^}]*)\}(.*)$/);
      if (m) used.add(m[1]);
      const scope = scopeOf(n);
      if (scope && isMcQnameAttr(n, k, m)) {
        for (const tok of v.split(/\s+/)) if (tok && scope[tok]) used.add(scope[tok]);
      }
    }
  }
  // атрибуты default namespace не наследуют: если {defaultNs}x атрибут есть, префикс нужен
  let attrNeedsDefaultPrefix = false;
  if (defaultNs) {
    for (const n of el.iter()) {
      for (const k of n.attrs.keys()) {
        const m = k.match(/^\{([^}]*)\}(.*)$/);
        if (m && m[1] === defaultNs) { attrNeedsDefaultPrefix = true; break; }
      }
    }
  }
  // финальные uri→prefix с разрешением коллизий (два URI хотят один префикс → nsN)
  const finalPrefix = new Map();
  let autoN = 1;
  for (const uri of used) {
    if (uri === defaultNs && !attrNeedsDefaultPrefix) continue;
    let pfx = wanted[uri];
    if (pfx && [...finalPrefix.values()].includes(pfx)) pfx = null;
    while (!pfx) {
      const cand = `ns${autoN++}`;
      if (![...finalPrefix.values()].includes(cand)) pfx = cand;
    }
    finalPrefix.set(uri, pfx);
  }
  // QName-valued attrs: remap токенов prefix → финальный prefix (scope узла,
  // descendant bindings учитываются так же, как root bindings)
  const remapQnameValue = (node, v) => {
    const scope = scopeOf(node);
    return v.split(/(\s+)/).map((tok) => {
      const uri = scope[tok];
      if (!uri) return tok;
      return finalPrefix.get(uri) || tok;
    }).join("");
  };
  const parts = [];
  const write = (node, isRoot) => {
    if (typeof node === "string") { parts.push(escapeXml(node, false)); return; }
    const qn = node.ns ? (node.ns === defaultNs ? node.local : `${finalPrefix.get(node.ns)}:${node.local}`) : node.local;
    let open = "<" + qn;
    if (isRoot) {
      if (defaultNs && used.has(defaultNs)) open += ` xmlns="${defaultNs}"`;
      for (const uri of used) {
        if (uri === defaultNs && !attrNeedsDefaultPrefix) continue;
        open += ` xmlns:${finalPrefix.get(uri)}="${uri}"`;
      }
    }
    for (const [k, v0] of node.attrs) {
      const m = k.match(/^\{([^}]*)\}(.*)$/);
      // атрибуты default namespace не наследуют: {defaultNs}x всегда с префиксом
      const ak = m && finalPrefix.has(m[1]) ? `${finalPrefix.get(m[1])}:${m[2]}` : m ? m[2] : k;
      const v = isMcQnameAttr(node, k, m) ? remapQnameValue(node, v0) : v0;
      open += ` ${ak}="${escapeXml(v, true)}"`;
    }
    if (node.children.length === 0) {
      parts.push(open + "/>");
      return;
    }
    parts.push(open + ">");
    for (const c of node.children) write(c, false);
    parts.push(`</${qn}>`);
  };
  write(el, true);
  return parts.join("");
}

module.exports = { El, parseXml, docRoot, serialize, decodeEntities, decodeXml, escapeXml, DEFAULT_PREFIXES };
