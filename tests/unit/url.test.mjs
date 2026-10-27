import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMrUrl } from '../../lib/url.mjs';

test('github.com pull request', () => {
  assert.deepEqual(parseMrUrl('https://github.com/acme/shop/pull/42'), {
    platform: 'github',
    host: 'github.com',
    origin: 'https://github.com',
    project: 'acme/shop',
    number: 42,
    url: 'https://github.com/acme/shop/pull/42',
  });
});

test('github URL with /files, query string and trailing slash', () => {
  assert.equal(parseMrUrl('https://github.com/acme/shop/pull/42/files?w=1').number, 42);
  assert.equal(parseMrUrl('https://github.com/acme/shop/pull/42/').url, 'https://github.com/acme/shop/pull/42');
});

test('gitlab.com merge request', () => {
  const r = parseMrUrl('https://gitlab.com/group/project/-/merge_requests/5');
  assert.equal(r.platform, 'gitlab');
  assert.equal(r.host, 'gitlab.com');
  assert.equal(r.project, 'group/project');
  assert.equal(r.number, 5);
});

test('self-hosted gitlab with nested groups and /diffs', () => {
  const r = parseMrUrl('https://git.example.com/a/b/c/-/merge_requests/7/diffs?commit_id=x');
  assert.equal(r.host, 'git.example.com');
  assert.equal(r.origin, 'https://git.example.com');
  assert.equal(r.project, 'a/b/c');
  assert.equal(r.url, 'https://git.example.com/a/b/c/-/merge_requests/7');
});

test('unsupported URLs throw with exit code 1', () => {
  for (const u of [
    'https://example.com/foo',
    'not a url',
    'https://github.com/acme/shop/issues/1',
    'https://gitlab.com/project/-/merge_requests/1',
    'ftp://github.com/a/b/pull/1',
  ]) {
    assert.throws(() => parseMrUrl(u), (e) => e.exitCode === 1 && /unsupported merge request URL/.test(e.message), u);
  }
});
