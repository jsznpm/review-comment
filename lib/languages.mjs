import path from 'node:path';

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`, 'i');
}

export function matchGlob(glob, filePath) {
  const p = filePath.replace(/\\/g, '/');
  const re = globToRegExp(glob);
  if (!glob.includes('/')) return re.test(p.split('/').pop());
  if (re.test(p)) return true;
  for (let i = p.indexOf('/'); i !== -1; i = p.indexOf('/', i + 1)) {
    if (re.test(p.slice(i + 1))) return true;
  }
  return false;
}

// Returns the rule files for a path: general rules plus every language whose extensions match.
export function rulesFor(filePath, cfg) {
  for (const glob of cfg.skip ?? []) {
    if (matchGlob(glob, filePath)) {
      return { language: null, ruleFiles: [], skipped: { reason: 'generated-or-lockfile' } };
    }
  }
  const ext = path.posix.extname(filePath.replace(/\\/g, '/')).toLowerCase();
  const matched = Object.entries(cfg.languages).filter(([, l]) => l.extensions.includes(ext));
  return {
    language: matched[0]?.[0] ?? null,
    ruleFiles: [cfg.general, ...matched.map(([, l]) => l.file)],
  };
}
