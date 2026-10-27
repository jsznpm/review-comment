import { getAll } from './auth.mjs';

const CHANGE_TYPE = {
  added: 'added',
  removed: 'deleted',
  modified: 'modified',
  changed: 'modified',
  renamed: 'renamed',
  copied: 'added',
  unchanged: 'modified',
};

export async function fetchMr(auth, ref) {
  const base = `/repos/${ref.project}/pulls/${ref.number}`;
  const pr = await auth.request('GET', base);
  const files = await getAll(auth, `${base}/files`);
  return {
    platform: 'github',
    host: ref.host,
    origin: ref.origin,
    project: ref.project,
    number: ref.number,
    url: ref.url,
    title: pr.title ?? '',
    baseSha: pr.base?.sha ?? null,
    startSha: null,
    headSha: pr.head?.sha ?? null,
    files: files.map((f) => ({
      path: f.filename,
      oldPath: f.previous_filename ?? undefined,
      changeType: CHANGE_TYPE[f.status] ?? 'modified',
      patch: f.patch ?? null,
    })),
  };
}

export async function fetchHeadSha(auth, ref) {
  const pr = await auth.request('GET', `/repos/${ref.project}/pulls/${ref.number}`);
  return pr.head?.sha ?? null;
}

export async function listExistingBodies(auth, ref) {
  const comments = await getAll(auth, `/repos/${ref.project}/pulls/${ref.number}/comments`);
  return comments.map((c) => c.body ?? '');
}

function toComment(f) {
  const c = { path: f.path, line: f.line, side: 'RIGHT', body: f.postBody };
  if (f.startLine) {
    c.start_line = f.startLine;
    c.start_side = 'RIGHT';
  }
  return c;
}

// One review with all comments; on 422 fall back to single comments to isolate failures.
export async function postFindings(auth, ref, mr, findings, summaryBody) {
  const base = `/repos/${ref.project}/pulls/${ref.number}`;
  const results = new Map();
  try {
    await auth.request('POST', `${base}/reviews`, {
      commit_id: mr.headSha,
      event: 'COMMENT',
      body: summaryBody,
      comments: findings.map(toComment),
    });
    for (const f of findings) results.set(f, { ok: true });
    return results;
  } catch (e) {
    if (e.status !== 422) throw e;
  }
  for (const f of findings) {
    try {
      await auth.request('POST', `${base}/comments`, { commit_id: mr.headSha, ...toComment(f) });
      results.set(f, { ok: true });
    } catch (e) {
      if (e.exitCode === 2) {
        results.fatal = e;
        break;
      }
      results.set(f, { ok: false, error: e.message });
    }
  }
  return results;
}
