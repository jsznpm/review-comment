import { buildMr } from '../../lib/merge-request.mjs';
import { loadLanguages } from '../../lib/rules.mjs';

// price.ts: new lines 1-5 (1 and 5 are context), second hunk new lines 20-23.
export const PRICE_PATCH = [
  '@@ -1,3 +1,5 @@',
  ' export function price(base: number) {',
  '-  return base * 1.18;',
  '+  const total = base * 1.18;',
  '+  if (total > 100) return total * 0.9;',
  '+  return total;',
  ' }',
  '@@ -18,3 +20,4 @@ export function ship()',
  ' export function ship() {',
  '+  try { send(); } catch (e) {}',
  '   return 5;',
  ' }',
].join('\n');

export const RAW_GITHUB = {
  platform: 'github',
  host: 'github.com',
  origin: 'https://github.com',
  project: 'acme/shop',
  number: 7,
  url: 'https://github.com/acme/shop/pull/7',
  title: 'Add discount',
  baseSha: 'base111',
  startSha: null,
  headSha: 'head222',
  files: [
    { path: 'src/price.ts', changeType: 'modified', patch: PRICE_PATCH },
    { path: 'src/View.tsx', changeType: 'added', patch: '@@ -0,0 +1,2 @@\n+export const View = () => <div />;\n+export default View;' },
    { path: 'package-lock.json', changeType: 'modified', patch: '@@ -1 +1 @@\n-a\n+b' },
    { path: 'src/old.ts', changeType: 'deleted', patch: '@@ -1 +0,0 @@\n-x' },
    { path: 'logo.png', changeType: 'added', patch: null },
  ],
};

export function sampleMr(raw = RAW_GITHUB) {
  return buildMr(structuredClone(raw), loadLanguages());
}

export function githubResponses({ files = RAW_GITHUB.files, headSha = 'head222', comments = [] } = {}) {
  const ghFiles = files.map((f) => ({
    filename: f.path,
    status: { modified: 'modified', added: 'added', deleted: 'removed', renamed: 'renamed' }[f.changeType],
    patch: f.patch ?? undefined,
  }));
  return {
    'GET /repos/acme/shop/pulls/7': { body: { title: 'Add discount', base: { sha: 'base111' }, head: { sha: headSha } } },
    'GET /repos/acme/shop/pulls/7/files?per_page=100&page=1': { body: ghFiles },
    'GET /repos/acme/shop/pulls/7/comments?per_page=100&page=1': { body: comments.map((body) => ({ body })) },
  };
}

export const GITLAB_REF = {
  platform: 'gitlab',
  host: 'gitlab.example.com',
  origin: 'https://gitlab.example.com',
  project: 'grp/sub/app',
  number: 3,
  url: 'https://gitlab.example.com/grp/sub/app/-/merge_requests/3',
};

export const GITLAB_BASE = '/projects/grp%2Fsub%2Fapp/merge_requests/3';

export function gitlabResponses({ headSha = 'glhead', notes = [] } = {}) {
  return {
    [`GET ${GITLAB_BASE}`]: {
      body: { title: 'Refactor', diff_refs: { base_sha: 'glbase', start_sha: 'glstart', head_sha: headSha } },
    },
    [`GET ${GITLAB_BASE}/diffs?per_page=100&page=1`]: {
      body: [
        { old_path: 'src/price.ts', new_path: 'src/price.ts', diff: PRICE_PATCH },
        { old_path: 'src/a.go', new_path: 'src/b.go', renamed_file: true, diff: '@@ -1 +1,2 @@\n package b\n+func B() {}' },
        { old_path: 'gen/x.pb.go', new_path: 'gen/x.pb.go', diff: '@@ -1 +1 @@\n-a\n+b' },
        { old_path: 'gone.java', new_path: 'gone.java', deleted_file: true, diff: '@@ -1 +0,0 @@\n-x' },
      ],
    },
    [`GET ${GITLAB_BASE}/discussions?per_page=100&page=1`]: { body: notes.map((body) => ({ notes: [{ body }] })) },
  };
}

export function finding(overrides = {}) {
  return {
    path: 'src/price.ts',
    line: 3,
    ruleId: 'GEN-006',
    severity: 'suggestion',
    title: 'Magic number',
    body: '`100` and `0.9` are unexplained.',
    suggestion: '  if (total > DISCOUNT_THRESHOLD) return total * DISCOUNT_FACTOR;',
    ...overrides,
  };
}
