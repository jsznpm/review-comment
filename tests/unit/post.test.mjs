import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fakeAuth } from '../../lib/auth.mjs';
import { validateFindings } from '../../lib/findings.mjs';
import { buildMr } from '../../lib/merge-request.mjs';
import { existingKeys, marker, planAndPost } from '../../lib/post.mjs';
import { loadLanguages, loadRules } from '../../lib/rules.mjs';
import { parseMrUrl } from '../../lib/url.mjs';
import { finding, GITLAB_BASE, GITLAB_REF, githubResponses, gitlabResponses, PRICE_PATCH, RAW_GITHUB, sampleMr } from './helpers.mjs';

const cfg = loadLanguages();
const rules = loadRules();
const ghRef = parseMrUrl('https://github.com/acme/shop/pull/7');
const REVIEWS = 'POST /repos/acme/shop/pulls/7/reviews';
const COMMENTS = 'POST /repos/acme/shop/pulls/7/comments';

function ghReport(findings) {
  const { invalid, report } = validateFindings(sampleMr(), findings, rules);
  assert.deepEqual(invalid, []);
  return report;
}

const TWO = [finding(), finding({ startLine: 20, line: 21, ruleId: 'GEN-008', severity: 'major', title: 'Swallowed error', suggestion: '  send();' })];

test('marker format and parsing', () => {
  const f = { ruleId: 'GEN-006', path: 'src/my file.ts', key: 'abcdef123456' };
  assert.equal(marker(f), '<!-- review-comment:v1 rule=GEN-006 file=src%2Fmy%20file.ts key=abcdef123456 -->');
  assert.deepEqual([...existingKeys([`hello\n\n${marker(f)}`, 'no marker'])], ['abcdef123456']);
});

test('github: dry run plans without writing', async () => {
  const auth = fakeAuth(ghRef, githubResponses());
  const r = await planAndPost({ ref: ghRef, auth, report: ghReport(TWO), cfg, dryRun: true });
  assert.equal(r.plan.toPost.length, 2);
  assert.equal(r.plan.headChanged, false);
  assert.ok(auth.calls.every((c) => c.method === 'GET'));
});

