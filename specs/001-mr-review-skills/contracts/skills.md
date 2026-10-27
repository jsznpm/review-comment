# Contract: Skills

Both skills share steps 1–5; they differ after the findings are validated.
`${CLAUDE_PLUGIN_ROOT}` is the plugin install directory.

## Shared flow

1. `node ${CLAUDE_PLUGIN_ROOT}/bin/mr.mjs fetch <url> --out .review-comment/mr.json`
   → MergeRequest with ChangedFiles, validLines, ruleFiles, skipped reasons.
   On error: show the message, write nothing else, stop.
2. For each non-skipped file (batches of ~10): read its `ruleFiles` from
   `${CLAUDE_PLUGIN_ROOT}/rules/`, review the patch against active rules only.
3. Write candidate findings to `.review-comment/findings.json` (Finding schema, see
   [data-model.md](../data-model.md)).
4. `node mr.mjs validate .review-comment/mr.json .review-comment/findings.json --out .review-comment/review.json`
   → marks `unmapped` findings, computes `key`; the skill never edits line numbers by guess.
   On structural errors (exit 1) the skill fixes the reported findings and re-runs validate.
5. Model rules for findings:
   - Only report issues introduced or touched by the diff.
   - Cite exactly one `ruleId`; use `GEN-*` when no language rule fits.
   - `suggestion` only when it is a drop-in replacement for lines `startLine..line`,
     keeping the file's indentation style.
   - No findings for skipped files.

## `review-file`

| | |
|-|-|
| Input | MR URL (required), output path (optional, default `./review.md`). Test-only: a local `.diff` path when `REVIEW_COMMENT_LOCAL_DIFF=1` |
| Output | `review.md` — see [review-md.md](./review-md.md); intermediate JSON stays in `.review-comment/` |
| Side effects on platform | none (MUST NOT call `mr.mjs post`) |
| Existing `review.md` | overwritten; header shows MR, commit, date |

Step 6: `node mr.mjs render .review-comment/review.json --out <path>`; print summary
(files reviewed/skipped, findings by severity, output path).

## `review-post`

| | |
|-|-|
| Input | MR URL (required) |
| Output | inline comments on the MR; `review.md` for anything not posted |
| Confirmation | exactly one question after showing all findings: **Post all** / **Cancel** |

Step 6: `node mr.mjs post <url> .review-comment/review.json --dry-run` → shows what would be
posted, which are duplicates, which are unmapped (after head-SHA recheck).
Step 7: ask the single confirmation. Cancel → render `review.md`, stop.
Step 8: `node mr.mjs post <url> .review-comment/review.json` → updates statuses.
Step 9: render `review.md` with any `failed`/`unmapped`/`pending` findings; report counts.

Auth missing / no permission → no post; render `review.md`; tell the user which credential is
needed (`gh auth login`, `glab auth login`, or `GITHUB_TOKEN`/`GITLAB_TOKEN`).
