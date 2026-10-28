// deck.cjs — единый CLI presentation-skill v4: build, check, unpack (CJS).
'use strict';
const { bFail } = require("./helpers/errors.cjs");

const USAGE = "usage: deck.cjs build <projectDir> --out <deck.pptx> [--theme dark|light] [--template <ref.pptx> --ref <name>-ref/] [--app <path>]\n" +
  "       deck.cjs check <projectDir> [--theme dark|light] [--template <ref.pptx> --ref <name>-ref/]\n" +
  "       deck.cjs unpack <ref.pptx> --out <dir> [--render | --shots <dir>] [--with-pages]";

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || !["build", "check", "unpack"].includes(argv[0])) {
    bFail(2, { error: USAGE });
  }
  if (argv[0] === "unpack") {
    return require("./helpers/unpack/cli.cjs").run(argv.slice(1));
  }
  const buildCli = require("./helpers/builder/cli.cjs");
  if (argv[0] === "check") return buildCli.check(argv.slice(1));
  return buildCli.run(argv.slice(1));
}

(async () => {
  try {
    process.exitCode = await main();
  } catch (e) {
    if (e && e.__exitCode !== undefined) {
      process.exitCode = e.__exitCode;
      return;
    }
    const msg = e && e.stack && process.env.DECK_DEBUG ? e.stack : `${e && e.constructor.name}: ${e && e.message}`;
    const loc = e && e.stack ? (e.stack.split("\n")[1] || "").trim() : "?";
    bFail(3, { error: `внутренний сбой deck.cjs: ${msg} (${loc})`,
               suggestion: "устраните причину и повторите; verbatim-ретрай заблокирован guard'ом" });
  }
})();