test('github: one batched review with RIGHT side, ranges and markers', async () => {
  const auth = fakeAuth(ghRef, { ...githubResponses(), [REVIEWS]: { status: 200, body: {} } });
  const r = await planAndPost({ ref: ghRef, auth, report: ghReport(TWO), cfg });
  assert.deepEqual(r.counts, { posted: 2, failed: 0, duplicates: 0, unmapped: 0, generalNotes: 0 });
  const post = auth.calls.find((c) => c.method === 'POST');
  assert.equal(post.body.event, 'COMMENT');
  assert.equal(post.body.commit_id, 'head222');
  assert.ok(post.body.body);
  const [a, b] = post.body.comments;
  assert.deepEqual({ path: a.path, line: a.line, side: a.side, start_line: a.start_line }, { path: 'src/price.ts', line: 3, side: 'RIGHT', start_line: undefined });
  assert.deepEqual({ line: b.line, start_line: b.start_line, start_side: b.start_side }, { line: 21, start_line: 20, start_side: 'RIGHT' });
  assert.match(a.body, /^\*\*\[suggestion\] GEN-006 — Magic number\*\*[\s\S]*```suggestion\n[\s\S]*<!-- review-comment:v1 rule=GEN-006 file=src%2Fprice.ts key=[0-9a-f]{12} -->$/);
  assert.ok(r.report.findings.every((f) => f.status === 'posted' && !f.postBody));
});

test('github: existing marker → skipped-duplicate, nothing posted', async () => {
  const report = ghReport(TWO);
  const comments = report.findings.map((f) => `old\n${marker(f)}`);
  const auth = fakeAuth(ghRef, githubResponses({ comments }));
  const r = await planAndPost({ ref: ghRef, auth, report, cfg });
  assert.equal(r.counts.duplicates, 2);
  assert.ok(!auth.calls.some((c) => c.method === 'POST'));
});

test('github: 422 on batch → per-comment retry isolates the failure (exit 4 path)', async () => {
  const auth = fakeAuth(ghRef, {
    ...githubResponses(),
    [REVIEWS]: { status: 422, body: { message: 'Validation Failed' } },
    [COMMENTS]: [{ status: 201, body: {} }, { status: 422, body: { message: 'line must be part of the diff' } }],
  });
  const r = await planAndPost({ ref: ghRef, auth, report: ghReport(TWO), cfg });
  assert.equal(r.counts.posted, 1);
  assert.equal(r.counts.failed, 1);
  assert.match(r.report.findings.find((f) => f.status === 'failed').error, /line must be part of the diff/);
});

test('github: 401 → fatal auth error, everything failed, nothing lost', async () => {
  const auth = fakeAuth(ghRef, { ...githubResponses(), [REVIEWS]: { status: 401, body: { message: 'Bad credentials' } } });
  const r = await planAndPost({ ref: ghRef, auth, report: ghReport(TWO), cfg });
  assert.equal(r.fatal.exitCode, 2);
  assert.equal(r.counts.failed, 2);
});

test('anonymous auth cannot post', async () => {
  const auth = fakeAuth(ghRef, githubResponses(), 'anonymous');
  await assert.rejects(planAndPost({ ref: ghRef, auth, report: ghReport(TWO), cfg }), (e) => e.exitCode === 2 && /credentials/.test(e.message));
});

test('head SHA changed: same code moved → re-anchored; changed code → unmapped', async () => {
  const report = ghReport(TWO);
  const moved = PRICE_PATCH.replace('@@ -1,3 +1,5 @@', '@@ -11,3 +11,5 @@').replace('@@ -18,3 +20,4 @@ export function ship()', '@@ -18,3 +20,4 @@').replace('+  try { send(); } catch (e) {}', '+  try { send(); } catch (err) { log(err); }');
  const files = [{ ...RAW_GITHUB.files[0], patch: moved }];
  const auth = fakeAuth(ghRef, { ...githubResponses({ files, headSha: 'head333' }), [REVIEWS]: { status: 200, body: {} } });
  const r = await planAndPost({ ref: ghRef, auth, report, cfg });
  const byRule = Object.fromEntries(r.report.findings.map((f) => [f.ruleId, f]));
  assert.equal(byRule['GEN-006'].status, 'posted');
  assert.equal(byRule['GEN-006'].line, 13);
  assert.equal(byRule['GEN-008'].status, 'unmapped');
  assert.match(byRule['GEN-008'].error, /changed since the review/);
  assert.equal(r.report.mergeRequest.headSha, 'head333');
  assert.equal(auth.calls.find((c) => c.method === 'POST').body.comments.length, 1);
});

test('general notes are never posted inline', async () => {
  const report = ghReport([{ general: true, ruleId: 'GEN-011', title: 'No tests', body: 'Add tests.' }]);
  const auth = fakeAuth(ghRef, githubResponses());
  const r = await planAndPost({ ref: ghRef, auth, report, cfg });
  assert.equal(r.counts.generalNotes, 1);
  assert.equal(r.report.findings[0].status, 'pending');
  assert.ok(!auth.calls.some((c) => c.method === 'POST'));
});

test('gitlab: discussion per finding with text position; context lines get old_line', async () => {
  const raw = {
    ...structuredClone(RAW_GITHUB),
    ...GITLAB_REF,
    baseSha: 'glbase',
    startSha: 'glstart',
    headSha: 'glhead',
    files: [{ path: 'src/price.ts', changeType: 'modified', patch: PRICE_PATCH }],
  };
  const { report } = validateFindings(buildMr(raw, cfg), [finding(), finding({ line: 22, ruleId: 'GEN-004', title: 'Dup' })], rules);
  const auth = fakeAuth(GITLAB_REF, {
    ...gitlabResponses(),
    [`POST ${GITLAB_BASE}/discussions`]: [{ status: 201, body: {} }, { status: 400, body: { message: 'position is invalid' } }],
  });
  const r = await planAndPost({ ref: GITLAB_REF, auth, report, cfg });
  const posts = auth.calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[0].body.position, {
    position_type: 'text',
    base_sha: 'glbase',
    start_sha: 'glstart',
    head_sha: 'glhead',
    old_path: 'src/price.ts',
    new_path: 'src/price.ts',
    new_line: 3,
  });
  assert.equal(posts[1].body.position.old_line, 19);
  assert.match(posts[0].body.body, /```suggestion:-0\+0\n/);
  assert.equal(r.counts.posted, 1);
  assert.equal(r.counts.failed, 1);
});

test('gitlab: existing discussion note marker → duplicate', async () => {
  const raw = { ...structuredClone(RAW_GITHUB), ...GITLAB_REF, headSha: 'glhead', files: [{ path: 'src/price.ts', changeType: 'modified', patch: PRICE_PATCH }] };
  const { report } = validateFindings(buildMr(raw, cfg), [finding()], rules);
  const auth = fakeAuth(GITLAB_REF, gitlabResponses({ notes: [marker(report.findings[0])] }));
  const r = await planAndPost({ ref: GITLAB_REF, auth, report, cfg });
  assert.equal(r.counts.duplicates, 1);
});
