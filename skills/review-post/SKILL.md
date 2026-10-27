---
name: review-post
description: Review a GitHub pull request or GitLab merge request and post the findings as inline comments, after one confirmation. Anything not posted is written to review.md. Use only when the user explicitly asks to post review comments to a PR/MR.
argument-hint: <mr-url>
disable-model-invocation: true
allowed-tools: Read, Write, Bash(node:*)
---

# Review a merge request and post inline comments

Same review as the `review-file` skill, then the findings are posted as inline comments on
the merge request — **only after the user confirms once**. Posting is public and hard to
undo, so follow the steps exactly.

## Setup

- `PLUGIN_ROOT` = two directories above this skill's base directory (the folder that contains
  `bin/`, `lib/` and `rules/`).
- `HELPER` = `node "<PLUGIN_ROOT>/bin/mr.mjs"` — always quote paths.
- `WORK` = `.review-comment/` in the current working directory. Keep it after the run.
- Argument: `$ARGUMENTS` = merge request URL. If missing, ask for it and stop.

## Steps 1–5: review (identical to `review-file`)

1. `HELPER fetch <url> --out .review-comment/mr.json` — on a non-zero exit show the message and
   stop (exit 2 = login or token needed, exit 3 = not found).
2. Read the `ruleFiles` listed for the reviewable files from `<PLUGIN_ROOT>/rules/`; use only
   `status: active` rules.
3. Review the patches. Only issues introduced or touched by the diff; one `ruleId` per finding
   (most specific language rule, `GEN-*` otherwise, never invented); new-side line numbers from
   the file's commentable lines; short friendly Markdown `body`; `suggestion` only as a drop-in
   replacement for lines `startLine..line`, keeping the file's indentation; real issues off the
   diff become `"general": true` notes.
4. Save the JSON array to `.review-comment/findings.json` (same schema as `review-file`:
   `path`, optional `startLine`, `line`, `ruleId`, `severity`, `title`, `body`, optional
   `suggestion` / `dropIn`, or `general: true`).
5. `HELPER validate .review-comment/mr.json .review-comment/findings.json --out .review-comment/review.json --mode post`
   — on exit 1 fix the listed invalid findings and re-run; never guess line numbers.

## Step 6: dry run

`HELPER post <url> .review-comment/review.json --dry-run`

It re-checks the merge request head, finds comments already posted by an earlier run, and
prints `toPost`, `duplicates`, `unmapped`, `generalNotes`, plus `canPost`.

- If `toPost` is empty: render (step 9) and tell the user nothing new needs posting.
- If `canPost` is false (no credentials): do not ask; render (step 9) and tell the user to
  run `gh auth login` / `glab auth login --hostname <host>` or set `GITHUB_TOKEN` /
  `GITLAB_TOKEN`, then run the skill again.

## Step 7: one confirmation

Show a compact table of everything in `toPost`:

| # | File | Line(s) | Severity | Rule | Title |
|---|------|---------|----------|------|-------|

Add one line with the counts of duplicates (already posted), unmapped and general notes —
those will not be posted and go to `review.md`.

Then ask exactly **one** question with the AskUserQuestion tool:
"Post these N comments to <merge request URL>?" — options **Post all** and **Cancel**.
Do not post one by one, do not ask follow-up questions, do not edit findings after this point.

- **Cancel** → skip step 8; render (step 9); say that nothing was posted.

## Step 8: post

`HELPER post <url> .review-comment/review.json`

It posts in one batch (GitHub review / GitLab discussions), adds a hidden marker to each
comment so re-runs skip it, never posts on a line that no longer matches the code, and updates
`.review-comment/review.json` with each finding's status.

- Exit 0: all posted. Exit 4: some failed (listed in `review.md`). Exit 2: credentials or
  permission problem — nothing more was posted; tell the user which login/token is needed.
- Do not retry automatically.

## Step 9: render leftovers

`HELPER render .review-comment/review.json --out review.md`

In post mode `review.md` contains only findings that were **not** posted (failed, unmapped,
cancelled, general notes), each with copy-paste comment blocks and the reason.

## Step 10: report

Briefly: posted / already posted / failed / not anchored / general notes counts, the merge
request URL, the reviewed commit (short SHA), and the `review.md` path if it has content.
