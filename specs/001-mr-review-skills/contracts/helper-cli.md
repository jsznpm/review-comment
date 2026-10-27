# Contract: Helper CLI `bin/mr.mjs`

Node ≥ 18, no dependencies. All JSON is UTF-8. Diagnostics to stderr; tokens never printed.

| Exit code | Meaning |
|-----------|---------|
| 0 | success |
| 1 | invalid input (bad URL, bad JSON, schema error) |
| 2 | auth missing / permission denied |
| 3 | not found / unreachable |
| 4 | partial failure (some findings failed to post) |

## `parse-url <url>`

stdout: `{"platform","host","project","number"}`. Exit 1 if unsupported URL.

## `fetch <url> --out <file>`

Fetches MR metadata + all changed files (paginated), parses patches, sets `language`,
`ruleFiles`, `validLines`, `hunks`, `skipped`. Writes MergeRequest JSON.
Auth order: `gh`/`glab` → `GITHUB_TOKEN`/`GITLAB_TOKEN` → anonymous (same REST endpoints, no
`Authorization` header; rate limit → exit 2). `headSha` is always set.
stdout: `{"files": n, "skipped": m, "headSha": "..."}`.

Test-only: with `REVIEW_COMMENT_LOCAL_DIFF=1`, `<url>` may be a path to a local `.diff` file;
platform is `github`, SHAs are fixed fake values. Used by `tests/fixtures/eval.mjs` only.

## `lines <mr.json> [path]`

stdout: `{ "<path>": {"validLines": [...], "hunks": [...]}, ... }` — for the model to consult.

## `validate <mr.json> <findings.json> --out <review.json>`

Checks each Finding (see data-model validation rules), sets `key`, `status`
(`pending` / `unmapped`), drops nothing. Writes ReviewReport with summary.
stdout: `{"pending": a, "unmapped": b, "invalid": [{"index", "error"}]}`; exit 1 if any
finding is structurally invalid (missing fields, unknown ruleId).

## `render <review.json> --out <review.md>`

Writes `review.md` per [review-md.md](./review-md.md). Never touches the network.

## `post <url> <review.json> [--dry-run]`

1. Re-fetch head SHA; if changed, re-fetch patches and re-validate → newly `unmapped`.
2. Fetch existing comments; findings whose `key` marker exists → `skipped-duplicate`.
3. `--dry-run`: print plan `{"toPost": [...], "duplicates": [...], "unmapped": [...]}`, exit 0.
4. Otherwise post (GitHub: one review batch, per-comment retry on 422; GitLab: one discussion
   per finding), set `posted`/`failed` + `error`, rewrite `review.json`.
stdout: `{"posted": a, "failed": b, "duplicates": c, "unmapped": d}`; exit 4 if `failed > 0`.

Only `review-post` calls `post`.
