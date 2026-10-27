import { loginHint } from './auth.mjs';
import { findBlock, normalizeCode } from './diff.mjs';
import { CliError, EXIT } from './errors.mjs';
import { checkAnchor, summarize } from './findings.mjs';
import { fetchMr } from './merge-request.mjs';
import * as github from './platform-github.mjs';
import * as gitlab from './platform-gitlab.mjs';
import { commentBody } from './render.mjs';

const MARKER = /<!-- review-comment:v1 rule=(\S+) file=(\S+) key=([0-9a-f]+) -->/g;

export function marker(f) {
  return `<!-- review-comment:v1 rule=${f.ruleId} file=${encodeURIComponent(f.path)} key=${f.key} -->`;
}

export function existingKeys(bodies) {
  const keys = new Set();
  for (const body of bodies) for (const m of String(body).matchAll(MARKER)) keys.add(m[3]);
  return keys;
}

// After a new push: keep the anchor if the code is unchanged, move it if the same code
// appears exactly once in the new diff, otherwise mark it unmapped. Never guess a line.
export function reanchor(f, file) {
  if (!file || file.skipped) return { status: 'unmapped', error: 'file is no longer reviewable in the merge request' };
  const start = f.startLine ?? f.line;
  const count = f.line - start + 1;
  const a = checkAnchor(file, start, f.line);
  if (a.ok && normalizeCode(a.code) === normalizeCode(f.anchorCode)) return {};
  const starts = findBlock(file.patch, f.anchorCode ?? '', count);
  if (starts.length === 1) return { startLine: count > 1 ? starts[0] : undefined, line: starts[0] + count - 1 };
  return {
    status: 'unmapped',
    error: starts.length ? 'the commented code now appears more than once in the diff' : 'the commented code changed since the review',
  };
}

function brief(f) {
  return { path: f.path, startLine: f.startLine, line: f.line, severity: f.severity, ruleId: f.ruleId, title: f.title, error: f.error };
}

export async function planAndPost({ ref, auth, report, cfg, dryRun = false }) {
  const platform = ref.platform === 'github' ? github : gitlab;
  const fresh = await fetchMr(ref, auth, cfg);
  const headChanged = fresh.headSha !== report.mergeRequest.headSha;
  const files = new Map(fresh.files.map((f) => [f.path, f]));
  const findings = report.findings.map((f) => ({ ...f }));

  if (headChanged) {
    for (const f of findings) {
      if (f.general || !['pending', 'failed'].includes(f.status)) continue;
      const r = reanchor(f, files.get(f.path));
      if ('line' in r) {
        f.line = r.line;
        if (r.startLine) f.startLine = r.startLine;
        else delete f.startLine;
      }
      if (r.status) {
        f.status = r.status;
        f.error = r.error;
      }
    }
  }

  const keys = existingKeys(await platform.listExistingBodies(auth, ref));
  const toPost = [];
  const duplicates = [];
  for (const f of findings) {
    if (f.general || !['pending', 'failed'].includes(f.status)) continue;
    if (keys.has(f.key)) {
      f.status = 'skipped-duplicate';
      delete f.error;
      duplicates.push(f);
    } else {
      toPost.push(f);
    }
  }
  const unmapped = findings.filter((f) => f.status === 'unmapped');
  const general = findings.filter((f) => f.general);

  if (dryRun) {
    return {
      plan: {
        headChanged,
        headSha: fresh.headSha,
        toPost: toPost.map(brief),
        duplicates: duplicates.map(brief),
        unmapped: unmapped.map(brief),
        generalNotes: general.map(brief),
      },
    };
  }
  if (toPost.length && !auth.canWrite) {
    throw new CliError(`posting comments needs credentials; ${loginHint(ref)}`, EXIT.AUTH);
  }

  let fatal = null;
  if (toPost.length) {
    for (const f of toPost) f.postBody = `${commentBody(f, ref.platform)}\n\n${marker(f)}`;
    let results;
    try {
      results = await platform.postFindings(
        auth,
        ref,
        fresh,
        toPost,
        `Automated review by review-comment: ${toPost.length} inline comment(s).`,
      );
    } catch (e) {
      if (!(e instanceof CliError)) throw e;
      results = new Map();
      results.fatal = e;
    }
    fatal = results.fatal ?? null;
    for (const f of toPost) {
      const r = results.get(f);
      if (r?.ok) {
        f.status = 'posted';
        delete f.error;
      } else {
        f.status = 'failed';
        f.error = r?.error ?? fatal?.message ?? 'not posted';
      }
      delete f.postBody;
    }
  }

  const summary = summarize(fresh, findings);
  const out = {
    ...report,
    mode: 'post',
    mergeRequest: { ...report.mergeRequest, baseSha: fresh.baseSha, startSha: fresh.startSha, headSha: fresh.headSha },
    summary,
    findings,
  };
  const b = summary.byStatus;
  return {
    report: out,
    fatal,
    counts: {
      posted: b.posted ?? 0,
      failed: b.failed ?? 0,
      duplicates: b['skipped-duplicate'] ?? 0,
      unmapped: b.unmapped ?? 0,
      generalNotes: general.length,
    },
  };
}
