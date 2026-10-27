const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

// Parses unified-diff hunks. New-side lines that are added or context are commentable.
export function parsePatch(patch) {
  const validLines = [];
  const hunks = [];
  const oldLineOf = {};
  const text = {};
  let oldLine = 0;
  let newLine = 0;
  let oldLeft = 0;
  let newLeft = 0;

  for (const raw of String(patch ?? '').split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const h = HUNK.exec(line);
    if (h) {
      oldLine = Number(h[1]);
      oldLeft = h[2] === undefined ? 1 : Number(h[2]);
      newLine = Number(h[3]);
      newLeft = h[4] === undefined ? 1 : Number(h[4]);
      if (newLeft > 0) hunks.push({ newStart: newLine, newEnd: newLine + newLeft - 1 });
      continue;
    }
    if (oldLeft <= 0 && newLeft <= 0) continue;
    if (line.startsWith('\\')) continue;

    const sign = line[0];
    if (sign === '+') {
      validLines.push(newLine);
      text[newLine] = line.slice(1);
      newLine++;
      newLeft--;
    } else if (sign === '-') {
      oldLine++;
      oldLeft--;
    } else if (sign === ' ' || line === '') {
      validLines.push(newLine);
      text[newLine] = line.slice(1);
      oldLineOf[newLine] = oldLine;
      newLine++;
      oldLine++;
      newLeft--;
      oldLeft--;
    }
  }
  return { validLines, hunks, oldLineOf, text };
}

export function hunkOf(hunks, line) {
  return hunks.find((h) => line >= h.newStart && line <= h.newEnd) ?? null;
}

export function codeAt(patch, startLine, line) {
  const { text } = parsePatch(patch);
  const out = [];
  for (let n = startLine; n <= line; n++) {
    if (!(n in text)) return null;
    out.push(text[n]);
  }
  return out.join('\n');
}

export function normalizeCode(code) {
  return String(code ?? '').replace(/\s+/g, ' ').trim();
}

// Finds every start line where `lineCount` consecutive new-side lines inside one hunk
// match `code` (whitespace-insensitive). Used to re-anchor findings after a push.
export function findBlock(patch, code, lineCount) {
  const { text, hunks } = parsePatch(patch);
  const target = normalizeCode(code);
  const starts = [];
  for (const h of hunks) {
    for (let s = h.newStart; s + lineCount - 1 <= h.newEnd; s++) {
      const lines = [];
      let ok = true;
      for (let n = s; n < s + lineCount; n++) {
        if (!(n in text)) {
          ok = false;
          break;
        }
        lines.push(text[n]);
      }
      if (ok && normalizeCode(lines.join('\n')) === target) starts.push(s);
    }
  }
  return starts;
}
