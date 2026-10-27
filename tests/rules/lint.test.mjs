import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadRules, RULES_DIR, SEVERITIES, STATUSES } from '../../lib/rules.mjs';

const REQUIRED = ['severity', 'status', 'applies-to', 'look-for', 'why', 'fix', 'sources'];
const here = path.dirname(fileURLToPath(import.meta.url));
const { cfg, files } = loadRules();

test('languages.json and rule files match', () => {
  const listed = new Set([cfg.general, ...Object.values(cfg.languages).map((l) => l.file)]);
  const onDisk = new Set(fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.md')));
  assert.deepEqual([...onDisk].sort(), [...listed].sort());
  for (const f of files) {
    const lang = Object.values(cfg.languages).find((l) => l.file === f.file);
    if (lang) assert.equal(f.front.prefix, lang.prefix, `${f.file} prefix`);
  }
});

test('front matter', () => {
  for (const f of files) {
    assert.ok(f.front.language, `${f.file} language`);
    assert.match(f.front.prefix ?? '', /^[A-Z]+$/, `${f.file} prefix`);
    assert.match(f.front.version ?? '', /^\d+\.\d+\.\d+$/, `${f.file} version`);
  }
});

test('rule headings and ids', () => {
  const seen = new Map();
  for (const f of files) {
    assert.deepEqual(f.badHeadings, [], `${f.file}: headings must be "### <PREFIX>-NNN — <title>"`);
    assert.ok(f.rules.length > 0, `${f.file} has rules`);
    for (const r of f.rules) {
      assert.match(r.id, new RegExp(`^${f.front.prefix}-\\d{3}$`), `${f.file}:${r.line} id ${r.id}`);
      assert.ok(!seen.has(r.id), `${r.id} duplicated in ${f.file} and ${seen.get(r.id)}`);
      seen.set(r.id, f.file);
    }
  }
});

test('required keys, enums and sources', () => {
  for (const f of files) {
    for (const r of f.rules) {
      const where = `${f.file} ${r.id}`;
      for (const k of REQUIRED) assert.ok(r.fields[k], `${where} missing ${k}`);
      assert.ok(SEVERITIES.includes(r.fields.severity), `${where} severity ${r.fields.severity}`);
      assert.ok(STATUSES.includes(r.fields.status), `${where} status ${r.fields.status}`);
      const urls = r.fields.sources.split(',').map((s) => s.trim()).filter(Boolean);
      assert.ok(urls.length > 0 && urls.every((u) => /^https:\/\/\S+$/.test(u)), `${where} sources`);
    }
  }
});

test('published rule ids are never removed', () => {
  const published = JSON.parse(fs.readFileSync(path.join(here, 'published-ids.json'), 'utf8'));
  const ids = new Set(files.flatMap((f) => f.rules.map((r) => r.id)));
  for (const id of published) assert.ok(ids.has(id), `${id} was published and must stay (mark it retired instead)`);
});
