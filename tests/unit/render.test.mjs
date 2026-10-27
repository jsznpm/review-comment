import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateFindings } from '../../lib/findings.mjs';
import { buildMr } from '../../lib/merge-request.mjs';
import { commentBody, fenceFor, renderReview, suggestionBlock } from '../../lib/render.mjs';
import { loadLanguages, loadRules } from '../../lib/rules.mjs';
import { finding, RAW_GITHUB, sampleMr } from './helpers.mjs';

const rules = loadRules();
const now = new Date('2026-10-27T10:00:00Z');

function reportFor(findings, raw) {
  const mr = raw ? buildMr(structuredClone(raw), loadLanguages()) : sampleMr();
  const { invalid, report } = validateFindings(mr, findings, rules, { now });
  assert.deepEqual(invalid, []);
  return report;
}

test('header, summary and skipped files', () => {
  const md = renderReview(reportFor([finding()]));
  assert.match(md, /^# Code Review — Add discount\n/);
  assert.match(md, /\| Merge request \| https:\/\/github.com\/acme\/shop\/pull\/7 \|/);
  assert.match(md, /\| Platform \| GitHub \|/);
  assert.match(md, /\| Reviewed commit \| `head222` \|/);
  assert.match(md, /\| Reviewed at \| 2026-10-27T10:00:00.000Z \|/);
  assert.match(md, /- Files reviewed: 2 · skipped: 3/);
  assert.match(md, /- Findings: blocker 0 · major 0 · minor 0 · suggestion 1/);
  assert.match(md, /<details><summary>Skipped files<\/summary>[\s\S]*`package-lock.json` — generated-or-lockfile/);
});

test('findings grouped by file then line with 4-backtick outer fence and GitHub suggestion', () => {
  const md = renderReview(
    reportFor([
      finding({ line: 21, ruleId: 'GEN-008', severity: 'major', title: 'Swallowed error', suggestion: '  send();' }),
      finding({ path: 'src/View.tsx', line: 1, ruleId: 'REACT-001', suggestion: undefined }),
      finding({ startLine: 2, line: 3 }),
    ]),
  );
  const order = ['### `src/price.ts`', '1. [suggestion] GEN-006', '2. [major] GEN-008', '### `src/View.tsx`', '3. [suggestion] REACT-001'];
  let pos = -1;
  for (const s of order) {
    const at = md.indexOf(s);
    assert.ok(at > pos, `${s} in order`);
    pos = at;
  }
  assert.match(md, /GEN-006 — Magic number · lines 2–3/);
  assert.match(md, /click line 2, shift-click line 3/);
  assert.match(md, /````markdown\n\*\*\[suggestion\] GEN-006 — Magic number\*\*\n\n`100` and `0.9` are unexplained.\n\n```suggestion\n  if \(total > DISCOUNT_THRESHOLD\)/);
  assert.ok(!md.includes('review-comment:v1'), 'no dedupe marker in review.md');
});

test('GitLab suggestion offsets and platform label', () => {
  const raw = { ...structuredClone(RAW_GITHUB), platform: 'gitlab', host: 'gitlab.com', url: 'https://gitlab.com/a/b/-/merge_requests/1' };
  const md = renderReview(reportFor([finding({ startLine: 2, line: 4 }), finding({ line: 21, ruleId: 'GEN-008' })], raw));
  assert.match(md, /\| Platform \| GitLab \(gitlab.com\) \|/);
  assert.match(md, /```suggestion:-2\+0\n/);
  assert.match(md, /```suggestion:-0\+0\n/);
  assert.match(md, /comment on line 4 of the new version/);
});

test('non drop-in code uses a language fence', () => {
  assert.equal(suggestionBlock({ path: 'a/b.go', line: 1, suggestion: 'x := 1\n', dropIn: false }, 'github'), '```go\nx := 1\n```');
});

test('fences grow past inner backticks', () => {
  assert.equal(fenceFor('a ``` b', 4), '````');
  assert.equal(fenceFor('a ```` b', 4), '`````');
  const body = commentBody({ severity: 'minor', ruleId: 'GEN-005', title: 't', body: 'b', path: 'x.md', line: 1, suggestion: '```js\nx\n```' }, 'github');
  assert.match(body, /````suggestion\n```js\nx\n```\n````$/);
});

test('suggestion keeps blank lines and tabs', () => {
  const md = renderReview(reportFor([finding({ suggestion: '\tif (a) {\n\n\t\tb();\n\t}' })]));
  assert.ok(md.includes('```suggestion\n\tif (a) {\n\n\t\tb();\n\t}\n```'));
});

test('unmapped and general notes go to their own section', () => {
  const md = renderReview(
    reportFor([
      finding({ line: 10 }),
      { general: true, ruleId: 'GEN-011', title: 'No tests', body: 'Add a test for the discount.', path: 'src/price.ts' },
    ]),
  );
  const notes = md.slice(md.indexOf('## Not anchored / general notes'));
  assert.ok(notes.includes('GEN-006') && notes.includes('GEN-011'));
  assert.match(notes, /\*\*Not anchored\*\* — line 10 is not part of the diff/);
  assert.match(md, /## Findings\n\nNo findings\./);
});

test('empty review lists reviewed files', () => {
  const md = renderReview(reportFor([]));
  assert.match(md, /No findings\.\n\nReviewed files:\n\n- `src\/price.ts`\n- `src\/View.tsx`/);
});

test('post mode shows only failed, unmapped and pending findings', () => {
  const report = reportFor([finding(), finding({ line: 21, ruleId: 'GEN-008' }), finding({ line: 4, ruleId: 'GEN-004' })]);
  report.mode = 'post';
  const byRule = Object.fromEntries(report.findings.map((f) => [f.ruleId, f]));
  byRule['GEN-006'].status = 'posted';
  byRule['GEN-008'].status = 'failed';
  byRule['GEN-008'].error = 'line moved';
  byRule['GEN-004'].status = 'skipped-duplicate';
  report.summary.byStatus = { posted: 1, failed: 1, 'skipped-duplicate': 1 };
  const md = renderReview(report);
  assert.ok(!md.includes('GEN-006') && !md.includes('GEN-004 —'));
  assert.match(md, /\*\*Not posted\*\* — line moved/);
  assert.match(md, /- Posted: 1 · already posted: 1 · failed: 1/);
});
