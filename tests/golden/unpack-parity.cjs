// unpack-parity.cjs — CJS unpack vs Python goldens (atlas JSON/MD точное равенство).
'use strict';
const { test } = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { SKILL_JS, GOLD, FIX, assertDeepEqual } = require("../lib/oracle.cjs");

const DECK = path.join(SKILL_JS, "tools", "deck.cjs");

function runUnpack(args, envExtra) {
  const env = { ...process.env };
  delete env.GIGATOOL_NODE;
  delete env.MULTITOOL_NODE;
  delete env.GIGATOOL_APP_PATH;
  delete env.MULTITOOL_APP_PATH;
  delete env.GIGATOOL_RENDERER_URL;
  delete env.MULTITOOL_RENDERER_URL;
  delete env.DECK_SKIP_RENDER;
  delete env.DECK_DEBUG;
  if (envExtra) Object.assign(env, envExtra);
  try {
    const r = execFileSync(process.execPath, [DECK, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { exit: 0, stdout: r, stderr: "" };
  } catch (e) {
    return { exit: e.status ?? 1, stdout: e.stdout?.toString() ?? "", stderr: e.stderr?.toString() ?? "" };
  }
}

function readAtlas(dir) {
  const out = {};
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) {
        if (e.name === "media") continue; // байты медиа — отдельно
        walk(p, r);
      } else if (/\.(json|md)$/.test(e.name)) {
        out[r] = fs.readFileSync(p, "utf8");
      }
    }
  };
  walk(dir, "");
  return out;
}

function loadGoldenAtlas(name) {
  const dir = path.join(GOLD, "unpack", name);
  const out = {};
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else out[r] = fs.readFileSync(p, "utf8");
    }
  };
  walk(dir, "");
  return out;
}

function normSourceJson(text, relaxBytes) {
  const d = JSON.parse(text);
  d.file = "<SOURCE>";
  d.mtime = 0;
  if (relaxBytes) d.bytes = 0; // CJS vs Python zip container bytes различаются
  return JSON.stringify(d, null, 2);
}

function compareAtlas(name, actualDir, goldenName, opts = {}) {
  const gold = loadGoldenAtlas(goldenName);
  const act = readAtlas(actualDir);
  const missing = Object.keys(gold).filter((k) => !(k in act));
  const extra = Object.keys(act).filter((k) => !(k in gold));
  if (missing.length || extra.length) {
    throw new Error(`${name}: missing=[${missing}] extra=[${extra}]`);
  }
  for (const [k, gtext] of Object.entries(gold)) {
    let atext = act[k];
    let g = gtext;
    if (k === "_source.json") {
      atext = normSourceJson(atext, opts.relaxSourceBytes);
      g = normSourceJson(g, opts.relaxSourceBytes);
      if (atext !== g) throw new Error(`${name}/${k}: _source.json diff`);
      continue;
    }
    if (atext !== g) {
      // точный diff первых расходящихся строк
      const al = atext.split("\n"), gl = g.split("\n");
      let first = -1;
      for (let i = 0; i < Math.max(al.length, gl.length); i++) {
        if (al[i] !== gl[i]) { first = i; break; }
      }
      throw new Error(`${name}/${k}: первое расхождение на строке ${first + 1}:\n  CJS: ${al[first]}\n  PY : ${gl[first]}`);
    }
  }
}

test("unpack parity: tiny-clone (--with-pages)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "u-parity-"));
  const out = path.join(tmp, "ref");
  const r = runUnpack(["unpack", path.join(FIX, "tiny-clone.pptx"), "--out", out, "--with-pages", "--no-decor-thumbs"]);
  if (r.exit !== 0) throw new Error(`exit=${r.exit} stderr=${r.stderr.slice(0, 400)}`);
  compareAtlas("tiny-clone", out, "tiny-clone");
});

test("unpack parity: default_dark/default_light", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "u-parity-"));
  for (const theme of ["dark", "light"]) {
    const out = path.join(tmp, `${theme}-ref`);
    const r = runUnpack(["unpack", path.join(SKILL_JS, "templates", `default_${theme}.pptx`), "--out", out, "--no-decor-thumbs"]);
    if (r.exit !== 0) throw new Error(`${theme}: exit=${r.exit} stderr=${r.stderr.slice(0, 400)}`);
    compareAtlas(`default_${theme}`, out, `default_${theme}`);
  }
});

test("unpack parity: roundtrips (Python build pptx)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "u-parity-"));
  for (const name of ["blank-text", "charts", "elements-all", "clone-tiny"]) {
    const src = path.join(GOLD, "build-pptx", name + ".pptx");
    const out = path.join(tmp, `${name}-ref`);
    const r = runUnpack(["unpack", src, "--out", out, "--with-pages", "--no-decor-thumbs"]);
    if (r.exit !== 0) throw new Error(`${name}: exit=${r.exit} stderr=${r.stderr.slice(0, 400)}`);
    compareAtlas(`roundtrip-${name}`, out, `roundtrip-${name}`);
  }
});

test("unpack: CJS build → CJS unpack comparison (canon-эквивалентные deck → тот же atlas)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "u-cjs-roundtrip-"));
  const buildEnv = () => {
    const env = { ...process.env, DECK_SKIP_RENDER: "1" };
    delete env.GIGATOOL_NODE;
    delete env.MULTITOOL_NODE;
    return env;
  };
  for (const name of ["blank-text", "charts", "elements-all", "clone-tiny"]) {
    const args = [DECK, "build", path.join(FIX, "projects", name)];
    if (name === "clone-tiny") {
      const tpl = path.join(FIX, "tiny-clone.pptx");
      const ref = path.join(tmp, "clone-tiny-tplref");
      const r0 = runUnpack(["unpack", tpl, "--out", ref, "--with-pages", "--no-decor-thumbs"]);
      if (r0.exit !== 0) throw new Error(`clone-tiny ref unpack: exit=${r0.exit}`);
      args.push("--template", tpl, "--ref", ref);
    }
    const built = path.join(tmp, `${name}.pptx`);
    execFileSync(process.execPath, [...args, "--out", built],
                 { env: buildEnv(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300000 });
    const out = path.join(tmp, `${name}-cjs-ref`);
    const r = runUnpack(["unpack", built, "--out", out, "--with-pages", "--no-decor-thumbs"]);
    if (r.exit !== 0) throw new Error(`${name}: unpack exit=${r.exit} stderr=${r.stderr.slice(0, 400)}`);
    compareAtlas(`roundtrip-cjs-${name}`, out, `roundtrip-${name}`, { relaxSourceBytes: true });
  }
});

test("unpack: media bytes бит-в-бит vs source pptx", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "u-parity-"));
  const out = path.join(tmp, "ref");
  const src = path.join(FIX, "tiny-clone.pptx");
  runUnpack(["unpack", src, "--out", out, "--no-decor-thumbs"]);
  const { unzipSync } = require("../../vendor/fflate/lib/node.cjs");
  const parts = unzipSync(new Uint8Array(fs.readFileSync(src)));
  for (const [name, data] of Object.entries(parts)) {
    if (!name.startsWith("ppt/media/") || name.endsWith("/")) continue;
    const got = fs.readFileSync(path.join(out, "media", path.posix.basename(name)));
    if (!Buffer.from(data).equals(got)) throw new Error(`media bytes differ: ${name}`);
  }
});

module.exports = { runUnpack, compareAtlas };
