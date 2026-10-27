import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildMr, loadLocalDiff } from '../../lib/merge-request.mjs';
import { loadRules } from '../../lib/rules.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const rules = loadRules();
const langs = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'expected.json')));

test('every supported language has a seeded fixture', () => {
  assert.deepEqual(langs.sort(), Object.keys(rules.cfg.languages).sort());
});

for (const lang of langs) {
  test(`fixture ${lang}: ≥5 issues, rules exist, apply to the file, lines are in the diff`, () => {
    const expected = JSON.parse(fs.readFileSync(path.join(dir, lang, 'expected.json'), 'utf8'));
    const mr = buildMr(loadLocalDiff(path.join(dir, lang, 'change.diff')), rules.cfg);
    const file = mr.files.find((f) => f.path === expected.path);
    assert.ok(file && !file.skipped, 'fixture file is reviewable');
    assert.ok(expected.issues.length >= 5);
    const prefixes = file.ruleFiles.map((rf) => rules.prefixOfFile[rf]);
    for (const issue of expected.issues) {
      const rule = rules.byId.get(issue.ruleId);
      assert.ok(rule && rule.status === 'active', `${issue.ruleId} active`);
      assert.ok(prefixes.includes(rule.prefix), `${issue.ruleId} applies to ${expected.path}`);
      assert.ok(file.validLines.includes(issue.line), `line ${issue.line} in diff`);
    }
  });
}
