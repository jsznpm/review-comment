---
name: review-file
description: Review a GitHub pull request or GitLab merge request and write review.md with copy-paste comments (file, line, severity, rule, suggested code). Never posts anything. Use when the user wants a PR/MR reviewed into a file, or cannot or does not want to post comments directly.
argument-hint: <mr-url> [output-path]
allowed-tools: Read, Write, Bash(node:*)
---

# Review a merge request into `review.md`

You review the diff of one GitHub pull request or GitLab merge request against this plugin's
rule files and write `review.md`. Every comment in it can be copied into the GitHub/GitLab
web UI by hand. **You never post, comment, approve or push anything** — this skill has no
posting step.

## Setup

- `PLUGIN_ROOT` = two directories above this skill's base directory (the folder that contains
  `bin/`, `lib/` and `rules/`).
- `HELPER` = `node "<PLUGIN_ROOT>/bin/mr.mjs"` — always quote paths, they may contain spaces.
- `WORK` = `.review-comment/` in the current working directory. Keep it after the run.
- Arguments: `$ARGUMENTS` → first = merge request URL, second (optional) = output path,
  default `./review.md`. If no URL is given, ask for it and stop.
- Test-only: when the environment has `REVIEW_COMMENT_LOCAL_DIFF=1`, the first argument may be
  a path to a local `.diff` file instead of a URL; pass it to `fetch` unchanged.

## Steps

1. **Fetch** — `HELPER fetch <url> --out .review-comment/mr.json`
   - Exit 1: bad URL. Exit 2: needs login or token. Exit 3: not found or unreachable.
     On any non-zero exit, show the error message to the user, write no `review.md`, and stop.
   - The JSON on stdout lists `reviewable` files with their `ruleFiles` and commentable
     `lines`, and `skippedFiles` with reasons. Read it.

2. **Load rules** — for the set of all `ruleFiles` across reviewable files, read each one from
   `<PLUGIN_ROOT>/rules/` once. Use only rules with `status: active`. A `.tsx`/`.jsx` file gets
   general + TypeScript/JavaScript + React rules, as listed in its `ruleFiles`.

3. **Review** — read the patches in `.review-comment/mr.json` (`files[].patch`), in batches of
   about 10 files for large merge requests. For each issue you find:
   - Report only problems **introduced or touched by this diff**, not old code around it.
   - Anchor it to new-side line numbers from the file's `lines` / `validLines`. If an issue is
     real but not on a commentable line, make it a general note (`"general": true`).
   - Cite exactly one `ruleId`. Prefer the most specific language rule; use `GEN-*` only when
     no language rule fits. Never invent rule ids. If no rule fits at all, do not report it.
   - Write `body` as a short, friendly review comment in Markdown: what is wrong, why it
     matters (from the rule's `why`), and what to do. 1–4 sentences. No rule-file text dumps.
   - Add `suggestion` only when it is a drop-in replacement for exactly lines
     `startLine..line` (or `line`) of the new file. Keep the file's indentation (tabs or
     spaces) and line endings style. If the fix is not a direct replacement, either omit
     `suggestion` or set `"dropIn": false` and give an illustrative snippet.
   - Do not report the same problem twice; for a repeated pattern report the first occurrence
     and mention the others in its body.
   - Skip files listed in `skippedFiles`.
   - Severity: use the rule's default unless the concrete case is clearly more or less serious.

4. **Write findings** — save a JSON array to `.review-comment/findings.json`:

   ```json
   [
     {
       "path": "src/Orders/OrderService.cs",
       "startLine": 42,
       "line": 45,
       "ruleId": "CS-001",
       "severity": "major",
       "title": "Async void method",
       "body": "Exceptions thrown here can't be caught by callers and will crash the process. Return `Task` instead.",
       "suggestion": "public async Task SaveAsync()\n{\n    await _repo.SaveAsync(order);\n}"
     },
     {
       "general": true,
       "path": "src/Orders/OrderService.cs",
       "ruleId": "GEN-011",
       "title": "New discount logic has no tests",
       "body": "Please add tests for the 100-unit threshold, including exactly 100."
     }
   ]
   ```

   `startLine` is optional (single-line findings omit it). Required: `path` (unless general),
   `line` (unless general), `ruleId`, `title`, `body`.

5. **Validate** — `HELPER validate .review-comment/mr.json .review-comment/findings.json --out .review-comment/review.json`
   - Exit 1 lists `invalid` findings with the reason: fix those entries (wrong rule for the
     file's language, unknown rule id, bad fields) and run validate again. Never "fix" a line
     number by guessing — re-read the patch, or turn the finding into a general note.
   - `unmapped` findings are kept and shown in a separate section; that is fine.

6. **Render** — `HELPER render .review-comment/review.json --out <output-path>`

7. **Report** to the user, briefly:
   - output path, merge request, reviewed commit (short SHA);
   - files reviewed / skipped (with reasons in one line if any);
   - findings per severity, and the top 3 findings (file:line — rule — title);
   - remind that comments are pasted manually: each finding says where to click.

Do not paste the whole `review.md` into the chat.
