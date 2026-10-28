// cli.cjs — CLI golden suite (все сценарии из goldens/cli).
'use strict';
const { test } = require("node:test");
const fs = require("fs");
const path = require("path");
const { GOLD } = require("../lib/oracle.cjs");
const { assertCliParity } = require("../lib/cli-parity.cjs");

const CASES = fs.readdirSync(path.join(GOLD, "cli")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));

for (const name of CASES) {
  test(`cli ${name}`, () => assertCliParity(name));
}
