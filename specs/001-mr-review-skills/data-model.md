# Data Model: Merge Request Review Skills

## MergeRequest

| Field | Type | Notes |
|-------|------|-------|
| platform | `"github"` \| `"gitlab"` | from URL |
| host | string | `github.com`, `gitlab.com` or self-hosted host |
| project | string | `owner/repo` (GitHub) or full group path (GitLab) |
| number | integer | PR number / MR iid |
| url | string | original link |
| title | string | |
| baseSha, startSha, headSha | string | `startSha` GitLab only; `headSha` = reviewed commit (FR-003) |
| files | ChangedFile[] | |

Validation: URL must match `https://<host>/<owner>/<repo>/pull/<n>` (GitHub) or
`https://<host>/<group…>/<project>/-/merge_requests/<n>` (GitLab); otherwise error, no output file.

## ChangedFile

| Field | Type | Notes |
|-------|------|-------|
| path | string | new path |
| oldPath | string? | when renamed |
| changeType | `added` \| `modified` \| `deleted` \| `renamed` | |
| language | string? | rule-file key from `languages.json`; null → general rules only |
| ruleFiles | string[] | e.g. `["general.md", "typescript.md", "react.md"]` |
| patch | string? | unified diff hunks |
| validLines | integer[] | new-side lines in hunks (added + context) |
| hunks | `{newStart, newEnd}`[] | for range checks |
| skipped | `{reason}`? | binary, deleted, lockfile, generated, no-patch |

## Rule

| Field | Type | Notes |
|-------|------|-------|
| id | string | `<PREFIX>-NNN`, unique, never reused |
| title | string | |
| severity | `blocker` \| `major` \| `minor` \| `suggestion` | default severity |
| status | `active` \| `retired` | retired rules never produce findings |
| appliesTo | string | what code it targets |
| lookFor | string | detectable signal in a diff |
| why | string | impact |
| fix | string | fix pattern |
| example | code (bad/good) | original code |
| sources | url[] | ≥ 1 required |

## RuleSet

| Field | Type | Notes |
|-------|------|-------|
| language | string | `general`, `csharp`, `go`, `java`, `typescript`, `javascript`, `react` |
| prefix | string | `GEN`, `CS`, `GO`, `JAVA`, `TS`, `JS`, `REACT` |
| version | semver | bumps with rule changes |
| rules | Rule[] | |

## Finding

| Field | Type | Notes |
|-------|------|-------|
| path | string | must be a non-skipped ChangedFile |
| startLine | integer? | range start; omitted for single line |
| line | integer | range end (new side) |
| severity | enum | may differ from rule default with reason |
| ruleId | string | must exist and be `active` |
| title | string | short headline |
| body | string | explanation + why, Markdown |
| suggestion | string? | replacement code for lines `startLine..line` |
| dropIn | boolean? | default `true`; `false` renders `suggestion` as a plain code block (illustration, not an apply-able suggestion) |
| anchorCode | string | set by validate: new-side code of the anchored lines, used to re-anchor after a push |
| general | boolean | true → general note, not anchored to a diff line |
| key | string | dedupe hash (ruleId + path + normalized code of lines) |
| status | `pending` \| `posted` \| `failed` \| `skipped-duplicate` \| `unmapped` | |
| error | string? | reason for failed/unmapped |

Validation rules:
- `general == false` ⇒ `line` (and `startLine`) ∈ `validLines` and within one hunk; else
  status → `unmapped`, kept in `review.md` under "Not anchored".
- `startLine ≤ line`.
- `ruleId` prefix must match one of the file's rule files (or `GEN`).

## ReviewReport (`review.json` → `review.md`)

| Field | Type | Notes |
|-------|------|-------|
| mergeRequest | MergeRequest (without patches) | header |
| reviewedAt | ISO datetime | |
| mode | `file` \| `post` | |
| summary | `{filesReviewed, filesSkipped[], bySeverity{}, posted?, failed?}` | FR-009 |
| findings | Finding[] | grouped by path when rendered |

## State transitions (posting mode)

```text
pending ──validate──▶ unmapped (kept in review.md)
pending ──dedupe────▶ skipped-duplicate
pending ──confirm: cancel──▶ pending (written to review.md)
pending ──confirm: post──▶ posted | failed (failed written to review.md)
```
