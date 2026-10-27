# Quickstart & Validation: Merge Request Review Skills

## Prerequisites

- Claude Code installed; Node.js ≥ 18.
- Optional (private repos, posting): `gh auth login` (GitHub) / `glab auth login` (GitLab),
  or `GITHUB_TOKEN` / `GITLAB_TOKEN` in the environment.
- A test repository you own on GitHub and one on GitLab, each with an open MR containing a
  seeded fixture diff from `tests/fixtures/<lang>/change.diff`.

## Local install (development)

```bash
npm test                                   # unit + rule lint
claude --plugin-dir .                      # load plugin from working tree
```

## Install from npm (release check)

```text
/plugin marketplace add <owner>/review-comment
/plugin install review-comment
```

Expected: `/review-comment:review-file` and `/review-comment:review-post` listed (SC-008).

## Scenario 1 — File mode (Story 1)

```text
/review-comment:review-file https://github.com/<owner>/<repo>/pull/<n>
```

Expected:
- `review.md` in the working directory; header shows MR, platform, head SHA, date.
- Every finding's file/line is inside the diff (check with `node bin/mr.mjs lines .review-comment/mr.json`).
- Paste 3 comment blocks into GitHub on the stated lines → render with "Apply suggestion".
- Nothing new appears on the PR.

Repeat with a GitLab MR URL (gitlab.com and, if available, self-hosted) → same format,
`suggestion:-N+0` blocks apply correctly.

## Scenario 2 — Posting mode (Story 2)

```text
/review-comment:review-post https://gitlab.com/<group>/<project>/-/merge_requests/<n>
```

Expected:
- All findings listed, one question: Post all / Cancel.
- Cancel → nothing posted, `review.md` written.
- Post all → inline comments on the exact lines; counts reported.
- Run again → 0 posted, all reported as duplicates.
- Push a commit moving lines, run again → moved findings re-anchor or are reported unmapped;
  none land on a wrong line.
- Unset credentials → no post, clear message, `review.md` written.

## Scenario 3 — Rules as data (Story 3)

1. Add `### GO-999 — Test rule` to `rules/go.md` (all required keys).
2. `npm test` passes.
3. Review a Go MR that triggers it → `GO-999` appears in findings. No skill file changed (SC-007).
4. A `.tsx` file in a review gets REACT-*, TS-* and GEN-* findings only.

## Scenario 4 — Fixture eval (release gate)

```bash
node tests/fixtures/eval.mjs
```

Expected per language: recall ≥ 80% of `expected.json` issues (SC-005), wrong-line findings = 0
(SC-002).

## Error cases

| Input | Expected |
|-------|----------|
| `https://example.com/foo` | exit 1, "unsupported merge request URL", no file |
| Non-existent PR | exit 3, clear message, no file |
| Private repo, no auth | exit 2, says which login/token is needed |
