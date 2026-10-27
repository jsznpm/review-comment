import fs from 'node:fs';
import { parsePatch } from './diff.mjs';
import { rulesFor } from './languages.mjs';
import * as github from './platform-github.mjs';
import * as gitlab from './platform-gitlab.mjs';

export const LOCAL_SHA = '0000000000000000000000000000000000000000';

// Turns raw platform files into reviewable ChangedFiles (data-model.md).
export function buildMr(raw, cfg) {
  const files = raw.files.map((f) => {
    const base = { path: f.path, oldPath: f.oldPath ?? undefined, changeType: f.changeType, patch: f.patch ?? null };
    if (f.changeType === 'deleted') return { ...base, language: null, ruleFiles: [], skipped: { reason: 'deleted' } };
    const r = rulesFor(f.path, cfg);
    if (r.skipped) return { ...base, language: null, ruleFiles: [], skipped: r.skipped };
    if (!f.patch) return { ...base, language: r.language, ruleFiles: r.ruleFiles, skipped: { reason: 'no-patch (binary or too large)' } };
    const { validLines, hunks, oldLineOf } = parsePatch(f.patch);
    if (validLines.length === 0) {
      return { ...base, language: r.language, ruleFiles: r.ruleFiles, skipped: { reason: 'no added lines' } };
    }
    return { ...base, language: r.language, ruleFiles: r.ruleFiles, validLines, hunks, oldLineOf };
  });
  return { ...raw, files };
}

const DIFF_GIT = /^diff --git a\/(.+?) b\/(.+)$/;

// Splits a `git diff` / `.diff` file into per-file patches (test-only local mode).
export function parseGitDiff(text) {
  const files = [];
  let cur = null;
  let inHunks = false;
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = DIFF_GIT.exec(raw);
    if (m) {
      cur = { path: m[2], oldPath: m[1] !== m[2] ? m[1] : undefined, changeType: m[1] !== m[2] ? 'renamed' : 'modified', patchLines: [] };
      files.push(cur);
      inHunks = false;
      continue;
    }
    if (!cur) continue;
    if (!inHunks) {
      if (raw.startsWith('new file mode')) cur.changeType = 'added';
      else if (raw.startsWith('deleted file mode')) cur.changeType = 'deleted';
      else if (raw.startsWith('rename from ')) {
        cur.oldPath = raw.slice(12);
        cur.changeType = 'renamed';
      } else if (raw.startsWith('rename to ')) cur.path = raw.slice(10);
      else if (raw.startsWith('+++ ') && raw !== '+++ /dev/null') cur.path = raw.slice(4).replace(/^b\//, '');
      else if (raw.startsWith('@@')) inHunks = true;
    }
    if (inHunks) cur.patchLines.push(raw);
  }
  return files.map(({ patchLines, ...f }) => ({ ...f, patch: patchLines.length ? patchLines.join('\n') : null }));
}

export function loadLocalDiff(filePath) {
  const files = parseGitDiff(fs.readFileSync(filePath, 'utf8'));
  return {
    platform: 'github',
    host: 'github.com',
    origin: 'https://github.com',
    project: 'local/fixture',
    number: 0,
    url: `file:${filePath.replace(/\\/g, '/')}`,
    title: `Local diff ${filePath.replace(/\\/g, '/').split('/').slice(-2).join('/')}`,
    baseSha: LOCAL_SHA,
    startSha: null,
    headSha: LOCAL_SHA,
    files,
  };
}

export async function fetchMr(ref, auth, cfg) {
  const raw = ref.platform === 'github' ? await github.fetchMr(auth, ref) : await gitlab.fetchMr(auth, ref);
  return buildMr(raw, cfg);
}
