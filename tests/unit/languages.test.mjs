import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchGlob, rulesFor } from '../../lib/languages.mjs';
import { loadLanguages } from '../../lib/rules.mjs';

const cfg = loadLanguages();

test('extension → rule files', () => {
  const cases = {
    'src/A.cs': ['general.md', 'csharp.md'],
    'cmd/main.go': ['general.md', 'go.md'],
    'src/Main.java': ['general.md', 'java.md'],
    'src/a.ts': ['general.md', 'typescript.md'],
    'src/View.tsx': ['general.md', 'typescript.md', 'react.md'],
    'src/View.jsx': ['general.md', 'javascript.md', 'react.md'],
    'src/x.mjs': ['general.md', 'javascript.md'],
    'tool.py': ['general.md'],
  };
  for (const [p, files] of Object.entries(cases)) assert.deepEqual(rulesFor(p, cfg).ruleFiles, files, p);
  assert.equal(rulesFor('src/View.tsx', cfg).language, 'typescript');
  assert.equal(rulesFor('tool.py', cfg).language, null);
});

test('skip globs', () => {
  for (const p of ['package-lock.json', 'web/package-lock.json', 'dist/app.js', 'packages/ui/dist/a.js', 'x.min.js', 'Forms/Form1.Designer.cs', 'go.sum', 'api/x.pb.go']) {
    assert.ok(rulesFor(p, cfg).skipped, p);
  }
  for (const p of ['src/dist.ts', 'src/build.go', 'min.js']) assert.equal(rulesFor(p, cfg).skipped, undefined, p);
});

test('matchGlob basics', () => {
  assert.ok(matchGlob('*.min.js', 'a/b/c.min.js'));
  assert.ok(matchGlob('dist/**', 'dist/a/b.js'));
  assert.ok(!matchGlob('dist/**', 'src/distance.js'));
});
