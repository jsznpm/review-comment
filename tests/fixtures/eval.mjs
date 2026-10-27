// Release gate (Constitution VI): runs the review-file skill headlessly on every seeded fixture
// and scores it. Not part of `npm test` — it calls the `claude` CLI and costs tokens.
//
//   node tests/fixtures/eval.mjs [--only <lang>] [--update-baseline]
//
// A seeded issue counts as found when an anchored finding on the same file has the same rule
// prefix (CS, GO, TS, GEN, ...) and its line range is within ±2 lines of the seeded line.
// "Wrong-line" findings are inline findings that validate could not map to a diff line.
// Fails if any language has recall < 80%, recall below its baseline, or any wrong-line finding.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const baselinePath = path.join(here, 'baseline.json');
const MIN_RECALL = 0.8;
const TOLERANCE = 2;

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const updateBaseline = args.includes('--update-baseline');

const prefix = (ruleId) => ruleId.split('-')[0];

export function score(expected, report) {
  const anchored = report.findings.filter((f) => !f.general && f.status !== 'unmapped' && f.path === expected.path);
  const used = new Set();
  let found = 0;
  const missed = [];
  for (const issue of expected.issues) {
    const hit = anchored.find(
      (f, i) =>
        !used.has(i) &&
        prefix(f.ruleId) === prefix(issue.ruleId) &&
        issue.line >= (f.startLine ?? f.line) - TOLERANCE &&
        issue.line <= f.line + TOLERANCE,
    );
    if (hit) {
      used.add(anchored.indexOf(hit));
      found++;
    } else {
      missed.push(`${issue.ruleId}@${issue.line}`);
    }
  }
  const wrongLine = report.findings.filter((f) => !f.general && f.status === 'unmapped').length;
  return { recall: found / expected.issues.length, found, total: expected.issues.length, wrongLine, missed, findings: report.findings.length };
}

function runOne(lang) {
  const fixture = path.join(here, lang);
  const expected = JSON.parse(fs.readFileSync(path.join(fixture, 'expected.json'), 'utf8'));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `review-comment-eval-${lang}-`));
  const claudeArgs = [
    '-p',
    `/review-comment:review-file "${path.join(fixture, 'change.diff')}" review.md`,
    '--plugin-dir',
    root,
    '--allowedTools',
    'Read Write Bash(node:*)',
  ];
  const opts = { cwd: work, encoding: 'utf8', env: { ...process.env, REVIEW_COMMENT_LOCAL_DIFF: '1' }, timeout: 15 * 60 * 1000 };
  let r = spawnSync('claude', claudeArgs, opts);
  if (r.error?.code === 'ENOENT' && process.platform === 'win32') {
    // npm-installed CLI is a .cmd shim, which needs a shell and quoted arguments.
    r = spawnSync('claude', claudeArgs.map((a) => `"${a.replace(/"/g, '\\"')}"`), { ...opts, shell: true });
  }
  const reportPath = path.join(work, '.review-comment', 'review.json');
  if (!fs.existsSync(reportPath)) {
    return { error: `no review.json (exit ${r.status}): ${(r.stderr || r.stdout || '').slice(-400)}`, work };
  }
  return { ...score(expected, JSON.parse(fs.readFileSync(reportPath, 'utf8'))), work };
}

function main() {
  const langs = fs.readdirSync(here).filter((d) => fs.existsSync(path.join(here, d, 'expected.json')) && (!only || d === only));
  const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : {};
  const results = {};
  let failed = false;
  for (const lang of langs) {
    process.stderr.write(`reviewing ${lang} fixture…\n`);
    const r = runOne(lang);
    results[lang] = r;
    const base = baseline[lang] ?? 0;
    r.pass = !r.error && r.recall >= MIN_RECALL && r.recall >= base && r.wrongLine === 0;
    if (!r.pass) failed = true;
  }

  console.log('\n| language | recall | found | wrong-line | baseline | result | missed |');
  console.log('|----------|--------|-------|------------|----------|--------|--------|');
  for (const [lang, r] of Object.entries(results)) {
    if (r.error) {
      console.log(`| ${lang} | — | — | — | ${baseline[lang] ?? '—'} | ERROR | ${r.error.replace(/\s+/g, ' ')} |`);
      continue;
    }
    console.log(
      `| ${lang} | ${(r.recall * 100).toFixed(0)}% | ${r.found}/${r.total} | ${r.wrongLine} | ${baseline[lang] !== undefined ? `${(baseline[lang] * 100).toFixed(0)}%` : '—'} | ${r.pass ? 'pass' : 'FAIL'} | ${r.missed.join(', ')} |`,
    );
  }

  if (updateBaseline) {
    const next = { ...baseline };
    for (const [lang, r] of Object.entries(results)) if (!r.error) next[lang] = Math.round(r.recall * 100) / 100;
    fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`\nbaseline updated: ${baselinePath}`);
  }
  process.exitCode = failed && !updateBaseline ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
