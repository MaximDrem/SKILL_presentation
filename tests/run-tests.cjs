// run-tests.cjs — точка входа тестов v4: все suites, exit code.
'use strict';
const { execFileSync } = require("child_process");
const path = require("path");

const SUITES = [
  "tests/golden/unit.cjs",
  "tests/golden/unit2.cjs",
  "tests/golden/unit3.cjs",
  "tests/golden/jsonpy.cjs",
  "tests/golden/enum-guard.cjs",
  "tests/golden/align-anchor-matrix.cjs",
  "tests/golden/opc-roots.cjs",
  "tests/golden/mc-namespaces.cjs",
  "tests/golden/xml-encoding.cjs",
  "tests/golden/opc-integrity.cjs",
  "tests/golden/errors-envelope.cjs",
  "tests/golden/render-verify.cjs",
  "tests/golden/prepare-templates.cjs",
  "tests/golden/unpack-parity.cjs",
  "tests/golden/cli.cjs",
  "tests/golden/build-parity.cjs",
  "tests/mutation.cjs",
  "tests/regressions.cjs",
  "tests/ported32.cjs",
  "tests/package-acceptance.cjs",
  "tests/vendor-smoke.cjs",
  "tests/hermetic.cjs",
  "tests/corpus.cjs",
];

// изолирует vendor/adapter файлы во времени — только последовательно после основных
const SEQUENTIAL = ["tests/adapter-proof.cjs"];

const files = process.argv[2] ? [process.argv[2]] : SUITES;
try {
  execFileSync(process.execPath, ["--test", ...files.map((f) => path.join(__dirname, "..", f))],
               { stdio: "inherit", env: process.env });
  if (!process.argv[2]) {
    for (const f of SEQUENTIAL) {
      execFileSync(process.execPath, ["--test", path.join(__dirname, "..", f)],
                   { stdio: "inherit", env: process.env });
    }
  }
} catch (err) {
  const code = typeof err.status === "number" && err.status !== 0 ? err.status : 1;
  process.exit(code);
}
if (!process.argv[2] && !process.env.GIGATOOL_NODE && !process.env.MULTITOOL_NODE) {
  const msg = "[run-tests] ВНИМАНИЕ: GIGATOOL_NODE не задан — release-часть (renderer acceptance) НЕ выполнялась; " +
              "для release: DECK_REQUIRE_RENDERER=1 ELECTRON_RUN_AS_NODE=1 \"$GIGATOOL_NODE\" tests/run-tests.cjs";
  process.stderr.write(msg + "\n");
}
process.exit(0);
