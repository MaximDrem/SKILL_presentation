// mutation.cjs — компаратор canon обязан ловить изменения (анти-перет fit).
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { canonText, canonPackage } = require("./lib/canon.cjs");
const { GOLD, FIX } = require("./lib/oracle.cjs");
const { zipSync, unzipSync, strToU8 } = require("../vendor/fflate/lib/node.cjs");
const { parseXml, docRoot, serialize, El } = require("../tools/helpers/xml.cjs");
const crypto = require("crypto");

const GOLDEN_PPTX = path.join(GOLD, "build-pptx", "charts.pptx");
const GOLDEN_CANON = fs.readFileSync(path.join(GOLD, "build", "charts.canon.txt"), "utf8");

function withMutatedSlide(fn) {
  const parts = unzipSync(new Uint8Array(fs.readFileSync(GOLDEN_PPTX)));
  const name = "ppt/slides/slide1.xml";
  const root = docRoot(parseXml(parts[name]));
  fn(root);
  parts[name] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + serialize(root));
  return Buffer.from(zipSync(parts));
}

function* allEls(root) {
  for (const c of root.children) {
    if (c && typeof c === "object") { yield c; yield* allEls(c); }
  }
}

test("canon: baseline равен golden", () => {
  const got = canonText(fs.readFileSync(GOLDEN_PPTX));
  assert.strictEqual(got, GOLDEN_CANON);
});

test("mutation: изменение текста ловится", () => {
  const buf = withMutatedSlide((root) => {
    for (const el of allEls(root)) {
      if (el.local === "cNvPr" && el.attrs.get("name")) {
        el.attrs.set("name", el.attrs.get("name") + "X");
        return;
      }
    }
    throw new Error("нет cNvPr для мутации");
  });
  assert.notStrictEqual(canonText(buf), GOLDEN_CANON);
});

test("mutation: изменение атрибута ловится", () => {
  const buf = withMutatedSlide((root) => {
    for (const el of allEls(root)) {
      if (el.attrs.has("rot") || el.local === "ext") {
        el.attrs.set("cx", String((parseInt(el.attrs.get("cx") || "100", 10) + 9525)));
        return;
      }
    }
  });
  assert.notStrictEqual(canonText(buf), GOLDEN_CANON);
});

test("mutation: удалённый элемент ловится", () => {
  const buf = withMutatedSlide((root) => {
    const spTree = [...allEls(root)].find((e) => e.local === "spTree");
    const before = spTree.children.length;
    spTree.children = spTree.children.filter((c) => !(typeof c === "object" && c.local === "graphicFrame"));
    if (spTree.children.length === before) throw new Error("нет graphicFrame для удаления");
  });
  assert.notStrictEqual(canonText(buf), GOLDEN_CANON);
});

test("mutation: изменённые медиа-байты ловятся (sha256)", () => {
  // fixture с гарантированным ppt/media — precondition обязателен (никаких silent pass)
  const MEDIA_PPTX = path.join(GOLD, "build-pptx", "dark-text.pptx");
  const parts = unzipSync(new Uint8Array(fs.readFileSync(MEDIA_PPTX)));
  const media = Object.keys(parts).find((n) => n.startsWith("ppt/media/"));
  assert.ok(media, "fixture dark-text.pptx обязан содержать ppt/media/*");
  const baseline = canonText(fs.readFileSync(MEDIA_PPTX));
  const d = Buffer.from(parts[media]);
  d[100] ^= 0xff;
  parts[media] = new Uint8Array(d);
  assert.notStrictEqual(canonText(Buffer.from(zipSync(parts))), baseline);
});

test("mutation: изменение в embedded xlsx ловится (nested OPC)", () => {
  const parts = unzipSync(new Uint8Array(fs.readFileSync(GOLDEN_PPTX)));
  const xlsx = Object.keys(parts).find((n) => n.endsWith(".xlsx"));
  const inner = unzipSync(new Uint8Array(Buffer.from(parts[xlsx])));
  const sheet = docRoot(parseXml(inner["xl/worksheets/sheet1.xml"]));
  for (const el of allEls(sheet)) {
    if (el.local === "v" && el.children.length) {
      el.children = [String(el.children[0]) + "9"];
      break;
    }
  }
  inner["xl/worksheets/sheet1.xml"] = strToU8(serialize(sheet));
  parts[xlsx] = zipSync(inner);
  assert.notStrictEqual(canonText(Buffer.from(zipSync(parts))), GOLDEN_CANON);
});

