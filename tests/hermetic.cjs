'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { SKILL_JS } = require('./lib/oracle.cjs');

test('hermetic: temp-копия без Python, node_modules и сети проходит полный suite', { timeout: 600000 }, (t) => {
  if (process.env.DECK_HERMETIC === '1') {
    t.diagnostic('hermetic child: вложенная копия не создаётся');
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-hermetic-'));
  const root = path.join(tmp, 'skill');
  try {
    fs.mkdirSync(root);
    for (const name of ['tools', 'vendor', 'templates', 'references', 'tests']) {
      fs.cpSync(path.join(SKILL_JS, name), path.join(root, name), { recursive: true });
    }
    for (const name of ['SKILL.md', 'package.json', '.bundle-version']) {
      fs.copyFileSync(path.join(SKILL_JS, name), path.join(root, name));
    }
    assert.ok(!fs.existsSync(path.join(root, 'node_modules')));
    assert.ok(!fs.existsSync(path.join(root, 'vendor', 'node_modules')));
    const env = {
      PATH: '/usr/bin:/bin',
      HOME: tmp,
      DECK_HERMETIC: '1',
      ELECTRON_RUN_AS_NODE: '1',
      NODE_OPTIONS: path.join(root, 'tests', 'lib', 'no-network.cjs'),
      NO_COLOR: '1',
    };
    try {
      const output = execFileSync(process.execPath, [path.join(root, 'tests', 'run-tests.cjs')], {
        cwd: root, env, encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      t.diagnostic(output.trim().split('\n').slice(-8).join('\n'));
    } catch (e) {
      assert.fail(`hermetic child exit ${e.status}: ${String(e.stdout || '').slice(-3000)}\n${String(e.stderr || '').slice(-3000)}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
