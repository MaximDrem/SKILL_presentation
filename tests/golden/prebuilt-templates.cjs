'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { SKILL_JS } = require('../lib/oracle.cjs');
const { Package } = require('../../tools/helpers/builder/opc.cjs');
const { findL, NS_R } = require('../../tools/helpers/builder/xmlbuild.cjs');
const { serialize } = require('../../tools/helpers/xml.cjs');

const DECK = path.join(SKILL_JS, 'tools/deck.cjs');

const md5 = (data) => crypto.createHash('md5').update(data).digest('hex');
const assigned = (catalog) => Object.values(catalog).flatMap((cfg) => cfg.proto).sort((a, b) => a - b);

test('prebuilt: templates, атласы и catalog самодостаточны', () => {
  assert.ok(fs.existsSync(path.join(SKILL_JS, 'templates/default-ref/slides.md')));
  assert.ok(fs.existsSync(path.join(SKILL_JS, 'templates/default-ref/decor/CATALOG.md')));
  assert.ok(fs.existsSync(path.join(SKILL_JS, 'templates/default-ref/decor/pictograms/picto-index.json')));
  assert.ok(!fs.existsSync(path.join(SKILL_JS, 'tools/helpers/build_templates')));
  for (const theme of ['dark', 'light']) {
    const pptx = path.join(SKILL_JS, 'templates', `default_${theme}.pptx`);
    const ref = path.join(SKILL_JS, 'templates', `default_${theme}-ref`);
    assert.ok(fs.existsSync(pptx));
    for (const name of ['_source.json', 'template.json', 'proto.json', 'media-map.json', 'STYLE.md', 'style.json', 'fonts.json']) {
      assert.ok(fs.existsSync(path.join(ref, name)), `${theme}: нет ${name}`);
    }
    assert.ok(fs.statSync(path.join(ref, 'media')).isDirectory());
    assert.ok(!fs.existsSync(path.join(ref, 'pages')));
    const source = JSON.parse(fs.readFileSync(path.join(ref, '_source.json'), 'utf8'));
    assert.strictEqual(source.bytes, fs.statSync(pptx).size);
    assert.strictEqual(source.file, `templates/default_${theme}.pptx`);
    const template = JSON.parse(fs.readFileSync(path.join(ref, 'template.json'), 'utf8'));
    assert.ok(Object.keys(template.protoMeta).length > 0);
    for (const [proto, meta] of Object.entries(template.protoMeta)) {
      assert.ok(fs.existsSync(path.join(ref, 'media', meta.arch)), `${theme}: proto ${proto}, нет media/${meta.arch}`);
    }
    const proto = JSON.parse(fs.readFileSync(path.join(ref, 'proto.json'), 'utf8'));
    assert.strictEqual(Object.keys(proto).length, source.slideCount);
  }
});

test('prebuilt: каждый proto наследует только назначенный новый фон', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(SKILL_JS, 'templates/backgrounds/backgrounds.json'), 'utf8'));
  for (const theme of ['dark', 'light']) {
    const themed = catalog[theme];
    assert.strictEqual(Object.keys(themed).length, 9);
    const template = JSON.parse(fs.readFileSync(path.join(SKILL_JS, 'templates', `default_${theme}-ref/template.json`), 'utf8'));
    assert.deepStrictEqual(assigned(themed), template.protoSlides.slice().sort((a, b) => a - b));
    const pkg = Package.load(fs.readFileSync(path.join(SKILL_JS, 'templates', `default_${theme}.pptx`)));
    for (const [role, cfg] of Object.entries(themed)) {
      const expected = md5(fs.readFileSync(path.join(SKILL_JS, cfg.file)));
      for (const proto of cfg.proto) {
        const part = pkg.parts.get(`/ppt/slides/slide${proto}.xml`);
        assert.ok(part, `${theme}: нет proto ${proto}`);
        const bg = findL(findL(part.xmlEl, 'cSld'), 'bg');
        assert.ok(bg, `${theme}: proto ${proto} без p:bg`);
        const blip = bg.iter().find((el) => el.local === 'blip');
        const target = part.rels.get(blip.attrs.get(`{${NS_R}}embed`)).target;
        assert.strictEqual(md5(pkg.parts.get(target).blob), expected, `${theme}: proto ${proto}, неверный фон ${target}`);
      }
  }
  }
});

