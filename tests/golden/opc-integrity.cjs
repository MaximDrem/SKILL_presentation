// opc-integrity.cjs — structural acceptance для всех built goldens:
// rel targets существуют, все parts достижимы от корня, content types покрывают parts.
// unzip -t дополняет, но не заменяет renderer acceptance (package-acceptance.cjs).
'use strict';
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { unzipSync } = require("../../vendor/fflate/lib/node.cjs");
const { Package } = require("../../tools/helpers/builder/opc.cjs");
const { GOLD } = require("../lib/oracle.cjs");

function checkPackage(buf, label) {
  const pkg = Package.load(buf);
  const problems = [];
  // reachability: каждый part достижим от корня
  const reachable = new Set(pkg.reachablePartnames());
  for (const pn of pkg.parts.keys()) {
    if (!reachable.has(pn)) problems.push(`${label}: unreachable part ${pn}`);
  }
  // rel targets существуют
  const allRels = [...pkg.pkgRels.values()];
  for (const part of pkg.parts.values()) allRels.push(...part.rels.values());
  for (const rel of allRels) {
    if (rel.isExternal) continue;
    if (!pkg.parts.has(rel.target)) problems.push(`${label}: dangling rel ${rel.rId} → ${rel.target}`);
  }
  // content type покрывает каждый part
  for (const pn of pkg.parts.keys()) {
    if (!pkg.contentTypeOf(pn)) problems.push(`${label}: no content type for ${pn}`);
  }
  return problems;
}

const GOLD_PPTX = fs.readdirSync(path.join(GOLD, "build-pptx")).filter((f) => f.endsWith(".pptx"));

test("opc integrity: все build goldens", () => {
  const problems = [];
  for (const f of GOLD_PPTX) {
    problems.push(...checkPackage(fs.readFileSync(path.join(GOLD, "build-pptx", f)), f));
  }
  assert.deepStrictEqual(problems, []);
});

test("opc integrity: unzip -t для всех build goldens", () => {
  for (const f of GOLD_PPTX) {
    const p = path.join(GOLD, "build-pptx", f);
    execFileSync("unzip", ["-t", p], { stdio: "pipe" });
  }
});

test("opc integrity: nested XLSX workbooks валидны", () => {
  const problems = [];
  for (const f of GOLD_PPTX) {
    const parts = unzipSync(new Uint8Array(fs.readFileSync(path.join(GOLD, "build-pptx", f))));
    for (const name of Object.keys(parts)) {
      if (!name.endsWith(".xlsx")) continue;
      try {
        problems.push(...checkPackage(Buffer.from(parts[name]), `${f}!${name}`));
      } catch (e) {
        problems.push(`${f}!${name}: ${e.message}`);
      }
    }
  }
  assert.deepStrictEqual(problems, []);
});
