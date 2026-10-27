import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { finding, githubResponses } from './helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(here, '..', '..', 'bin', 'mr.mjs');
const URL = 'https://github.com/acme/shop/pull/7';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'review comment-'));
}

function cli(args, { env = {}, cwd } = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    cwd,
    env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '', GITLAB_TOKEN: '', PATH: '', ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}

function recording(dir, responses, kind = 'token') {
  const p = path.join(dir, 'rec.json');
  fs.writeFileSync(p, JSON.stringify({ kind, responses }));
  return p;
}

test('parse-url ok and bad URL exits 1', () => {
  assert.equal(cli(['parse-url', URL]).json().project, 'acme/shop');
  const bad = cli(['parse-url', 'https://example.com/foo']);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /unsupported merge request URL/);
});

test('fetch → validate → render (paths with spaces)', () => {
  const dir = tmp();
  const env = { REVIEW_COMMENT_RECORDING: recording(dir, githubResponses()) };
  const mrPath = path.join(dir, '.review-comment', 'mr.json');
  const f = cli(['fetch', URL, '--out', mrPath], { env });
  assert.equal(f.code, 0, f.err);
  const summary = f.json();
  assert.equal(summary.headSha, 'head222');
  assert.equal(summary.skipped, 3);
  assert.deepEqual(summary.reviewable[0], { path: 'src/price.ts', ruleFiles: ['general.md', 'typescript.md'], lines: '1-5, 20-23' });

  const lines = cli(['lines', mrPath, 'src/price.ts']).json();
  assert.equal(lines['src/price.ts'].ranges, '1-5, 20-23');

  const findingsPath = path.join(dir, 'findings.json');
  fs.writeFileSync(findingsPath, JSON.stringify([finding(), finding({ line: 99 })]));
  const reviewPath = path.join(dir, '.review-comment', 'review.json');
  const v = cli(['validate', mrPath, findingsPath, '--out', reviewPath]);
  assert.equal(v.code, 0, v.err);
  assert.equal(v.json().pending, 1);
  assert.equal(v.json().unmapped.length, 1);

  const mdPath = path.join(dir, 'review.md');
  const r = cli(['render', reviewPath, '--out', mdPath]);
  assert.equal(r.code, 0, r.err);
  assert.match(fs.readFileSync(mdPath, 'utf8'), /GEN-006 — Magic number · line 3/);
});

test('validate with structural errors exits 1 and writes nothing', () => {
  const dir = tmp();
  const env = { REVIEW_COMMENT_RECORDING: recording(dir, githubResponses()) };
  const mrPath = path.join(dir, 'mr.json');
  cli(['fetch', URL, '--out', mrPath], { env });
  const findingsPath = path.join(dir, 'findings.json');
  fs.writeFileSync(findingsPath, JSON.stringify([finding({ ruleId: 'NOPE-001' })]));
  const out = path.join(dir, 'review.json');
  const v = cli(['validate', mrPath, findingsPath, '--out', out]);
  assert.equal(v.code, 1);
  assert.match(v.json().invalid[0].error, /unknown ruleId/);
  assert.ok(!fs.existsSync(out));
});

test('fetch: not found exits 3, rate limit exits 2', () => {
  const dir = tmp();
  const nf = cli(['fetch', 'https://github.com/acme/shop/pull/8', '--out', path.join(dir, 'x.json')], {
    env: { REVIEW_COMMENT_RECORDING: recording(dir, {}) },
  });
  assert.equal(nf.code, 3);
  const rl = cli(['fetch', URL, '--out', path.join(dir, 'x.json')], {
    env: { REVIEW_COMMENT_RECORDING: recording(dir, { 'GET /repos/acme/shop/pulls/7': { status: 403, body: { message: 'API rate limit exceeded' } } }, 'anonymous') },
  });
  assert.equal(rl.code, 2);
  assert.match(rl.err, /rate limit.*GITHUB_TOKEN/);
  assert.ok(!fs.existsSync(path.join(dir, 'x.json')));
});

test('local diff mode only with REVIEW_COMMENT_LOCAL_DIFF=1', () => {
  const dir = tmp();
  const diff = path.join(dir, 'change.diff');
  fs.writeFileSync(diff, 'diff --git a/a.go b/a.go\n--- a/a.go\n+++ b/a.go\n@@ -1 +1,2 @@\n package a\n+func A() {}\n');
  assert.equal(cli(['fetch', diff, '--out', path.join(dir, 'mr.json')]).code, 1);
  const ok = cli(['fetch', diff, '--out', path.join(dir, 'mr.json')], { env: { REVIEW_COMMENT_LOCAL_DIFF: '1' } });
  assert.equal(ok.code, 0, ok.err);
  assert.equal(ok.json().reviewable[0].path, 'a.go');
});

test('unknown command exits 1 with usage', () => {
  const r = cli(['nope']);
  assert.equal(r.code, 1);
  assert.match(r.out, /usage: mr.mjs/);
});
