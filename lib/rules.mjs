import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'rules');
export const SEVERITIES = ['blocker', 'major', 'minor', 'suggestion'];
export const STATUSES = ['active', 'retired'];

const RULE_HEADING = /^###\s+(\S+)\s+—\s+(.+?)\s*$/;
const FIELD = /^- \*\*([\w-]+)\*\*:\s*(.*)$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

export function parseRuleFile(content, file = '') {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const front = {};
  let i = 0;
  if (lines[0] === '---') {
    for (i = 1; i < lines.length && lines[i] !== '---'; i++) {
      const m = /^([\w-]+):\s*(.*)$/.exec(lines[i]);
      if (m) front[m[1]] = m[2].trim();
    }
    i++;
  }

  const rules = [];
  const badHeadings = [];
  let cur = null;
  let fence = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const f = FENCE.exec(line);
    if (f) {
      if (!fence) fence = f[1];
      else if (line.trim().startsWith(fence) && /^(`+|~+)$/.test(line.trim())) fence = null;
      continue;
    }
    if (fence) continue;

    if (line.startsWith('### ')) {
      const m = RULE_HEADING.exec(line);
      if (m) {
        cur = { id: m[1], title: m[2], fields: {}, line: i + 1 };
        rules.push(cur);
      } else {
        badHeadings.push({ line: i + 1, text: line });
        cur = null;
      }
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      cur = null;
      continue;
    }
    const fm = cur && FIELD.exec(line);
    if (fm) cur.fields[fm[1]] = fm[2].trim();
  }
  return { file, front, rules, badHeadings };
}

export function loadLanguages(rulesDir = RULES_DIR) {
  return JSON.parse(fs.readFileSync(path.join(rulesDir, 'languages.json'), 'utf8'));
}

export function loadRules(rulesDir = RULES_DIR) {
  const cfg = loadLanguages(rulesDir);
  const fileNames = [cfg.general, ...Object.values(cfg.languages).map((l) => l.file)];
  const files = fileNames.map((name) =>
    parseRuleFile(fs.readFileSync(path.join(rulesDir, name), 'utf8'), name),
  );
  const byId = new Map();
  const prefixOfFile = {};
  for (const f of files) {
    prefixOfFile[f.file] = f.front.prefix;
    for (const r of f.rules) {
      byId.set(r.id, {
        id: r.id,
        title: r.title,
        file: f.file,
        prefix: f.front.prefix,
        severity: r.fields.severity,
        status: r.fields.status,
      });
    }
  }
  return { cfg, files, byId, prefixOfFile };
}
