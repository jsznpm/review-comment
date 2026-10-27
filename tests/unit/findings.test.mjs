import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findingKey, validateFindings } from '../../lib/findings.mjs';
import { loadRules } from '../../lib/rules.mjs';
import { finding, sampleMr } from './helpers.mjs';

const rules = loadRules();
const mr = sampleMr();
const run = (list) => validateFindings(mr, list, rules, { now: new Date('2026-10-27T10:00:00Z') });

test('line in diff → pending with key and anchor code', () => {
  const { invalid, report } = run([finding()]);
  assert.deepEqual(invalid, []);
  const f = report.findings[0];
  assert.equal(f.status, 'pending');
  assert.equal(f.anchorCode, '  if (total > 100) return total * 0.9;');
  assert.match(f.key, /^[0-9a-f]{12}$/);
});

test('line outside diff or range across hunks → unmapped', () => {
  const { report } = run([finding({ line: 10 }), finding({ startLine: 4, line: 21 })]);
  assert.deepEqual(report.findings.map((f) => f.status), ['unmapped', 'unmapped']);
  assert.ok(report.findings.every((f) => f.error));
});

test('range inside one hunk is valid; startLine == line is collapsed', () => {
  const { report } = run([finding({ startLine: 2, line: 4 }), finding({ startLine: 21, line: 21 })]);
  assert.equal(report.findings[0].status, 'pending');
  assert.equal(report.findings[1].startLine, undefined);
});

test('structural errors are reported as invalid', () => {
  const { invalid } = run([
    finding({ startLine: 4, line: 3 }),
    finding({ ruleId: 'GEN-999' }),
    finding({ ruleId: 'CS-001' }),
    finding({ path: 'package-lock.json', line: 1 }),
    finding({ path: 'nope.ts' }),
    finding({ title: '' }),
    finding({ severity: 'huge' }),
    finding({ line: 0 }),
    'x',
  ]);
  assert.deepEqual(invalid.map((i) => i.index), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.match(invalid[2].error, /does not apply/);
});

test('language rule applies to matching file; React rules apply to .tsx', () => {
  const { invalid } = run([
    finding({ ruleId: 'TS-001' }),
    finding({ path: 'src/View.tsx', line: 1, ruleId: 'REACT-001', suggestion: undefined }),
    finding({ path: 'src/View.tsx', line: 1, ruleId: 'TS-001', suggestion: undefined }),
  ]);
  assert.deepEqual(invalid, []);
});

test('general notes skip line checks', () => {
  const { invalid, report } = run([{ general: true, ruleId: 'GEN-011', title: 'No tests', body: 'Add tests.', path: 'src/price.ts' }]);
  assert.deepEqual(invalid, []);
  assert.equal(report.findings[0].status, 'pending');
  assert.equal(report.findings[0].severity, 'minor');
});

test('key is stable when lines shift but code is the same', () => {
  assert.equal(findingKey('GEN-006', 'a.ts', '  x  =  1;'), findingKey('GEN-006', 'a.ts', 'x = 1;'));
  assert.notEqual(findingKey('GEN-006', 'a.ts', 'x = 1;'), findingKey('GEN-006', 'a.ts', 'x = 2;'));
});

test('summary counts and ordering', () => {
  const { report } = run([finding({ line: 21, ruleId: 'GEN-008', severity: 'major' }), finding({ line: 2 })]);
  assert.deepEqual(report.findings.map((f) => f.line), [2, 21]);
  assert.equal(report.summary.filesReviewed, 2);
  assert.equal(report.summary.filesSkipped.length, 3);
  assert.equal(report.summary.bySeverity.major, 1);
  assert.equal(report.mergeRequest.files[0].patch, undefined);
});
