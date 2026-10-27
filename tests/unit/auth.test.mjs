import assert from 'node:assert/strict';
import { test } from 'node:test';
import { httpAuth, redact, resolveAuth } from '../../lib/auth.mjs';
import { parseMrUrl } from '../../lib/url.mjs';

const gh = parseMrUrl('https://github.com/acme/shop/pull/7');
const gl = parseMrUrl('https://git.example.com/a/b/-/merge_requests/1');
const SECRET = 'ghp_supersecrettoken123';

function fakeFetch(status, body, headers = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return { ok: status < 300, status, headers: new Map(Object.entries(headers)), text: async () => JSON.stringify(body) };
  };
  fn.calls = calls;
  return fn;
}

test('auth order: CLI token → env token → anonymous', async () => {
  const exec = async () => ({ ok: true, stdout: 'cli-token\n' });
  assert.equal((await resolveAuth(gh, { env: { GITHUB_TOKEN: 'x' }, exec })).kind, 'cli');
  const noCli = async () => ({ ok: false, stdout: '' });
  assert.equal((await resolveAuth(gh, { env: { GITHUB_TOKEN: 'x' }, exec: noCli })).kind, 'token');
  assert.equal((await resolveAuth(gl, { env: { GITLAB_TOKEN: 'x' }, exec: noCli })).kind, 'token');
  const anon = await resolveAuth(gh, { env: {}, exec: noCli });
  assert.equal(anon.kind, 'anonymous');
  assert.equal(anon.canWrite, false);
});

test('CLI commands used per platform', async () => {
  const seen = [];
  const exec = async (cmd, args) => (seen.push([cmd, ...args].join(' ')), { ok: false, stdout: '' });
  await resolveAuth(gh, { env: {}, exec });
  await resolveAuth(gl, { env: {}, exec });
  assert.deepEqual(seen, ['gh auth token --hostname github.com', 'glab config get token --host git.example.com']);
});

test('requests go only to the platform API host with a bearer token', async () => {
  const f = fakeFetch(200, { ok: 1 });
  await httpAuth(gh, { kind: 'token', token: SECRET, fetchImpl: f }).request('GET', '/repos/acme/shop/pulls/7');
  await httpAuth(gl, { kind: 'token', token: SECRET, fetchImpl: f }).request('GET', '/projects/x');
  assert.equal(f.calls[0].url, 'https://api.github.com/repos/acme/shop/pulls/7');
  assert.equal(f.calls[1].url, 'https://git.example.com/api/v4/projects/x');
  assert.equal(f.calls[0].init.headers.Authorization, `Bearer ${SECRET}`);
  const anon = fakeFetch(200, {});
  await httpAuth(gh, { kind: 'anonymous', token: null, fetchImpl: anon }).request('GET', '/x');
  assert.equal(anon.calls[0].init.headers.Authorization, undefined);
});

test('error messages never contain the token', async () => {
  for (const [status, body] of [
    [401, { message: `bad credentials for ${SECRET}` }],
    [422, { message: `invalid ${SECRET}`, errors: [SECRET] }],
    [500, {}],
  ]) {
    const auth = httpAuth(gh, { kind: 'token', token: SECRET, fetchImpl: fakeFetch(status, body) });
    await assert.rejects(auth.request('GET', '/x'), (e) => !e.message.includes(SECRET));
  }
  const boom = async () => { throw new Error(`connect failed ${SECRET}`); };
  await assert.rejects(httpAuth(gh, { kind: 'token', token: SECRET, fetchImpl: boom }).request('GET', '/x'), (e) => e.exitCode === 3 && !e.message.includes(SECRET));
  assert.equal(redact(`a ${SECRET} b`, SECRET), 'a *** b');
});

test('status → exit code mapping', async () => {
  const code = async (status, body = {}, headers) => {
    try {
      await httpAuth(gh, { kind: 'anonymous', token: null, fetchImpl: fakeFetch(status, body, headers) }).request('GET', '/x');
    } catch (e) {
      return [e.exitCode, e.status];
    }
  };
  assert.deepEqual(await code(401), [2, 401]);
  assert.deepEqual(await code(403, {}, { 'x-ratelimit-remaining': '0' }), [2, 403]);
  assert.deepEqual(await code(404), [3, 404]);
  assert.deepEqual(await code(422), [1, 422]);
  assert.deepEqual(await code(502), [3, 502]);
});
