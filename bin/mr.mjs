#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveAuth } from '../lib/auth.mjs';
import { CliError, EXIT } from '../lib/errors.mjs';
import { validateFindings } from '../lib/findings.mjs';
import { buildMr, fetchMr, loadLocalDiff } from '../lib/merge-request.mjs';
import { planAndPost } from '../lib/post.mjs';
import { renderReview } from '../lib/render.mjs';
import { loadLanguages, loadRules } from '../lib/rules.mjs';
import { parseMrUrl } from '../lib/url.mjs';

const USAGE = `usage: mr.mjs <command> [args]

  parse-url <url>
  fetch <url> --out <mr.json>
  lines <mr.json> [path]
  validate <mr.json> <findings.json> --out <review.json> [--mode file|post]
  render <review.json> --out <review.md>
  post <url> <review.json> [--dry-run]

exit codes: 0 ok, 1 invalid input, 2 auth/permission, 3 not found/unreachable, 4 partial post failure`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--help') flags[a.slice(2)] = true;
    else if (a.startsWith('--')) flags[a.slice(2)] = argv[++i];
    else positional.push(a);
  }
  return { positional, flags };
}

function need(value, name) {
  if (value === undefined || value === '') throw new CliError(`missing ${name}\n\n${USAGE}`, EXIT.INPUT);
  return value;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new CliError(`cannot read JSON ${p}: ${e.message}`, EXIT.INPUT);
  }
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
  fs.writeFileSync(p, content);
}

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function isLocalDiff(arg) {
  return process.env.REVIEW_COMMENT_LOCAL_DIFF === '1' && !/^https?:\/\//i.test(arg);
}

function ranges(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let j = i;
    while (j + 1 < lines.length && lines[j + 1] === lines[j] + 1) j++;
    out.push(i === j ? `${lines[i]}` : `${lines[i]}-${lines[j]}`);
    i = j;
  }
  return out.join(', ');
}

const commands = {
  'parse-url'({ positional }) {
    print(parseMrUrl(need(positional[0], '<url>')));
  },

  async fetch({ positional, flags }) {
    const arg = need(positional[0], '<url>');
    const out = need(flags.out, '--out <mr.json>');
    const cfg = loadLanguages();
    let mr;
    let authKind = 'local';
    if (isLocalDiff(arg)) {
      mr = buildMr(loadLocalDiff(arg), cfg);
    } else {
      const ref = parseMrUrl(arg);
      const auth = await resolveAuth(ref);
      authKind = auth.kind;
      mr = await fetchMr(ref, auth, cfg);
    }
    writeFile(out, JSON.stringify(mr, null, 2));
    const reviewable = mr.files.filter((f) => !f.skipped);
    print({
      platform: mr.platform,
      title: mr.title,
      headSha: mr.headSha,
      auth: authKind,
      files: mr.files.length,
      skipped: mr.files.length - reviewable.length,
      reviewable: reviewable.map((f) => ({ path: f.path, ruleFiles: f.ruleFiles, lines: ranges(f.validLines) })),
      skippedFiles: mr.files.filter((f) => f.skipped).map((f) => ({ path: f.path, reason: f.skipped.reason })),
    });
  },

  lines({ positional }) {
    const mr = readJson(need(positional[0], '<mr.json>'));
    const only = positional[1];
    const out = {};
    for (const f of mr.files) {
      if (f.skipped || (only && f.path !== only)) continue;
      out[f.path] = { ranges: ranges(f.validLines), hunks: f.hunks, validLines: f.validLines };
    }
    if (only && !out[only]) throw new CliError(`no reviewable file ${only} in ${positional[0]}`, EXIT.INPUT);
    print(out);
  },

  validate({ positional, flags }) {
    const mr = readJson(need(positional[0], '<mr.json>'));
    const findings = readJson(need(positional[1], '<findings.json>'));
    const out = need(flags.out, '--out <review.json>');
    const mode = flags.mode ?? 'file';
    if (!['file', 'post'].includes(mode)) throw new CliError(`invalid --mode ${mode}`, EXIT.INPUT);
    const { invalid, report } = validateFindings(mr, findings, loadRules(), { mode });
    const counts = {
      pending: report.findings.filter((f) => f.status === 'pending' && !f.general).length,
      general: report.findings.filter((f) => f.general).length,
      unmapped: report.findings.filter((f) => f.status === 'unmapped').map((f) => ({ path: f.path, line: f.line, ruleId: f.ruleId, error: f.error })),
      invalid,
    };
    print(counts);
    if (invalid.length) {
      process.exitCode = EXIT.INPUT;
      return;
    }
    writeFile(out, JSON.stringify(report, null, 2));
  },

  render({ positional, flags }) {
    const report = readJson(need(positional[0], '<review.json>'));
    const out = need(flags.out, '--out <review.md>');
    writeFile(out, renderReview(report));
    print({ written: path.resolve(out), findings: report.findings.length, mode: report.mode });
  },

  async post({ positional, flags }) {
    const ref = parseMrUrl(need(positional[0], '<url>'));
    const reviewPath = need(positional[1], '<review.json>');
    const report = readJson(reviewPath);
    if (report.mergeRequest?.url !== ref.url) {
      throw new CliError(`${reviewPath} belongs to ${report.mergeRequest?.url}, not ${ref.url}`, EXIT.INPUT);
    }
    const auth = await resolveAuth(ref);
    const result = await planAndPost({ ref, auth, report, cfg: loadLanguages(), dryRun: Boolean(flags['dry-run']) });
    if (result.plan) {
      print({ auth: auth.kind, canPost: auth.canWrite, ...result.plan });
      return;
    }
    writeFile(reviewPath, JSON.stringify(result.report, null, 2));
    print(result.counts);
    if (result.fatal) {
      process.stderr.write(`review-comment: ${result.fatal.message}\n`);
      process.exitCode = result.fatal.exitCode;
    } else if (result.counts.failed > 0) {
      process.exitCode = EXIT.PARTIAL;
    }
  },
};

async function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const [cmd, ...rest] = positional;
  if (!cmd || flags.help || !commands[cmd]) {
    process.stdout.write(`${USAGE}\n`);
    process.exitCode = cmd && !commands[cmd] ? EXIT.INPUT : EXIT.OK;
    return;
  }
  await commands[cmd]({ positional: rest, flags });
}

main(process.argv.slice(2)).catch((e) => {
  process.stderr.write(`review-comment: ${e instanceof CliError ? e.message : e?.message ?? e}\n`);
  process.exitCode = e instanceof CliError ? e.exitCode : EXIT.INPUT;
});