test("mutation: порядок атрибутов НЕ ловится (коллапс по контракту)", () => {
  const buf = withMutatedSlide((root) => {
    for (const el of allEls(root)) {
      if (el.attrs.size >= 2) {
        el.attrs = new Map([...el.attrs.entries()].reverse());
        return;
      }
    }
  });
  assert.strictEqual(canonText(buf), GOLDEN_CANON);
});

test("mutation: переименование префикса ns НЕ ловится", () => {
  // canon использует {uri}local — префикс не виден
  const parts = unzipSync(new Uint8Array(fs.readFileSync(GOLDEN_PPTX)));
  const name = "ppt/slides/slide1.xml";
  let text = Buffer.from(parts[name]).toString();
  // a: → xxx: с переназначением xmlns
  text = text.replaceAll("<a:", "<xxx:").replaceAll("</a:", "</xxx:").replaceAll("xmlns:a=", "xmlns:xxx=");
  parts[name] = strToU8(text);
  assert.strictEqual(canonText(Buffer.from(zipSync(parts))), GOLDEN_CANON);
});

// --- мутации самого checker: признаки канонизации несущие, не декоративные ---

// canon без сортировки атрибутов: переупорядоченные атрибуты стали бы «различием»
function canonTextNoAttrSort(data) {
  const parts = unzipSync(new Uint8Array(data));
  const out = [];
  const walk = (el, depth) => {
    let line = "  ".repeat(depth) + "<" + el.tag;
    for (const [k, v] of el.attrs.entries()) line += ` ${k}=${JSON.stringify(v)}`;
    const children = el.children.filter((c) => c instanceof El);
    const text = el.children.filter((c) => typeof c === "string").join("").trim();
    if (!children.length && !text) { out.push(line + "/>"); return; }
    out.push(line + ">");
    if (text) out.push("  ".repeat(depth + 1) + JSON.stringify(text));
    for (const c of children) walk(c, depth + 1);
  };
  for (const name of Object.keys(parts).sort()) {
    if (!/\.(xml|rels)$/i.test(name)) continue;
    out.push(`PART ${name}`);
    const root = docRoot(parseXml(parts[name]));
    if (root) walk(root, 0);
  }
  return out.join("\n") + "\n";
}

test("checker-mutation: без сортировки атрибутов порядок атрибутов ловился бы", () => {
  const buf = withMutatedSlide((root) => {
    for (const el of allEls(root)) {
      if (el.attrs.size >= 2) {
        el.attrs = new Map([...el.attrs.entries()].reverse());
        return;
      }
    }
  });
  assert.strictEqual(canonText(buf), GOLDEN_CANON); // настоящий checker — равенство
  assert.notStrictEqual(canonTextNoAttrSort(buf), canonTextNoAttrSort(fs.readFileSync(GOLDEN_PPTX)));
});

test("checker-mutation: checker без текста пропустил бы текстовую мутацию", () => {
  // вариант canon, игнорирующий текстовые узлы
  const parts0 = unzipSync(new Uint8Array(fs.readFileSync(GOLDEN_PPTX)));
  const canonNoText = (data) => {
    const parts = unzipSync(new Uint8Array(data));
    const out = [];
    const walk = (el, depth) => {
      let line = "  ".repeat(depth) + "<" + el.tag;
      const attrs = [...el.attrs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
      for (const [k, v] of attrs) line += ` ${k}=${JSON.stringify(v)}`;
      const children = el.children.filter((c) => c instanceof El);
      if (!children.length) { out.push(line + "/>"); return; }
      out.push(line + ">");
      for (const c of children) walk(c, depth + 1);
    };
    for (const name of Object.keys(parts).sort()) {
      if (!/\.(xml|rels)$/i.test(name)) continue;
      out.push(`PART ${name}`);
      const root = docRoot(parseXml(parts[name]));
      if (root) walk(root, 0);
    }
    return out.join("\n") + "\n";
  };
  const partsM = unzipSync(new Uint8Array(fs.readFileSync(GOLDEN_PPTX)));
  // charts-deck: текст в chart part (c:v) — гарантированно есть
  const chartPart = Object.keys(partsM).find((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  const croot = docRoot(parseXml(partsM[chartPart]));
  let mutated = false;
  for (const el of allEls(croot)) {
    if (el.local === "v" && el.children.length) {
      el.children = [String(el.children[0]) + " MUTATED"];
      mutated = true;
      break;
    }
  }
  if (!mutated) throw new Error("нет c:v для мутации");
  partsM[chartPart] = strToU8(serialize(croot));
  const buf = Buffer.from(zipSync(partsM));
  assert.notStrictEqual(canonText(buf), GOLDEN_CANON); // настоящий checker ловит
  assert.strictEqual(canonNoText(buf), canonNoText(fs.readFileSync(GOLDEN_PPTX))); // сломанный — нет
});
