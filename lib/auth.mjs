import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { EXIT, HttpError } from './errors.mjs';

const PER_PAGE = 100;
const MAX_PAGES = 50;

function runCli(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      resolve(err ? { ok: false, stdout: '' } : { ok: true, stdout: String(stdout) });
    });
  });
}

export function loginHint(ref) {
  return ref.platform === 'github'
    ? 'run `gh auth login` or set GITHUB_TOKEN'
    : `run \`glab auth login --hostname ${ref.host}\` or set GITLAB_TOKEN`;
}

export function redact(text, token) {
  const s = String(text ?? '');
  return token ? s.split(token).join('***') : s;
}

function errorFor(status, data, headers, ctx) {
  const serverMsg =
    (data && typeof data === 'object' && (data.message || data.error || data.error_description)) ||
    (typeof data === 'string' ? data.slice(0, 200) : '');
  const detail = Array.isArray(data?.errors) ? ` (${JSON.stringify(data.errors).slice(0, 300)})` : '';
  const where = `${ctx.method} ${ctx.path}`;
  const rateLimited =
    status === 429 ||
    (status === 403 &&
      (headers?.get?.('x-ratelimit-remaining') === '0' || /rate limit/i.test(String(serverMsg))));
  let msg;
  let code;
  if (rateLimited) {
    msg = `${ctx.host} API rate limit reached; ${loginHint(ctx.ref)}`;
    code = EXIT.AUTH;
  } else if (status === 401) {
    msg = `authentication failed for ${ctx.host}; ${loginHint(ctx.ref)}`;
    code = EXIT.AUTH;
  } else if (status === 403) {
    msg = `permission denied by ${ctx.host} for ${where}: ${serverMsg}`;
    code = EXIT.AUTH;
  } else if (status === 404) {
    msg =
      ctx.kind === 'anonymous'
        ? `not found: ${where} — the project may be private; ${loginHint(ctx.ref)}`
        : `not found: ${where}`;
    code = EXIT.NOT_FOUND;
  } else if (status >= 500) {
    msg = `${ctx.host} server error ${status} for ${where}`;
    code = EXIT.NOT_FOUND;
  } else {
    msg = `${ctx.host} rejected ${where} with ${status}: ${serverMsg}${detail}`;
    code = EXIT.INPUT;
  }
  return new HttpError(redact(msg, ctx.token), status, code);
}

function apiBase(ref) {
  return ref.platform === 'github' ? 'https://api.github.com' : `${ref.origin}/api/v4`;
}

export function httpAuth(ref, { kind, token, fetchImpl = globalThis.fetch }) {
  const base = apiBase(ref);
  async function request(method, path, body) {
    const headers = {
      'User-Agent': 'review-comment',
      Accept: ref.platform === 'github' ? 'application/vnd.github+json' : 'application/json',
    };
    if (ref.platform === 'github') headers['X-GitHub-Api-Version'] = '2022-11-28';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetchImpl(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new HttpError(
        redact(`network error calling ${ref.host}: ${e?.cause?.code ?? e?.message ?? e}`, token),
        0,
        EXIT.NOT_FOUND,
      );
    }
    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
    if (res.ok) return data;
    throw errorFor(res.status, data, res.headers, { method, path, host: ref.host, ref, kind, token });
  }
  return { kind, platform: ref.platform, canWrite: kind !== 'anonymous', request };
}

// Test double and recording replay: responses keyed by "METHOD /path?query".
export function fakeAuth(ref, responses, kind = 'token') {
  const calls = [];
  async function request(method, path, body) {
    calls.push({ method, path, body });
    const key = `${method} ${path}`;
    let entry = responses[key];
    if (Array.isArray(entry)) entry = entry.length > 1 ? entry.shift() : entry[0];
    if (!entry) throw errorFor(404, { message: 'Not Found' }, null, { method, path, host: ref.host, ref, kind });
    const status = entry.status ?? 200;
    if (status >= 200 && status < 300) return entry.body ?? null;
    throw errorFor(status, entry.body, null, { method, path, host: ref.host, ref, kind });
  }
  return { kind, platform: ref.platform, canWrite: kind !== 'anonymous', request, calls };
}

export async function resolveAuth(ref, { env = process.env, exec = runCli, fetchImpl } = {}) {
  if (env.REVIEW_COMMENT_RECORDING) {
    const rec = JSON.parse(fs.readFileSync(env.REVIEW_COMMENT_RECORDING, 'utf8'));
    return fakeAuth(ref, rec.responses ?? rec, rec.kind ?? 'token');
  }

  const cli =
    ref.platform === 'github'
      ? await exec('gh', ['auth', 'token', '--hostname', 'github.com'])
      : await exec('glab', ['config', 'get', 'token', '--host', ref.host]);
  const cliToken = cli.ok ? cli.stdout.trim() : '';
  if (cliToken) return httpAuth(ref, { kind: 'cli', token: cliToken, fetchImpl });

  const envToken =
    ref.platform === 'github' ? env.GITHUB_TOKEN || env.GH_TOKEN : env.GITLAB_TOKEN;
  if (envToken) return httpAuth(ref, { kind: 'token', token: envToken, fetchImpl });

  return httpAuth(ref, { kind: 'anonymous', token: null, fetchImpl });
}

export async function getAll(auth, path) {
  const sep = path.includes('?') ? '&' : '?';
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const items = await auth.request('GET', `${path}${sep}per_page=${PER_PAGE}&page=${page}`);
    if (!Array.isArray(items)) break;
    out.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return out;
}
