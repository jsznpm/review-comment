import { getAll } from './auth.mjs';

function projectPath(ref) {
  return `/projects/${encodeURIComponent(ref.project)}/merge_requests/${ref.number}`;
}

function changeType(d) {
  if (d.deleted_file) return 'deleted';
  if (d.new_file) return 'added';
  if (d.renamed_file) return 'renamed';
  return 'modified';
}

export async function fetchMr(auth, ref) {
  const base = projectPath(ref);
  const mr = await auth.request('GET', base);
  let diffs;
  try {
    diffs = await getAll(auth, `${base}/diffs`);
  } catch (e) {
    if (e.status !== 404) throw e;
    // GitLab < 15.7 has no /diffs endpoint.
    diffs = (await auth.request('GET', `${base}/changes`)).changes ?? [];
  }
  const refs = mr.diff_refs ?? {};
  return {
    platform: 'gitlab',
    host: ref.host,
    origin: ref.origin,
    project: ref.project,
    number: ref.number,
    url: ref.url,
    title: mr.title ?? '',
    baseSha: refs.base_sha ?? null,
    startSha: refs.start_sha ?? null,
    headSha: refs.head_sha ?? mr.sha ?? null,
    files: diffs.map((d) => ({
      path: d.new_path,
      oldPath: d.old_path !== d.new_path ? d.old_path : undefined,
      changeType: changeType(d),
      patch: d.too_large || !d.diff ? null : d.diff,
    })),
  };
}

export async function fetchHeadSha(auth, ref) {
  const mr = await auth.request('GET', projectPath(ref));
  return mr.diff_refs?.head_sha ?? mr.sha ?? null;
}

export async function listExistingBodies(auth, ref) {
  const discussions = await getAll(auth, `${projectPath(ref)}/discussions`);
  return discussions.flatMap((d) => (d.notes ?? []).map((n) => n.body ?? ''));
}

export function positionFor(mr, file, f) {
  const position = {
    position_type: 'text',
    base_sha: mr.baseSha,
    start_sha: mr.startSha,
    head_sha: mr.headSha,
    old_path: file.oldPath ?? file.path,
    new_path: file.path,
    new_line: f.line,
  };
  // Context (unchanged) lines need both sides or GitLab rejects the position.
  const old = file.oldLineOf?.[f.line];
  if (old !== undefined) position.old_line = old;
  return position;
}

export async function postFindings(auth, ref, mr, findings) {
  const base = projectPath(ref);
  const files = new Map(mr.files.map((f) => [f.path, f]));
  const results = new Map();
  for (const f of findings) {
    try {
      await auth.request('POST', `${base}/discussions`, {
        body: f.postBody,
        position: positionFor(mr, files.get(f.path), f),
      });
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
