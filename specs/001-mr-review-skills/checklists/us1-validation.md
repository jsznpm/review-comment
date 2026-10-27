# US1 Validation — 2026-10-27 (partial)

## Done

- Anonymous `mr.mjs fetch` on a real public GitHub PR (expressjs/express#5935) and a real
  gitlab.com MR (gitlab-org/cli!1500): files, commentable line ranges and head SHA returned.
- `validate` + `render` on the GitHub PR data produced a correct `review.md` (header, summary,
  "Where to paste", 4-backtick comment box).
- Full `review-file` skill run headlessly (`claude -p`) on 6 seeded fixtures: see `us3-eval.md`.

## Still to do by a person

- [ ] Run `/review-comment:review-file <url>` interactively on a GitHub PR and a gitlab.com MR.
- [ ] Paste 3 comment blocks into each platform and confirm they render with "Apply suggestion".
- [ ] Time a ~20-file MR from command to finished `review.md` (SC-001: < 5 min).
