// canon.cjs — канонический дамп OPC-пакета (порт .oracle/canon.py, тот же формат).
'use strict';
const crypto = require("crypto");
const { unzipSync } = require("../../vendor/fflate/lib/node.cjs");
const { parseXml, docRoot, El } = require("../../tools/helpers/xml.cjs");

const VOLATILE_TAGS = new Set(["{http://purl.org/dc/terms/}created", "{http://purl.org/dc/terms/}modified"]);
const isVolatile = (part, tag) => part.endsWith("docProps/core.xml") && VOLATILE_TAGS.has(tag);

const esc = (s) => JSON.stringify(s);

function canonEl(el, depth, out, part) {
  const tag = el.tag;
  const attrs = [...el.attrs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let line = "  ".repeat(depth) + "<" + tag;
  for (const [k, v] of attrs) line += ` ${k}=${esc(v)}`;
  const children = el.children.filter((c) => c instanceof El);
  let text = el.children.filter((c) => typeof c === "string").join("");
  if (!text.trim()) text = "";
  if (isVolatile(part, tag)) text = "<volatile>";
  if (!children.length && !text) {
    out.push(line + "/>");
    return;
  }
  if (!children.length) {
    out.push(line + `>${esc(text)}</>`);
    return;
  }
  out.push(line + ">");
  if (text) out.push("  ".repeat(depth + 1) + esc(text));
  for (const c of children) canonEl(c, depth + 1, out, part);
  out.push("  ".repeat(depth) + "</>");
}

function canonPackage(data, prefix = "") {
  const zf = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data));
  const out = [];
  for (const name of Object.keys(zf).sort()) {
    if (name.endsWith("/")) continue;
    const partData = Buffer.from(zf[name]);
    const fq = prefix + name;
    if (/\.(xml|rels)$/i.test(name)) {
      out.push(`PART ${fq}`);
      const root = docRoot(parseXml(partData));
      if (root) canonEl(root, 0, out, fq);
    } else if (/\.(xlsx|docx|pptx)$/i.test(name)) {
      out.push(`NESTED ${fq}`);
      out.push(...canonPackage(partData, fq + "!"));
    } else {
      out.push(`BIN ${fq} sha256:${crypto.createHash("sha256").update(partData).digest("hex")}`);
    }
  }
  return out;
}

function canonText(data) {
  return canonPackage(data).join("\n") + "\n";
}

module.exports = { canonText, canonPackage };
