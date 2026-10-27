---

description: "Task list for Merge Request Review Skills"
---

# Tasks: Merge Request Review Skills

**Input**: Design documents from `/specs/001-mr-review-skills/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — required by Constitution VI (fixture-verified behavior) and the plan's
testing strategy (`node --test` for `lib/*` and rule-file lint). No network in unit tests:
platform code is tested against recorded JSON in `tests/unit/recordings/`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4 from spec.md)
- Paths are relative to the repository root (plugin root = npm package root)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Package skeleton loadable with `claude --plugin-dir .`

- [X] T001 Create directories `.claude-plugin/`, `skills/review-file/`, `skills/review-post/`, `rules/`, `bin/`, `lib/`, `tests/unit/recordings/`, `tests/rules/`, `tests/fixtures/` per plan.md Project Structure
- [X] T002 Create `package.json` per contracts/plugin-layout.md: name `review-comment`, version `0.1.0`, `type: module`, `engines.node >=18`, no `dependencies`, `files` list, `bin: { "review-comment-mr": "bin/mr.mjs" }`, `scripts.test: "node --test tests/unit tests/rules"`
- [X] T003 [P] Create `.claude-plugin/plugin.json` per contracts/plugin-layout.md (name `review-comment`, version `0.1.0`, description, license MIT, keywords)
- [X] T004 [P] Add `node_modules/`, `.review-comment/`, `review.md` to `.gitignore` (keep existing `.claude/settings.local.json` line)
- [X] T005 [P] Create `LICENSE` (MIT, author javidselimov12345, year 2026) and `CHANGELOG.md` with an `## [Unreleased]` section listing Added / Changed / Retired rule ids

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: URL parsing, auth, diff line mapping, finding validation, rule-file map and lint — used by both skills

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests (write first, must fail)

- [X] T006 [P] Unit tests for MR URL parsing in `tests/unit/url.test.mjs`: github.com PR, gitlab.com MR, self-hosted GitLab with nested groups (`https://git.example.com/a/b/c/-/merge_requests/7`), URLs with `/files`, `/diffs`, query strings and trailing slashes; unsupported URL throws with exit-code 1 error
- [X] T007 [P] Unit tests for unified diff parsing in `tests/unit/diff.test.mjs`: multiple hunks, added/context/removed lines, `\ No newline at end of file`, new file, deleted file, CRLF patches; returns `validLines` (new-side added+context) and `hunks [{newStart,newEnd}]`
- [X] T008 [P] Unit tests for finding validation in `tests/unit/findings.test.mjs`: line in validLines → `pending`; line outside → `unmapped`; range crossing hunks → `unmapped`; `startLine > line` → invalid; unknown/retired ruleId → invalid; ruleId prefix not in file's ruleFiles → invalid; `general: true` skips line checks; `key` stable when line numbers shift but code is identical
- [X] T009 [P] Rule-file lint tests in `tests/rules/lint.test.mjs` per contracts/rule-file.md: heading format `### <PREFIX>-NNN — <title>`, prefix matches front matter, ids unique across files, required keys present, severity/status enums, ≥1 `https://` source, every file in `rules/languages.json` exists and every `rules/*.md` is listed, ids listed in `tests/rules/published-ids.json` still exist
- [X] T010 [P] Unit tests for language mapping in `tests/unit/languages.test.mjs`: `.cs`→general+csharp, `.go`→general+go, `.java`→general+java, `.ts`→general+typescript, `.tsx`→general+typescript+react, `.jsx`→general+javascript+react, `.py`→general only, skip globs match `package-lock.json`, `dist/app.js`, `x.min.js`, `Form1.Designer.cs`

### Implementation

- [X] T011 [P] Implement `lib/url.mjs` exporting `parseMrUrl(url) → {platform, host, project, number, url}` (GitHub `/<owner>/<repo>/pull/<n>` on `github.com` only; GitLab `/<group…>/<project>/-/merge_requests/<n>` on any host; any other URL → unsupported, exit 1)
- [X] T012 [P] Implement `lib/diff.mjs` exporting `parsePatch(patch) → {validLines, hunks}` and `codeAt(patch, startLine, line) → string` (new-side text of the lines, used for keys)
- [X] T013 [P] Implement `lib/auth.mjs` exporting `resolveAuth({platform, host}) → {kind: "cli"|"token"|"anonymous", request(method, path, body)}`: use `gh api`/`glab api` (via `child_process.execFile`, host passed with `--hostname`) when the CLI exists and `auth status` succeeds; else `GITHUB_TOKEN`/`GITLAB_TOKEN` with built-in `fetch` to `https://api.github.com` or `https://<host>/api/v4`; else anonymous (same REST endpoints via `fetch` without `Authorization`; rate-limit 403/429 → exit 2 with login/token hint); token never written to stdout/stderr or files; errors mapped to exit codes 2/3 per contracts/helper-cli.md
- [X] T014 [P] Create `rules/languages.json` exactly as in contracts/rule-file.md (general + csharp, go, java, typescript, javascript, react, skip globs)
- [X] T015 Implement `lib/languages.mjs` exporting `rulesFor(path, languagesJson) → {language, ruleFiles, skipped?}` with a minimal glob matcher for `*`, `**` (no deps) (depends on T014)
- [X] T016 Implement `lib/rules.mjs` exporting `loadRules(rulesDir) → Map<id, {prefix, severity, status, file}>` parsing front matter and `###` rule sections per contracts/rule-file.md (shared by lint and validate)
- [X] T017 Implement `lib/findings.mjs` exporting `validateFindings(mr, findings, rules) → {report, invalid[]}` and `findingKey(ruleId, path, code)` (sha1 of ruleId+path+whitespace-normalized code, first 12 hex chars) per data-model.md validation rules (depends on T012, T016)
- [X] T018 Create `rules/general.md` with front matter (`language: general`, `prefix: GEN`, `version: 1.0.0`) and initial rules GEN-001…GEN-012 written in own words with source links (refactoring.guru code smells / sourcemaking.com anti-patterns): long method, large class, long parameter list, duplicated code, dead code / commented-out code, magic numbers & strings, unclear naming, swallowed errors, hard-coded secrets, unvalidated external input, missing tests for new logic, feature envy
- [X] T019 [P] Create `rules/csharp.md`, `rules/go.md`, `rules/java.md`, `rules/typescript.md`, `rules/javascript.md`, `rules/react.md` each with correct front matter and one placeholder rule (`<PREFIX>-001`) with all keys and a source link, so lint passes before US3 fills them
- [X] T020 Create `tests/rules/published-ids.json` as `[]` (filled at first release) and make `npm test` pass for T006–T010

**Checkpoint**: `npm test` green; URL/diff/auth/validation/rules libraries ready

---

## Phase 3: User Story 1 - Review into copy-paste `review.md` (Priority: P1) 🎯 MVP

**Goal**: `/review-comment:review-file <url>` writes `review.md` with file, lines, severity, rule id, explanation and platform-correct suggestion blocks; never posts.

**Independent Test**: Run on a public GitHub PR and a gitlab.com MR with known smells; every finding is on a diff line (`mr.mjs lines`), pasted blocks render on both platforms, nothing appears on the MR.

### Tests for User Story 1

- [X] T021 [P] [US1] Record GitHub responses in `tests/unit/recordings/github-pr.json` (PR meta with head/base SHA, 2 pages of `/files` incl. renamed, deleted, binary-without-patch, lockfile) and GitLab responses in `tests/unit/recordings/gitlab-mr.json` (MR with `diff_refs`, `/diffs` pages incl. renamed, deleted, generated file)
- [X] T022 [P] [US1] Unit tests for fetch normalization in `tests/unit/fetch.test.mjs`: recordings → MergeRequest per data-model.md (paths, oldPath, changeType, language, ruleFiles, validLines, skipped reasons), pagination followed, `headSha` present for cli, token and anonymous auth kinds
- [X] T023 [P] [US1] Unit tests for rendering in `tests/unit/render.test.mjs` per contracts/review-md.md: header table, summary counts, skipped-files details, grouping by file then line, 4-backtick outer fence, GitHub ```` ```suggestion ````, GitLab ```` ```suggestion:-N+0 ```` with N = line−startLine, plain language fence when not drop-in, "Not anchored / general notes" section, empty review shows "No findings" and reviewed files; no dedupe marker in output
- [X] T024 [P] [US1] CLI tests in `tests/unit/cli.test.mjs`: `parse-url`, `validate`, `render` happy paths and exit codes 1 (bad URL / invalid finding) using recordings via `REVIEW_COMMENT_RECORDING` env hook (no network)

### Implementation for User Story 1

- [X] T025 [P] [US1] Implement `lib/platform-github.mjs` `fetchMr(auth, ref) → MergeRequest` using `GET /repos/{o}/{r}/pulls/{n}` + paginated `/pulls/{n}/files?per_page=100`; same calls for all auth kinds incl. anonymous, so `headSha` is always recorded (research.md R2)
- [X] T026 [P] [US1] Implement `lib/platform-gitlab.mjs` `fetchMr(auth, ref) → MergeRequest` using `GET /projects/:id/merge_requests/:iid` (`diff_refs`) + paginated `/diffs?per_page=100`, `:id` = URL-encoded project path; same calls for all auth kinds incl. anonymous, so `diff_refs`/`headSha` are always recorded
- [X] T027 [US1] Implement `lib/render.mjs` `renderReview(report) → string` per contracts/review-md.md, including "Where to paste" lines per platform (depends on T023)
- [X] T028 [US1] Implement `bin/mr.mjs` (shebang `#!/usr/bin/env node`) with subcommands `parse-url`, `fetch`, `lines`, `validate`, `render` per contracts/helper-cli.md, using lib modules; `fetch` applies `rulesFor` and `parsePatch`, writes `--out` JSON, prints summary; stderr diagnostics; exit codes 0/1/2/3 (depends on T011–T017, T025–T027)
- [X] T029 [US1] Write `skills/review-file/SKILL.md`: front matter (`name: review-file`, description with trigger phrases "review PR/MR into file", `argument-hint: <mr-url> [output-path]`); steps 1–6 from contracts/skills.md using `node "${CLAUDE_PLUGIN_ROOT}/bin/mr.mjs"`; instruct to read only the rule files listed in each file's `ruleFiles` from `${CLAUDE_PLUGIN_ROOT}/rules/`, apply only `active` rules, report only diff-introduced issues, one ruleId per finding, drop-in suggestions only, batches of ~10 files, re-run `validate` after fixing invalid findings, never call `mr.mjs post`, finish with summary (files reviewed/skipped, findings by severity, output path); accept a local `.diff` path instead of a URL only when `REVIEW_COMMENT_LOCAL_DIFF=1` (test-only, passed straight to `fetch`); keep `.review-comment/` after the run
- [X] T030 [US1] Create a small seeded TypeScript fixture in `tests/fixtures/typescript/change.diff` + `tests/fixtures/typescript/expected.json` (≥3 GEN-* issues: magic number, swallowed error, duplicated code) for manual MVP check of `review-file`
- [ ] T031 [US1] Manually validate quickstart.md Scenario 1 on one public GitHub PR and one gitlab.com MR via `claude --plugin-dir .`, including one MR with ~20 changed files timed from command to finished `review.md` (SC-001: < 5 min); record results (pass/fail, duration, notes) in `specs/001-mr-review-skills/checklists/us1-validation.md`

**Checkpoint**: MVP — file mode works end-to-end on GitHub and GitLab

---

## Phase 4: User Story 2 - Review and post comments (Priority: P2)

**Goal**: `/review-comment:review-post <url>` shows findings, asks once (Post all / Cancel), posts inline comments on exact lines, no duplicates, fallback to `review.md`.

**Independent Test**: On an owned test MR (GitHub and GitLab), comments appear on expected lines; second run posts 0; cancel posts nothing; missing auth posts nothing and writes `review.md`.

### Tests for User Story 2

- [X] T032 [P] [US2] Record posting responses in `tests/unit/recordings/github-post.json` (existing review comments with and without markers, 200 review create, 422 for one comment) and `tests/unit/recordings/gitlab-post.json` (existing discussions/notes, 201 discussion create, 400 position error)
- [X] T033 [P] [US2] Unit tests in `tests/unit/post.test.mjs`: marker format `<!-- review-comment:v1 rule=<id> file=<path> key=<key> -->` appended to body; existing key → `skipped-duplicate`; head SHA changed → re-validate → moved line `unmapped`; GitHub batch payload (`event: COMMENT`, `commit_id`, `side: RIGHT`, `start_line`/`start_side` for ranges); 422 → per-comment retry isolates the failing one as `failed`; GitLab position payload (`position_type: text`, base/start/head SHA, old/new path, `new_line`); `--dry-run` makes no write requests; exit code 4 on partial failure, 2 on 401/403

### Implementation for User Story 2

- [X] T034 [P] [US2] Add to `lib/platform-github.mjs`: `listExistingKeys(auth, ref)` (paginated `/pulls/{n}/comments`, parse markers) and `postReview(auth, ref, headSha, findings)` (single `POST /pulls/{n}/reviews`, per-comment retry on 422) (research.md R4, R5)
- [X] T035 [P] [US2] Add to `lib/platform-gitlab.mjs`: `listExistingKeys(auth, ref)` (paginated `/discussions`, parse markers in notes) and `postDiscussions(auth, ref, diffRefs, findings)` (one `POST /discussions` per finding with text position)
- [X] T036 [US2] Implement `lib/post.mjs` `planAndPost({url, report, dryRun}) → {posted, failed, duplicates, unmapped}`: re-fetch MR, compare head SHA, re-validate if changed, dedupe by key, append marker, call platform post, update finding statuses/errors, never post `unmapped`/`general` findings (depends on T017, T034, T035)
- [X] T037 [US2] Add `post <url> <review.json> [--dry-run]` subcommand to `bin/mr.mjs` per contracts/helper-cli.md; rewrites `review.json` with statuses; exit 4 on partial failure (depends on T036)
- [X] T038 [US2] Extend `lib/render.mjs` for `mode: "post"`: include only `failed`, `unmapped` and `pending` findings with status and error per contracts/review-md.md (depends on T027)
- [X] T039 [US2] Write `skills/review-post/SKILL.md`: front matter (`name: review-post`, description "review and post inline comments to a PR/MR", `argument-hint: <mr-url>`, `disable-model-invocation: true` so it runs only when the user calls it); shared steps 1–5 from contracts/skills.md; step 6 `post --dry-run` and show a table (file, line, severity, rule, title) plus duplicate/unmapped counts; step 7 exactly one AskUserQuestion (Post all / Cancel); cancel → `render` and stop; step 8 `post`; step 9 render leftovers to `review.md`, report counts; on exit 2 tell user `gh auth login` / `glab auth login` / `GITHUB_TOKEN` / `GITLAB_TOKEN` and render `review.md`
- [ ] T040 [US2] Manually validate quickstart.md Scenario 2 on an owned GitHub PR and GitLab MR (post, rerun → 0 posted, cancel, moved lines, no auth); record results in `specs/001-mr-review-skills/checklists/us2-validation.md`

**Checkpoint**: Both modes work; posting is safe, idempotent and falls back to `review.md`

---

## Phase 5: User Story 3 - Language-specific, upgradable rules (Priority: P3)

**Goal**: Full rule sets for C#, Go, Java, TypeScript, JavaScript, React in own words with sources; seeded fixtures per language; eval gate.

**Independent Test**: Add `GO-999` to `rules/go.md` only → `npm test` passes and a Go review cites it; fixture eval recall ≥ 80% per language, 0 wrong-line findings.

### Tests for User Story 3

- [X] T041 [P] [US3] Seeded fixture `tests/fixtures/csharp/change.diff` + `expected.json` (≥5 issues: async void, catch-all swallowing, primitive obsession, god class growth, IDisposable not disposed)
- [X] T042 [P] [US3] Seeded fixture `tests/fixtures/go/change.diff` + `expected.json` (≥5 issues: ignored error, goroutine leak without context, panic in library code, mutex copied by value, overly large interface)
- [X] T043 [P] [US3] Seeded fixture `tests/fixtures/java/change.diff` + `expected.json` (≥5 issues: unclosed resource without try-with-resources, null returned instead of Optional, mutable static state, equals without hashCode, catch Exception)
- [X] T044 [P] [US3] Extend `tests/fixtures/typescript/` with ≥5 TS-* issues (`any` leakage, non-null assertion abuse, unhandled promise, enum vs union misuse, type assertion hiding errors) in `change.diff` + `expected.json`
- [X] T045 [P] [US3] Seeded fixture `tests/fixtures/javascript/change.diff` + `expected.json` (≥5 issues: `==` coercion, callback hell, mutation of arguments, global variable, missing await in async loop)
- [X] T046 [P] [US3] Seeded fixture `tests/fixtures/react/change.diff` + `expected.json` using `.tsx` (≥5 issues: unnecessary useEffect for derived state, missing key, prop drilling through 3+ levels, component >150 lines mixing data fetching and UI, cross-feature import violating bulletproof-react structure)
- [X] T047 [US3] Add local-diff support to `bin/mr.mjs fetch` (path to a `.diff` file when `REVIEW_COMMENT_LOCAL_DIFF=1`, platform `github`, fixed fake SHAs) for fixtures only, as documented test-only in contracts/helper-cli.md (depends on T028)
- [X] T048 [US3] Implement `tests/fixtures/eval.mjs` (depends on T047, T029): for each `tests/fixtures/<lang>/`, run `claude -p "/review-comment:review-file <fixture-path>" --plugin-dir .` with `REVIEW_COMMENT_LOCAL_DIFF=1`, read `.review-comment/review.json`, compute recall (expected `{path,line,ruleId}` matched within ±2 lines and same rule prefix) and wrong-line count; print table; compare with `tests/fixtures/baseline.json` (per-language recall); exit 1 if any language recall < 80%, below its baseline, or wrong-line > 0; `--update-baseline` rewrites `baseline.json` (research.md R10)

### Implementation for User Story 3

- [X] T049 [P] [US3] Write `rules/csharp.md` CS-001…CS-020+ in own words with examples and sources (refactoring.guru/design-patterns/csharp, mcpmarket .NET C# development expert skill, medium.com/@dgallivan23 C# code smells): async void, sync-over-async `.Result`/`.Wait()`, missing `CancellationToken`, IDisposable/`using`, catch-all, exceptions for control flow, primitive obsession, long switch → strategy/polymorphism, god class, static cling/service locator, mutable public fields, LINQ multiple enumeration, string concatenation in loops, nullable warnings suppressed with `!`, magic strings for config, missing DI abstraction, etc.
- [X] T050 [P] [US3] Write `rules/go.md` GO-001…GO-015+ (refactoring.guru/design-patterns/go): ignored errors, error wrapping with `%w`, panics in libraries, context propagation, goroutine leaks, unbuffered channel deadlocks, mutex copy, large interfaces / define interfaces at consumer, init() side effects, global state, constructor with many params → functional options, naked returns in long funcs, etc.
- [X] T051 [P] [US3] Write `rules/java.md` JAVA-001…JAVA-015+ (refactoring.guru/design-patterns/java): try-with-resources, Optional vs null, equals/hashCode, catch Exception/Throwable, mutable statics, singleton misuse, telescoping constructors → builder, instanceof chains → polymorphism, checked exception wrapping, streams side effects, field injection, etc.
- [X] T052 [P] [US3] Write `rules/typescript.md` TS-001…TS-015+ (refactoring.guru/design-patterns/typescript, patterns.dev, frontendpatterns.dev): `any`, non-null `!`, `as` casts, unhandled promises, discriminated unions over flags, enums vs unions, exhaustive switch with `never`, overly wide types, mutable exported state, barrel import cycles, etc.
- [X] T053 [P] [US3] Write `rules/javascript.md` JS-001…JS-015+ (patterns.dev, sourcemaking.com, frontendpatterns.dev, refactoring.guru): `==`, var/global leaks, callback pyramid → async/await, argument mutation, await in loop vs Promise.all, floating promises, prototype pollution via merge, `innerHTML` with user input, module singletons with hidden state, etc.
- [X] T054 [P] [US3] Write `rules/react.md` REACT-001…REACT-020+ (patterns.dev React patterns, github.com/alan2207/bulletproof-react, frontendpatterns.dev): useEffect for derived state/events, missing deps, missing/unstable keys, prop drilling → composition/context, oversized components, data fetching in components without a query layer, cross-feature imports, state colocation, unnecessary global state, inline object/func props causing rerenders where memoized children, uncontrolled↔controlled switch, accessibility (labels, button vs div), `dangerouslySetInnerHTML`, etc.
- [X] T055 [US3] Remove placeholder rules from T019 (or keep as real rules) so each language file has ≥15 active rules; run `npm test` (lint) green
- [X] T056 [US3] Run `node tests/fixtures/eval.mjs`; tune rule `look-for` wording (not fixtures) until every language has recall ≥ 80% and 0 wrong-line findings; then run `node tests/fixtures/eval.mjs --update-baseline` and commit `tests/fixtures/baseline.json`; record results in `specs/001-mr-review-skills/checklists/us3-eval.md`
- [X] T057 [US3] Validate quickstart.md Scenario 3 (add GO-999 only in `rules/go.md`, `npm test` passes, Go review cites GO-999; `.tsx` gets REACT/TS/GEN only), then remove GO-999

**Checkpoint**: All six languages have full rule sets and pass the fixture gate

---

## Phase 6: User Story 4 - Install as a plugin published on npm (Priority: P3)

**Goal**: Users install via marketplace → npm and get both skills; updates replace plugin files only.

**Independent Test**: On a clean machine, `/plugin marketplace add` + `/plugin install review-comment` lists both skills and file mode runs.

- [X] T058 [P] [US4] Unit test `tests/unit/package.test.mjs`: `package.json` version equals `.claude-plugin/plugin.json` version; `dependencies` empty/absent; `files` includes `.claude-plugin/`, `skills/`, `rules/`, `bin/`, `lib/`; both `skills/*/SKILL.md` exist with `name` front matter
- [X] T059 [US4] Verify the npm plugin source format against current Claude Code plugin docs, then create `.claude-plugin/marketplace.json` per contracts/plugin-layout.md (fallback: `github` source to the same repo if npm source is unsupported; note the decision in research.md R1)
- [X] T060 [P] [US4] Write `README.md`: what it does, install (marketplace + `/plugin install`), both skill usages with examples, auth options (`gh`/`glab`, tokens, anonymous public), `review.md` sample, recommend adding `.review-comment/` and `review.md` to `.gitignore`, supported languages and how to add rules/languages, rule id/versioning policy, rule sources with attribution
- [X] T061 [US4] Run `npm pack --dry-run` and confirm the tarball contains only the `files` list (no `specs/`, `.specify/`, `.claude/`, `tests/`)
- [ ] T062 [US4] Fill `tests/rules/published-ids.json` with all active rule ids, update `CHANGELOG.md` `## [0.1.0]` (added rule ids per language), bump nothing else; confirm release gates from constitution (fixtures vs baseline, sources, ids, changelog); do a manual originality review of every `rules/*.md` against its source pages (no copied sentences or code examples, Constitution V) and record it in `specs/001-mr-review-skills/checklists/release-gates.md`
- [ ] T063 [US4] Validate quickstart.md install section on a clean profile: `npm publish` (user runs it, requires npm login), then marketplace add + install, both skills listed, Scenario 1 passes; then update check (FR-022): with `0.1.0` installed and a `review.md` + `.review-comment/` in a work folder, publish a patch version, run `/plugin update review-comment`, confirm new skills/rules load and user files are unchanged; record in `specs/001-mr-review-skills/checklists/us4-install.md`

