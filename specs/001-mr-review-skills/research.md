# Research: Merge Request Review Skills

All Technical Context unknowns resolved below.

## R1. Plugin packaging and npm distribution

- **Decision**: Repository root is a Claude Code plugin: `.claude-plugin/plugin.json` +
  `skills/<name>/SKILL.md`. Published to npm as `review-comment` (name free on 2026-10-27).
  A `.claude-plugin/marketplace.json` lists the plugin with an npm source
  (`{"source": "npm", "package": "review-comment"}`), so users run
  `/plugin marketplace add <owner>/review-comment` then `/plugin install review-comment`.
- **Rationale**: Clarification Q3 = A (plugin). Plugin skills are namespaced
  (`/review-comment:review-file`), versioned with the plugin, and updated via `/plugin update`,
  which replaces only plugin files (FR-022).
- **Alternatives**: npx installer copying into `~/.claude/skills` (rejected by Q3; no update
  path, files mix with user's skills); GitHub-only marketplace source (works, but user wants npm).
- **Verify at implementation**: confirm the npm marketplace source fields against the current
  Claude Code plugin docs; fall back to `github` source with the same repo if npm source changes.

## R2. Fetching the diff without a clone

- **Decision**: Helper resolves auth in this order: `gh`/`glab` CLI if installed and logged in →
  `GITHUB_TOKEN` / `GITLAB_TOKEN` env → anonymous (public repos only).
  - GitHub: `GET /repos/{o}/{r}/pulls/{n}` (head/base SHA) + `GET .../pulls/{n}/files`
    (paginated, `patch` per file, `status`, `previous_filename`).
  - GitLab: `GET /projects/:id/merge_requests/:iid` (`diff_refs`: base/start/head SHA) +
    `GET .../merge_requests/:iid/diffs` (paginated). `:id` = URL-encoded project path; host taken
    from the MR URL (self-hosted supported).
  - Anonymous mode calls the same REST endpoints without an `Authorization` header (works for
    public projects; GitHub limit 60 requests/hour). This keeps the head SHA available in every
    mode (FR-003, Constitution II). On rate limit (HTTP 403/429 with rate-limit headers) the
    helper exits 2 and tells the user to log in or set a token.
  - Rejected: downloading `.../pull/<n>.diff` / `<mr-url>.diff` — the raw diff carries no head
    SHA, so the reviewed commit could not be recorded.
- **Rationale**: APIs give per-file patches and exact SHAs needed to anchor comments (FR-002,
  FR-003); no clone needed for either mode.
- **Alternatives**: cloning (slower, not needed — spec assumption); scraping web pages (fragile).
- **Note**: `gh`/`glab` are not installed on the dev machine; quickstart lists them as optional.

## R3. Valid comment lines

- **Decision**: Parse each file's unified-diff patch; collect new-side line numbers for added
  (`+`) and context (` `) lines inside hunks. Inline findings must have `line` (and `startLine`
  if a range) in that set, with the whole range inside one hunk.
- **Rationale**: Both platforms only accept inline comments on lines shown in the diff;
  enforcing in code guarantees SC-002/SC-004.
- **Alternatives**: trusting model line numbers (violates Principle II).

## R4. Posting comments

- **Decision**:
  - GitHub: one `POST /repos/{o}/{r}/pulls/{n}/reviews` with `event: "COMMENT"`,
    `commit_id: headSha`, `comments: [{path, line, start_line?, side: "RIGHT", start_side?, body}]`.
    One request = atomic; on 422 retry per comment to isolate failing ones.
  - GitLab: one `POST /projects/:id/merge_requests/:iid/discussions` per finding with
    `position: {position_type: "text", base_sha, start_sha, head_sha, old_path, new_path, new_line}`.
- **Before posting**: re-fetch MR head SHA; if it changed, re-run `lines` and drop findings that
  no longer map (FR-017, Story 2 scenario 4).
- **Rationale**: matches platform APIs; GitHub batch avoids N notification emails.

## R5. Duplicate prevention

- **Decision**: Each comment body ends with a hidden marker
  `<!-- review-comment:v1 rule=<ruleId> file=<path> key=<hash> -->` where `key` = short hash of
  `ruleId + path + normalized code of the commented lines`. Before posting, list existing review
  comments/discussion notes and skip findings whose key already exists.
- **Rationale**: line numbers shift between pushes; hashing the code keeps the key stable (FR-018).
- **Alternatives**: local state file (lost across machines/users).

## R6. Suggested-code blocks

- **Decision**: Output a platform-specific block per finding:
  - GitHub: ```` ```suggestion ```` — user selects the line range (start..end) in the UI
    before pasting.
  - GitLab: ```` ```suggestion:-N+0 ```` where N = `line - startLine` — user comments on the
    last line of the range.
  - When the fix is not a direct line replacement, use a plain language fenced block instead.
- **Rationale**: both platforms render suggestions with "apply" buttons, but the range syntax
  differs (FR-011, SC-003). `review.md` shows only the block for the MR's platform.

## R7. Rule file format

- **Decision**: One Markdown file per language with YAML-like front matter (`language`,
  `prefix`, `version`) and one `###` section per rule with a fixed key list (see
  [contracts/rule-file.md](./contracts/rule-file.md)). `rules/languages.json` maps file
  extensions to rule files.
- **Rationale**: Markdown is read naturally by Claude and humans; fixed keys make lint tests
  possible; adding a language = new `.md` + one map entry (Principle I).
- **Alternatives**: JSON/YAML rules (harder to write examples in; YAML needs a parser dep).

## R8. Rule content sources (per language)

Rules are written in own words with links (Principle V):

| Rule file | Sources |
|-----------|---------|
| general | refactoring.guru (code smells, refactoring techniques), sourcemaking.com (anti-patterns) |
| csharp | refactoring.guru/design-patterns/csharp, mcpmarket .NET C# development expert skill, "10 most common C# code smells" (medium.com/@dgallivan23) |
| go | refactoring.guru/design-patterns/go |
| java | refactoring.guru/design-patterns/java |
| typescript | refactoring.guru/design-patterns/typescript, patterns.dev, frontendpatterns.dev |
| javascript | patterns.dev, sourcemaking.com, frontendpatterns.dev, refactoring.guru |
| react | patterns.dev (React patterns), bulletproof-react (github.com/alan2207/bulletproof-react), frontendpatterns.dev |

Initial target ~15–30 active rules per file, each mapped to a smell, anti-pattern or pattern
misuse that is detectable from a diff.

## R9. Large MRs and skipped files

- **Decision**: `mr.mjs fetch` marks files as skipped with a reason: binary, deleted, lock files
  (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `go.sum`, …), generated/minified
  (`*.min.js`, `dist/`, `build/`, `*.g.cs`, `*.Designer.cs`), or patch missing (too large).
  The skill reviews remaining files in batches of ~10; summary lists skipped files (FR-009).

## R10. Testing strategy

- **Decision**: `node --test` covers URL parsing, diff line mapping, finding validation,
  markdown rendering, dedupe keys, and rule-file lint. Platform calls are tested against recorded
  JSON responses (no network). Fixture eval (`tests/fixtures/eval.mjs`) runs the `review-file`
  skill headlessly via `claude -p` on each seeded diff and reports recall (SC-005 ≥ 80%) and
  wrong-line count (must be 0); it is a release gate, not part of `npm test`.
- **Regression baseline**: per-language recall is stored in `tests/fixtures/baseline.json`.
  The eval fails if any language's recall is below 80% **or** below its baseline
  (Constitution VI: "a drop in detected seeded issues blocks the release"). The baseline is
  raised only by an explicit `--update-baseline` run committed with the release.
