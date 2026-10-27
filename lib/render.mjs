import path from 'node:path';
import { SEVERITIES } from './rules.mjs';

const FENCE_LANG = {
  '.cs': 'csharp',
  '.go': 'go',
  '.java': 'java',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
};

export function langOf(filePath) {
  return FENCE_LANG[path.posix.extname(String(filePath ?? '')).toLowerCase()] ?? '';
}

// A fence one backtick longer than any backtick run inside the content.
export function fenceFor(content, min = 3) {
  const runs = String(content).match(/`+/g) ?? [];
  const longest = runs.reduce((n, r) => Math.max(n, r.length), 0);
  return '`'.repeat(Math.max(min, longest + 1));
}

export function suggestionBlock(f, platform) {
  if (f.suggestion === undefined || f.suggestion === null) return '';
  const content = f.suggestion.replace(/\r?\n$/, '');
  const fence = fenceFor(content);
  if (f.dropIn === false || f.general || f.status === 'unmapped') {
    return `${fence}${langOf(f.path)}\n${content}\n${fence}`;
  }
  if (platform === 'gitlab') {
    const above = f.startLine ? f.line - f.startLine : 0;
    return `${fence}suggestion:-${above}+0\n${content}\n${fence}`;
  }
  return `${fence}suggestion\n${content}\n${fence}`;
}

export function commentBody(f, platform) {
  const parts = [`**[${f.severity}] ${f.ruleId} — ${f.title}**`, f.body.trim()];
  const block = suggestionBlock(f, platform);
  if (block) parts.push(block);
  return parts.join('\n\n');
}

function lineLabel(f) {
  return f.startLine ? `lines ${f.startLine}–${f.line}` : `line ${f.line}`;
}

function wherePaste(f, platform) {
  if (platform === 'gitlab') {
    const range = f.startLine ? ` (the suggestion replaces lines ${f.startLine}–${f.line})` : '';
    return `GitLab — in **Changes**, comment on line ${f.line} of the new version${range}.`;
  }
  return f.startLine
    ? `GitHub — in **Files changed**, click line ${f.startLine}, shift-click line ${f.line}, then click **+**.`
    : `GitHub — in **Files changed**, hover line ${f.line} and click **+**.`;
}

function platformLabel(mr) {
  return mr.platform === 'github' ? 'GitHub' : `GitLab (${mr.host})`;
}

function statusNote(f) {
  if (f.status === 'failed') return `> **Not posted** — ${f.error ?? 'posting failed'}`;
  if (f.status === 'unmapped') return `> **Not anchored** — ${f.error ?? 'line is not part of the current diff'}`;
  return '';
}

function renderFinding(f, n, platform, anchored) {
  const out = [];
  const where = anchored ? ` · ${lineLabel(f)}` : f.line ? ` · ${lineLabel(f)} (not in diff)` : '';
  out.push(`#### ${n}. [${f.severity}] ${f.ruleId} — ${f.title}${where}`, '');
  const note = statusNote(f);
  if (note) out.push(note, '');
  if (anchored) out.push(`**Where to paste**: ${wherePaste(f, platform)}`, '');
  else if (f.path) out.push(`**File**: \`${f.path}\` — add as a general merge request comment.`, '');
  const body = commentBody(f, platform);
  const outer = fenceFor(body, 4);
  out.push('**Comment** (copy everything inside the box):', '', `${outer}markdown`, body, outer, '', '---', '');
  return out;
}

export function shownFindings(report) {
  if (report.mode !== 'post') return report.findings;
  return report.findings.filter((f) => ['failed', 'unmapped', 'pending'].includes(f.status));
}

export function renderReview(report) {
  const mr = report.mergeRequest;
  const platform = mr.platform;
  const s = report.summary;
  const shown = shownFindings(report);
  const anchored = shown.filter((f) => !f.general && f.status !== 'unmapped');
  const notes = shown.filter((f) => f.general || f.status === 'unmapped');

  const out = [
    `# Code Review — ${mr.title || mr.url}`,
    '',
    '| | |',
    '|-|-|',
    `| Merge request | ${mr.url} |`,
    `| Platform | ${platformLabel(mr)} |`,
    `| Reviewed commit | \`${mr.headSha ?? 'unknown'}\` |`,
    `| Reviewed at | ${report.reviewedAt} |`,
    `| Mode | ${report.mode === 'post' ? 'post (unposted findings)' : 'file'} |`,
    '',
    '## Summary',
    '',
    `- Files reviewed: ${s.filesReviewed} · skipped: ${s.filesSkipped.length}`,
    `- Findings: ${SEVERITIES.map((k) => `${k} ${s.bySeverity[k] ?? 0}`).join(' · ')}`,
  ];
  if (report.mode === 'post') {
    const b = s.byStatus ?? {};
    out.push(
      `- Posted: ${b.posted ?? 0} · already posted: ${b['skipped-duplicate'] ?? 0} · failed: ${b.failed ?? 0} · not anchored: ${b.unmapped ?? 0} · not posted: ${b.pending ?? 0}`,
    );
  }
  out.push('');
  if (s.filesSkipped.length) {
    out.push('<details><summary>Skipped files</summary>', '');
    for (const f of s.filesSkipped) out.push(`- \`${f.path}\` — ${f.reason}`);
    out.push('', '</details>', '');
  }

  out.push('## Findings', '');
  if (anchored.length === 0) {
    out.push(report.mode === 'post' && report.findings.length ? 'All anchored findings were posted.' : 'No findings.', '');
    if (report.findings.length === 0 && s.reviewedFiles?.length) {
      out.push('Reviewed files:', '', ...s.reviewedFiles.map((p) => `- \`${p}\``), '');
    }
  }
  let n = 0;
  let currentPath = null;
  for (const f of anchored) {
    if (f.path !== currentPath) {
      currentPath = f.path;
      out.push(`### \`${f.path}\``, '');
    }
    out.push(...renderFinding(f, ++n, platform, true));
  }

  if (notes.length) {
    out.push('## Not anchored / general notes', '', 'Findings that could not be mapped to a diff line or are not line-specific.', '');
    for (const f of notes) out.push(...renderFinding(f, ++n, platform, false));
  }
  return `${out.join('\n').trimEnd()}\n`;
}
