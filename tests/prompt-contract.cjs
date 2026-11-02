'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { SKILL_JS } = require('./lib/oracle.cjs');

test('prompt contract: seeded path без $SKILL и команды для bash/PowerShell', () => {
  const skill = fs.readFileSync(path.join(SKILL_JS, 'SKILL.md'), 'utf8');
  const clone = fs.readFileSync(path.join(SKILL_JS, 'references/clone.md'), 'utf8');
  const create = fs.readFileSync(path.join(SKILL_JS, 'references/create.md'), 'utf8');
  const seeded = '$HOME/.wsc/config/skills/presentation/tools/deck.cjs';
  for (const [name, text] of [['SKILL.md', skill], ['clone.md', clone], ['create.md', create]]) {
    assert.ok(!text.includes('$SKILL'), `${name}: используется неопределённая $SKILL`);
    assert.ok(text.includes(seeded), `${name}: нет абсолютного seeded deck path`);
    assert.ok(text.includes('macOS / Linux / zsh / bash'), `${name}: нет bash section`);
    assert.ok(text.includes('Windows (PowerShell)'), `${name}: нет PowerShell section`);
    assert.ok(text.includes('$env:ELECTRON_RUN_AS_NODE="1"; & $env:GIGATOOL_NODE'), `${name}: нет PowerShell invocation`);
  }
  assert.ok(clone.includes('`thumbs*.png`'));
  assert.ok(!clone.includes('`thumbs-*.png`'));
  assert.ok(clone.includes('`decor-thumbs*.png`'));
});