**Checkpoint**: Package published and installable

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T064 [P] Security pass over `lib/auth.mjs`, `lib/platform-*.mjs`, `bin/mr.mjs`: tokens never in logs/errors/files, requests only to the MR host/API, `execFile` (no shell) with argument arrays, no telemetry; add a unit test asserting error messages redact tokens in `tests/unit/auth.test.mjs`
- [X] T065 [P] Large-MR handling: test with a recording of 300 files in `tests/unit/fetch.test.mjs` (pagination, files without patch marked `skipped: no-patch`), and document batching in both SKILL.md files
- [X] T066 [P] Windows path and CRLF check: run `npm test` on Windows; ensure `bin/mr.mjs` works via `node` with paths containing spaces
- [X] T067 Add GitHub Actions CI `.github/workflows/ci.yml` running `npm test` on Node 18/20/22 for ubuntu and windows
- [ ] T068 Run full quickstart.md validation (all scenarios + error cases table) and fix any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup — blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational; reuses `fetchMr`, `bin/mr.mjs`, `render` from US1 (T025–T028) — implement after US1 or take those tasks first
- **US3 (Phase 5)**: after Foundational; eval (T047, T048, T056) needs US1's `review-file` skill and `bin/mr.mjs`; rule writing (T049–T054) can run in parallel with US1/US2
- **US4 (Phase 6)**: after US1 (minimum shippable); full release after US2 + US3
- **Polish (Phase 7)**: after desired stories

