import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fakeAuth } from '../../lib/auth.mjs';
import { fetchMr, parseGitDiff } from '../../lib/merge-request.mjs';
import { loadLanguages } from '../../lib/rules.mjs';
import { parseMrUrl } from '../../lib/url.mjs';
import { GITLAB_BASE, GITLAB_REF, githubResponses, gitlabResponses } from './helpers.mjs';

const cfg = loadLanguages();
const ghRef = parseMrUrl('https://github.com/acme/shop/pull/7');

test('github: normalizes files, languages, skipped reasons and SHAs', async () => {
  for (const kind of ['cli', 'token', 'anonymous']) {
    const mr = await fetchMr(ghRef, fakeAuth(ghRef, githubResponses(), kind), cfg);
    assert.equal(mr.headSha, 'head222', kind);
    assert.equal(mr.baseSha, 'base111');
    const byPath = Object.fromEntries(mr.files.map((f) => [f.path, f]));
    assert.deepEqual(byPath['src/price.ts'].ruleFiles, ['general.md', 'typescript.md']);
    assert.deepEqual(byPath['src/price.ts'].validLines, [1, 2, 3, 4, 5, 20, 21, 22, 23]);
    assert.deepEqual(byPath['src/View.tsx'].ruleFiles, ['general.md', 'typescript.md', 'react.md']);
    assert.equal(byPath['package-lock.json'].skipped.reason, 'generated-or-lockfile');
    assert.equal(byPath['src/old.ts'].skipped.reason, 'deleted');
    assert.match(byPath['logo.png'].skipped.reason, /no-patch/);
  }
});

test('github: follows pagination', async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => ({ filename: `src/f${i}.go`, status: 'added', patch: '@@ -0,0 +1 @@\n+package x' }));
  const page2 = Array.from({ length: 200 }, (_, i) => ({ filename: `src/g${i}.go`, status: 'modified' }));
  const responses = {
    ...githubResponses(),
    'GET /repos/acme/shop/pulls/7/files?per_page=100&page=1': { body: page1 },
    'GET /repos/acme/shop/pulls/7/files?per_page=100&page=2': { body: page2.slice(0, 100) },
    'GET /repos/acme/shop/pulls/7/files?per_page=100&page=3': { body: page2.slice(100) },
    'GET /repos/acme/shop/pulls/7/files?per_page=100&page=4': { body: [] },
  };
  const mr = await fetchMr(ghRef, fakeAuth(ghRef, responses), cfg);
  assert.equal(mr.files.length, 300);
  assert.equal(mr.files.filter((f) => f.skipped?.reason.startsWith('no-patch')).length, 200);
});

test('gitlab: diff_refs, renames, generated and deleted files', async () => {
  const mr = await fetchMr(GITLAB_REF, fakeAuth(GITLAB_REF, gitlabResponses()), cfg);
  assert.equal(mr.baseSha, 'glbase');
  assert.equal(mr.startSha, 'glstart');
  assert.equal(mr.headSha, 'glhead');
  const byPath = Object.fromEntries(mr.files.map((f) => [f.path, f]));
  assert.equal(byPath['src/b.go'].oldPath, 'src/a.go');
  assert.equal(byPath['src/b.go'].changeType, 'renamed');
  assert.deepEqual(byPath['src/b.go'].ruleFiles, ['general.md', 'go.md']);
  assert.equal(byPath['gen/x.pb.go'].skipped.reason, 'generated-or-lockfile');
  assert.equal(byPath['gone.java'].skipped.reason, 'deleted');
});

test('gitlab: falls back to /changes when /diffs is missing', async () => {
  const responses = gitlabResponses();
  const diffs = responses[`GET ${GITLAB_BASE}/diffs?per_page=100&page=1`].body;
  delete responses[`GET ${GITLAB_BASE}/diffs?per_page=100&page=1`];
  responses[`GET ${GITLAB_BASE}/changes`] = { body: { changes: diffs } };
  const mr = await fetchMr(GITLAB_REF, fakeAuth(GITLAB_REF, responses), cfg);
  assert.equal(mr.files.length, 4);
});

test('anonymous 404 explains how to log in', async () => {
  await assert.rejects(fetchMr(ghRef, fakeAuth(ghRef, {}, 'anonymous'), cfg), (e) => e.exitCode === 3 && /gh auth login/.test(e.message));
});

test('local git diff parsing', () => {
  const files = parseGitDiff(
    [
      'diff --git a/src/A.cs b/src/A.cs',
      'index 1..2 100644',
      '--- a/src/A.cs',
      '+++ b/src/A.cs',
      '@@ -1 +1,2 @@',
      ' class A {}',
      '+class B {}',
      'diff --git a/old.go b/new.go',
      'similarity index 90%',
      'rename from old.go',
      'rename to new.go',
      'diff --git a/x.png b/x.png',
      'new file mode 100644',
      'Binary files /dev/null and b/x.png differ',
    ].join('\n'),
  );
  assert.deepEqual(files.map((f) => [f.path, f.changeType, f.oldPath]), [
    ['src/A.cs', 'modified', undefined],
    ['new.go', 'renamed', 'old.go'],
    ['x.png', 'added', undefined],
  ]);
  assert.equal(files[0].patch, '@@ -1 +1,2 @@\n class A {}\n+class B {}');
  assert.equal(files[2].patch, null);
});