test('prebuilt: 18 уникальных фонов и ни одного лишнего изображения', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(SKILL_JS, 'templates/backgrounds/backgrounds.json'), 'utf8'));
  const allowed = new Set();
  for (const theme of ['dark', 'light']) {
    for (const cfg of Object.values(catalog[theme])) allowed.add(md5(fs.readFileSync(path.join(SKILL_JS, cfg.file))));
  }
  assert.strictEqual(allowed.size, 18);
  for (const theme of ['dark', 'light']) {
    const pkg = Package.load(fs.readFileSync(path.join(SKILL_JS, 'templates', `default_${theme}.pptx`)));
    const media = [...pkg.parts.keys()].filter((name) => name.startsWith('/ppt/media/'));
    assert.strictEqual(media.length, 9, `${theme}: лишние media`);
    for (const name of media) assert.ok(allowed.has(md5(pkg.parts.get(name).blob)), `${theme}: посторонний ${name}`);
    for (const part of pkg.parts.values()) {
      if (!part.xmlEl || !/^\/ppt\/(slides|slideLayouts|slideMasters)\//.test(part.partname)) continue;
      assert.ok(!part.xmlEl.iter().some((el) => el.local === 'pic'), `${part.partname}: raster picture осталась`);
      const text = serialize(part.xmlEl);
      assert.ok(!/SberUser|SberKot/i.test(text), `${part.partname}: логотип остался`);
    }
    const map = JSON.parse(fs.readFileSync(path.join(SKILL_JS, 'templates', `default_${theme}-ref/media-map.json`), 'utf8'));
    assert.strictEqual(Object.keys(map.files).length, 9);
    for (const entry of Object.values(map.files)) assert.strictEqual(entry.class, 'background');
    const template = JSON.parse(fs.readFileSync(path.join(SKILL_JS, 'templates', `default_${theme}-ref/template.json`), 'utf8'));
    assert.strictEqual(template.branding, undefined);
  }
  assert.deepStrictEqual(fs.readdirSync(path.join(SKILL_JS, 'templates/default-ref/decor')).sort(), ['CATALOG.md', 'blobs', 'icons3d', 'illustrations', 'other', 'pictograms']);
  const index = JSON.parse(fs.readFileSync(path.join(SKILL_JS, 'templates/default-ref/decor/pictograms/picto-index.json'), 'utf8'));
  for (const [file] of index.rows) {
    assert.ok(fs.existsSync(path.join(SKILL_JS, 'templates/default-ref/decor/pictograms', file)), `нет ${file}`);
  }
});

test('prebuilt: dark/light build содержит только фон и никаких логотипов', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(SKILL_JS, 'templates/backgrounds/backgrounds.json'), 'utf8'));
  const allowed = new Set();
  for (const theme of ['dark', 'light']) {
    for (const cfg of Object.values(catalog[theme])) allowed.add(md5(fs.readFileSync(path.join(SKILL_JS, cfg.file))));
  }
  for (const theme of ['dark', 'light']) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `prebuilt-${theme}-`));
    const out = path.join(tmp, 'deck.pptx');
    execFileSync(process.execPath, [DECK, 'build', path.join(SKILL_JS, 'tests/fixtures/projects', `${theme}-text`), '--theme', theme, '--out', out], {
      env: { ...process.env, DECK_SKIP_RENDER: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const pkg = Package.load(fs.readFileSync(out));
    for (const part of pkg.parts.values()) {
      if (!part.xmlEl || !part.partname.startsWith('/ppt/slides/')) continue;
      const text = serialize(part.xmlEl);
      assert.ok(!/SberUser|SberKot/i.test(text), `${theme}: логотип в build`);
      assert.ok(!part.xmlEl.iter().some((el) => el.local === 'pic'), `${theme}: унаследованная picture в build`);
    }
    for (const name of [...pkg.parts.keys()].filter((n) => n.startsWith('/ppt/media/'))) {
      assert.ok(allowed.has(md5(pkg.parts.get(name).blob)), `${theme}: посторонний media ${name}`);
    }
  }
});