### Within Each Story

- Tests/recordings first, confirm failing, then lib → CLI → SKILL.md → manual validation

### Parallel Opportunities

- Setup: T003, T004, T005
- Foundational tests T006–T010 all [P]; libs T011–T014 [P]
- US1: T021–T024 [P]; T025 ‖ T026
- US2: T032 ‖ T033; T034 ‖ T035
- US3: fixtures T041–T046 [P]; rule files T049–T054 [P] (six independent files)
- US4: T058 ‖ T060

## Parallel Example: User Story 3

```bash
Task: "Write rules/csharp.md CS-001…CS-020+"
Task: "Write rules/go.md GO-001…GO-015+"
Task: "Write rules/java.md JAVA-001…JAVA-015+"
Task: "Write rules/typescript.md TS-001…TS-015+"
Task: "Write rules/javascript.md JS-001…JS-015+"
Task: "Write rules/react.md REACT-001…REACT-020+"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational (`npm test` green)
2. Phase 3 US1 → validate file mode on GitHub + GitLab with general rules
3. Optionally publish `0.1.0` early (T058–T063) as file-mode-only

### Incremental Delivery

1. MVP (US1) → `0.1.0`
2. US2 posting → `0.2.0`
3. US3 full language rules + eval gate → `0.3.0`
4. Polish + CI → `1.0.0`

## Notes

- [P] = different files, no dependency on incomplete tasks
- Rule text in own words only; every rule has a source link (Constitution V)
- Never change or reuse a rule id; retire instead (Constitution VII)
- Commit after each task or logical group (Conventional Commits)
