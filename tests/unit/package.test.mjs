import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const pkg = read('package.json');
const plugin = read('.claude-plugin/plugin.json');
const marketplace = read('.claude-plugin/marketplace.json');

test('package and plugin versions and names match', () => {
  assert.equal(pkg.name, 'review-comment');
  assert.equal(plugin.name, pkg.name);
  assert.equal(plugin.version, pkg.version);
  assert.equal(marketplace.plugins[0].name, plugin.name);
  assert.deepEqual(marketplace.plugins[0].source, { source: 'npm', package: pkg.name });
});

test('no runtime dependencies', () => {
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0);
});

test('published files include the plugin', () => {
  for (const f of ['.claude-plugin/', 'skills/', 'rules/', 'bin/', 'lib/']) assert.ok(pkg.files.includes(f), f);
});

test('both skills exist with matching names', () => {
  for (const name of ['review-file', 'review-post']) {
    const md = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(md, new RegExp(`^---\\nname: ${name}\\n`, 'm'));
    assert.match(md, /^description: .+/m);
  }
  const fileSkill = fs.readFileSync(path.join(root, 'skills', 'review-file', 'SKILL.md'), 'utf8');
  assert.match(fileSkill, /never post/i);
  assert.ok(!/mr\.mjs"? post/.test(fileSkill), 'review-file never calls the post command');
  assert.match(fs.readFileSync(path.join(root, 'skills', 'review-post', 'SKILL.md'), 'utf8'), /disable-model-invocation: true/);
});
