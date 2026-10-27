import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeAt, findBlock, parsePatch } from '../../lib/diff.mjs';
import { PRICE_PATCH } from './helpers.mjs';

test('multiple hunks: added + context lines are valid, removed are not', () => {
  const r = parsePatch(PRICE_PATCH);
  assert.deepEqual(r.validLines, [1, 2, 3, 4, 5, 20, 21, 22, 23]);
  assert.deepEqual(r.hunks, [
    { newStart: 1, newEnd: 5 },
    { newStart: 20, newEnd: 23 },
  ]);
  assert.deepEqual(r.oldLineOf, { 1: 1, 5: 3, 20: 18, 22: 19, 23: 20 });
});

test('no newline marker is ignored', () => {
  const r = parsePatch('@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n\\ No newline at end of file');
  assert.deepEqual(r.validLines, [1]);
  assert.equal(r.text[1], 'b');
});

test('new file and deleted file', () => {
  assert.deepEqual(parsePatch('@@ -0,0 +1,3 @@\n+a\n+b\n+c').validLines, [1, 2, 3]);
  const del = parsePatch('@@ -1,2 +0,0 @@\n-a\n-b');
  assert.deepEqual(del.validLines, []);
  assert.deepEqual(del.hunks, []);
});

test('CRLF patches', () => {
  const r = parsePatch('@@ -1,2 +1,2 @@\r\n a\r\n-b\r\n+c\r\n');
  assert.deepEqual(r.validLines, [1, 2]);
  assert.equal(r.text[2], 'c');
});

test('empty line inside a hunk counts as context', () => {
  const r = parsePatch('@@ -1,3 +1,3 @@\n a\n\n-b\n+c');
  assert.deepEqual(r.validLines, [1, 2, 3]);
});

test('codeAt returns new-side text; null outside diff', () => {
  assert.equal(codeAt(PRICE_PATCH, 2, 3), '  const total = base * 1.18;\n  if (total > 100) return total * 0.9;');
  assert.equal(codeAt(PRICE_PATCH, 6, 6), null);
});

test('findBlock finds code regardless of whitespace', () => {
  assert.deepEqual(findBlock(PRICE_PATCH, 'if (total > 100)   return total * 0.9;', 1), [3]);
  assert.deepEqual(findBlock(PRICE_PATCH, 'nothing like this', 1), []);
});
