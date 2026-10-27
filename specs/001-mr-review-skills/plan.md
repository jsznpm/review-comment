# Implementation Plan: Merge Request Review Skills

**Branch**: `001-mr-review-skills` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-mr-review-skills/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Ship one Claude Code plugin, `review-comment`, published to npm, with two skills:

- `review-file` — reviews a GitHub PR / GitLab MR diff and writes `review.md` with copy-paste
  comment blocks (file, line, severity, rule id, explanation, suggested code). Never posts.
- `review-post` — same review, shows findings, asks once (post all / cancel), then posts inline
  comments in a single batch; anything not posted falls back to `review.md`.

The review reasoning is done by Claude, guided by per-language Markdown rule files
(C#, Go, Java, TypeScript, JavaScript, React + general). Everything deterministic — fetching the
diff, mapping valid diff lines, rendering `review.md`, building/posting platform payloads,
duplicate detection — is done by one dependency-free Node.js helper script (`bin/mr.mjs`) so
line mapping is exact and testable. No clone is needed: diffs, file lists and SHAs come from the
GitHub/GitLab REST APIs via `gh`/`glab`, an env token, or unauthenticated calls for public repos.

## Technical Context

**Language/Version**: Node.js ≥ 18 (ES modules, built-in `fetch`, `node:test`); skills in Markdown (`SKILL.md`)

**Primary Dependencies**: none at runtime (Node built-ins only). Optional external CLIs used when present: `gh` (GitHub CLI), `glab` (GitLab CLI)

**Storage**: files only — rule files in the plugin; `review.md` in the user's working directory; intermediate JSON (`mr.json`, `findings.json`, `review.json`) in `.review-comment/` in the working directory, kept after the run for debugging

**Testing**: `node --test` for helper script and rule-file lint; fixture diffs per language with expected findings; semi-automated fixture eval via `claude -p` before release

**Target Platform**: Claude Code (CLI/desktop/IDE) on Windows, macOS, Linux

**Project Type**: Claude Code plugin (skills + rule data + helper CLI), distributed as an npm package

**Performance Goals**: `review.md` for a ≤ 20-file MR in < 5 min (SC-001); helper script operations < 5 s excluding network

**Constraints**: no clone; no runtime npm dependencies; no credential storage/printing; no telemetry; inline findings only on diff lines (new side)

**Scale/Scope**: v1 — 2 skills, 7 rule files (~15–30 rules each), 6 languages, 2 platforms; MRs up to ~300 files (larger MRs are reviewed in batches with skipped files listed)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the design complies | Status |
|-----------|-------------------------|--------|
| I. Rules as Data | Rules in `rules/<lang>.md`; extension → rule file map in `rules/languages.json`; skills read whatever the map lists | PASS |
| II. Diff-Anchored Findings | `mr.mjs lines` returns valid new-side lines per file; `mr.mjs validate` rejects findings outside them; every finding has `ruleId` + `headSha` | PASS |
| III. Safe by Default | `review-file` has no post path; `review-post` uses a single confirm, posts one batched review, writes unposted findings to `review.md`; hidden marker prevents duplicates | PASS |
| IV. Credential Hygiene | Auth via `gh`/`glab` session or `GITHUB_TOKEN`/`GITLAB_TOKEN` env; token never logged or written; requests go only to the MR's host; no telemetry | PASS |
| V. Original, Attributed Content | Rule format requires `sources:` links; lint test fails on missing source; rules written in own words | PASS |
| VI. Fixture-Verified Behavior | `tests/fixtures/<lang>/` seeded diffs + `expected.json`; eval script reports recall + wrong-line count | PASS |
| VII. Stable IDs & SemVer | Id pattern `<PREFIX>-NNN`, `status: active|retired`; lint checks uniqueness and that ids in previous release still exist; `CHANGELOG.md` | PASS |
| Packaging constraints | One plugin, two skills, npm; GitHub + GitLab (self-hosted via host in URL); 6 languages; no clone; no runtime deps | PASS |

No violations → Complexity Tracking empty.

**Post-design re-check (after Phase 1)**: PASS — contracts keep posting isolated in `mr.mjs post`
(only called by `review-post`), rule format enforces sources and stable ids, and `review.md` is
written by the script from validated JSON, so wrong-line findings cannot reach either output.

## Project Structure

### Documentation (this feature)

```text
specs/001-mr-review-skills/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── plugin-layout.md     # plugin.json, marketplace.json, npm package contract
│   ├── skills.md            # skill names, inputs, outputs, behavior
│   ├── helper-cli.md        # bin/mr.mjs subcommands, args, JSON I/O, exit codes
│   ├── rule-file.md         # rules/<lang>.md + languages.json format
│   └── review-md.md         # review.md / review.json output format
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
.claude-plugin/
├── plugin.json              # plugin manifest (name: review-comment)
└── marketplace.json         # marketplace entry pointing to the npm package

skills/
├── review-file/
│   └── SKILL.md             # file mode: diff → findings → review.md
└── review-post/
    └── SKILL.md             # posting mode: diff → findings → confirm → post / fallback

rules/
├── languages.json           # extension → rule files map, rule-id prefixes
├── general.md               # GEN-*: naming, dead code, duplication, errors, security, tests
├── csharp.md                # CS-*
├── go.md                    # GO-*
├── java.md                  # JAVA-*
├── typescript.md            # TS-*
├── javascript.md            # JS-*
└── react.md                 # REACT-* (applied together with JS/TS rules)

bin/
└── mr.mjs                   # helper CLI: parse-url, fetch, lines, validate, render, post

lib/
├── url.mjs                  # MR URL parsing (github.com, gitlab.com, self-hosted)
├── platform-github.mjs      # fetch diff/meta, existing comments, post review
├── platform-gitlab.mjs      # fetch changes/diff_refs, discussions, post discussions
├── auth.mjs                 # gh/glab → env token → anonymous resolution
├── diff.mjs                 # unified diff parser → valid new-side line sets
├── findings.mjs             # finding schema validation, marker/dedupe key
└── render.mjs               # review.json → review.md (GitHub + GitLab blocks)

tests/
├── unit/                    # node:test for lib/*
├── rules/                   # rule-file lint (ids, prefixes, sources, status)
└── fixtures/
    ├── csharp/ go/ java/ typescript/ javascript/ react/
    │   ├── change.diff
    │   └── expected.json    # seeded issues: file, line, ruleId
    └── eval.mjs             # runs review-file via `claude -p`, scores recall + wrong lines

package.json                 # name review-comment, files[], bin, engines, no deps
CHANGELOG.md
README.md
LICENSE
```

**Structure Decision**: Single Claude Code plugin at the repository root (plugin root = npm
package root). Skills contain only instructions; deterministic work lives in `bin/` + `lib/`;
review knowledge lives in `rules/`. This keeps Principle I (rules editable without touching
skills) and Principle II (exact line mapping in tested code, not in model output).

## Complexity Tracking

No constitution violations.
