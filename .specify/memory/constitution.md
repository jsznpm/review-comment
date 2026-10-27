<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: all placeholders replaced (initial adoption)
  - [PRINCIPLE_1_NAME] → I. Rules as Data
  - [PRINCIPLE_2_NAME] → II. Diff-Anchored Findings
  - [PRINCIPLE_3_NAME] → III. Safe by Default
  - [PRINCIPLE_4_NAME] → IV. Credential Hygiene
  - [PRINCIPLE_5_NAME] → V. Original, Attributed Rule Content
- Added principles: VI. Fixture-Verified Behavior, VII. Stable IDs & Semantic Versioning
- Added sections: Packaging & Platform Constraints, Development Workflow & Quality Gates
- Removed sections: none
- Templates: plan/spec/tasks templates read the constitution at runtime; no edits made here.
- Deferred TODOs: none
-->

# review-comment Constitution

## Core Principles

### I. Rules as Data

- Review rules MUST live in separate, human-editable rule files, one file per language plus one
  shared general rule file.
- Adding, changing or retiring a rule, or adding a new language, MUST NOT require changes to the
  skill instructions.
- Skills MUST select rule files by detected file language; a `.jsx`/`.tsx` file loads both the
  React and the JavaScript/TypeScript rules.

Rationale: the rule sets are the product and must grow over time without touching the skills.

### II. Diff-Anchored Findings

- Every inline finding MUST point to a file path and line range that exist in the reviewed diff,
  in the new version of the file.
- Issues outside the diff MAY be reported only as clearly separated general notes, never as
  inline comments.
- Every finding MUST cite a rule id and record the commit it was reviewed against.
- A finding whose line cannot be mapped to the current diff MUST NOT be posted; it is reported
  and kept in `review.md`.

Rationale: a comment on the wrong line costs reviewer trust and is worse than no comment.

### III. Safe by Default

- The file mode (`review.md`) MUST never write anything to GitHub or GitLab.
- The posting mode MUST show all findings and get one explicit user confirmation
  (post all / cancel) before posting anything.
- On cancel, missing permission, or any posting failure, findings MUST fall back to `review.md`;
  no finding is lost.
- Re-running a review on the same merge request MUST NOT create duplicate comments.

Rationale: comments are public, outward-facing actions that are hard to undo.

### IV. Credential Hygiene

- Skills MUST use only the user's existing platform credentials (logged-in CLI or token already
  configured on the machine).
- Skills MUST NOT store, print, log, or send credentials anywhere other than the platform they
  belong to.
- The package MUST NOT ship any telemetry or send review content to third-party services.

Rationale: the tool runs on private code with the user's identity.

### V. Original, Attributed Rule Content

- Rule text MUST be written in this project's own words; no verbatim copying from source sites
  (refactoring.guru, sourcemaking.com, patterns.dev, frontendpatterns.dev, bulletproof-react,
  the .NET C# expert skill, C# code smell articles, or others).
- Each rule MUST link to the source(s) it is based on.
- Code examples in rules MUST be original.

Rationale: keeps the npm package legally publishable and lets users read the full source.

### VI. Fixture-Verified Behavior

- Each supported language (C#, Go, Java, TypeScript, JavaScript, React) MUST have at least one
  seeded test diff with known issues and the expected findings.
- A change to a rule file or a skill MUST be checked against the fixtures before release;
  a drop in detected seeded issues or any wrong-line finding blocks the release.
- `review.md` output format MUST be checked to render as valid GitHub and GitLab comment Markdown.

Rationale: review quality is otherwise invisible until users hit wrong findings.

### VII. Stable IDs & Semantic Versioning

- Rule ids (e.g. `CS-012`, `GO-004`, `GEN-003`) MUST never change meaning or be reused; retired
  rules are marked `retired`, not deleted.
- The package follows semantic versioning:
  - MAJOR: changes to the `review.md` format, skill names, or removal of a language.
  - MINOR: new rules, new languages, new options.
  - PATCH: rule wording, false-positive fixes, documentation.
- Every release MUST have a changelog entry listing added, changed and retired rule ids.

Rationale: users and their teams refer to rule ids in comments and discussions.

## Packaging & Platform Constraints

- Delivery format: one Claude Code plugin containing exactly two skills (file mode and posting
  mode) plus all rule files, published to npm and installed through the plugin install flow.
- Supported platforms for v1: GitHub (github.com) and GitLab (gitlab.com and self-hosted).
  Others are out of scope until amended.
- Supported languages for v1: C#, Go, Java, TypeScript, JavaScript, React. Angular is out of
  scope for v1 and may be added later as a new rule file (MINOR release).
- Neither mode MAY require cloning the repository; diffs and line numbers come from the platform.
- Plugin updates MUST NOT delete or modify user files such as earlier `review.md` outputs.
- Simplicity first: no new runtime dependency is added unless a skill cannot meet a requirement
  without it; the reason is recorded in the plan.

## Development Workflow & Quality Gates

- Work follows Spec Kit: spec → plan → tasks → implement; each plan includes a Constitution Check
  against principles I–VII.
- Every change goes through a pull request; the reviewer confirms constitution compliance.
- Release gates (all MUST pass before `npm publish`):
  1. Fixture reviews for all languages pass (Principle VI).
  2. No rule without a source link or with copied text (Principle V).
  3. No rule id reused or renamed (Principle VII).
  4. Changelog and version bump present and consistent with the change type.
- Commit messages follow Conventional Commits.

## Governance

- This constitution supersedes other project practices; conflicts are resolved in its favor.
- Amendments are made via pull request that edits this file, includes an updated Sync Impact
  Report, and bumps the constitution version:
  - MAJOR: removing or redefining a principle.
  - MINOR: adding a principle or section, or materially expanding guidance.
  - PATCH: wording and clarification only.
- Any deviation from a principle MUST be justified in the plan's Complexity Tracking section.
- Compliance is reviewed at every plan (Constitution Check) and before every release.

**Version**: 1.0.0 | **Ratified**: 2026-10-27 | **Last Amended**: 2026-10-27
