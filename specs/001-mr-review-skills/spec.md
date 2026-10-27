# Feature Specification: Merge Request Review Skills

**Feature Branch**: `001-mr-review-skills`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Build a plugin or skill package, publish it to npm. Main goal: review a GitHub or GitLab merge request and write comments automatically. Two modes: (1) review the MR and post comments to it; (2) review the GitHub/GitLab diff and write a review.md file showing the file name, line numbers and alternative code for each comment, so the user can copy each part into the comment box by hand — because posting by commit hash may not be possible. Two skills inside one plugin. Mode 1 may need a repo clone; mode 2 is simpler. Languages: C#, Go, Java, React, TypeScript, JavaScript. Language-specific review rules based on frontendpatterns.dev, sourcemaking.com, patterns.dev, refactoring.guru, bulletproof-react (React/JS/TS), mcpmarket .NET C# expert, the '10 most common C# code smells' article, refactoring.guru C#/Go/Java/TypeScript design patterns. Rules must be upgradable in the future."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review a merge request into a copy-paste review file (Priority: P1)

A developer gives the assistant a link to a GitHub pull request or GitLab merge request. The review skill reads the diff, applies the review rules for each changed file's language, and writes a `review.md` file. Each finding in the file shows the file path, the line number(s), the severity, a short explanation, the rule it comes from, and a suggested replacement code block. The developer opens the file, copies each finding, and pastes it as a comment on the matching line in the GitHub/GitLab web UI.

**Why this priority**: This mode works without write access to the merge request, without posting by commit hash, and without cloning. It is the simplest path to value and works on any repository the user can view.

**Independent Test**: Point the skill at a public pull request that contains known code smells in a supported language; confirm `review.md` is created, every finding names an existing file and a line that is part of the diff, and each finding's comment text can be pasted into the platform without editing.

**Acceptance Scenarios**:

1. **Given** a GitHub pull request link the user can read, **When** the user runs the file-review skill, **Then** a `review.md` file is written with one section per finding, grouped by file, each with file path, line number(s), severity, explanation, rule reference and suggested code.
2. **Given** a GitLab merge request link (gitlab.com or a self-hosted GitLab), **When** the user runs the file-review skill, **Then** the same `review.md` format is produced.
3. **Given** a finding in `review.md`, **When** the user copies its comment block, **Then** the pasted text renders correctly as a comment on GitHub and GitLab (Markdown with a fenced code block or suggestion block).
4. **Given** a diff with no issues found, **When** the skill finishes, **Then** `review.md` states that no findings were raised and lists which files were reviewed.

---

### User Story 2 - Review a merge request and post comments automatically (Priority: P2)

A developer gives the assistant a link to a pull/merge request on which they have comment rights. The review skill reads the diff, applies the same rules as Story 1, shows the user the list of findings, and posts each approved finding as an inline comment on the correct file and line of the merge request.

**Why this priority**: Saves the manual copy-paste step, but depends on the user's platform permissions and credentials, so it is second to the file mode that always works.

**Independent Test**: On a test repository the user owns, open a merge request with known issues, run the posting skill, and confirm inline comments appear on the expected lines with the expected text.

**Acceptance Scenarios**:

1. **Given** a merge request the user can comment on, **When** the user runs the posting skill and confirms "post all", **Then** each finding appears as an inline comment on the matching file and line.
2. **Given** the findings list is shown, **When** the user cancels, **Then** nothing is posted and all findings are written to `review.md`.
3. **Given** the user lacks permission or credentials, **When** the skill tries to post, **Then** nothing is posted, the user is told why, and the findings are written to `review.md` instead (fallback to Story 1).
4. **Given** a finding whose line can no longer be mapped to the current diff (merge request updated since review), **When** posting, **Then** that finding is not posted on a wrong line; it is reported to the user and kept in `review.md`.
5. **Given** the skill was already run on the same merge request, **When** it runs again, **Then** it does not post duplicate comments for findings already posted.

---

### User Story 3 - Language-specific, upgradable review rules (Priority: P3)

The package ships a separate rule set per supported language (C#, Go, Java, TypeScript, JavaScript, React). Each rule has an id, title, severity, what to look for, why it matters, a suggested fix pattern, and a link to the source it is based on. A maintainer can add, change or retire rules, or add a new language, by editing the rule files only, and publish a new package version.

**Why this priority**: Rule quality drives the value of both skills, but the skills can launch with a first rule set and grow over time.

**Independent Test**: Add a new rule to one language's rule file without changing anything else; run a review on a diff that triggers it and confirm the new rule id appears in the findings.

**Acceptance Scenarios**:

1. **Given** a diff containing files in several supported languages, **When** reviewed, **Then** each file is reviewed only with the rules for its language (plus shared general rules), and each finding cites its rule id.
2. **Given** a file in an unsupported language, **When** reviewed, **Then** only general rules apply and the summary says the language has no specific rule set.
3. **Given** a maintainer adds a rule file for a new language, **When** a new version is installed, **Then** files in that language are reviewed with it without changes to the skills.
4. **Given** a React file (`.jsx`/`.tsx`), **When** reviewed, **Then** both the React rules and the JavaScript/TypeScript rules apply.

---

### User Story 4 - Install as a plugin published on npm (Priority: P3)

A developer adds the plugin's marketplace entry and installs the plugin, which is published on npm; both skills become available in their assistant. Updating the plugin updates the skills and rules.

**Why this priority**: Distribution is required to share the tool, but the skills can be developed and tested locally first.

**Independent Test**: On a clean machine, install the plugin through the assistant's plugin install flow, and confirm both skills are listed and run.

**Acceptance Scenarios**:

1. **Given** a machine with the assistant installed, **When** the user installs the plugin, **Then** both skills and the rule sets are available.
2. **Given** an installed older version, **When** the user updates the plugin, **Then** the skills and rules are replaced with the new ones and user files (such as previous `review.md` outputs) are not touched.

### Edge Cases

- Very large merge requests (hundreds of files or many thousands of changed lines): the review covers all files or states clearly which files were skipped and why.
- Deleted files, renamed files, binary files and generated files (lock files, minified bundles, build output): skipped or reviewed only where meaningful, and listed in the summary.
- A finding on a line that was not changed in the diff: not reported as an inline comment (platforms only accept comments on diff lines); may be mentioned as a general note.
- Private repositories without credentials: the user gets a clear message about what access is needed.
- Invalid or unreachable merge request link: the user gets a clear error, no file is written.
- `review.md` already exists: the user is not silently left with old content; the file is overwritten with a clear header (merge request, date, commit reviewed) or a new file name is used.
- Merge request updated between review and posting: line mapping is rechecked before posting.
- Mixed line endings or tabs in suggested code: suggested code keeps the original file's indentation style.

## Requirements *(mandatory)*

### Functional Requirements

**Input & diff**

- **FR-001**: Both skills MUST accept a GitHub pull request link or a GitLab merge request link (gitlab.com and self-hosted GitLab) as input.
- **FR-002**: Both skills MUST obtain the merge request's changed files, diff hunks and line numbers without requiring the user to clone the repository.
- **FR-003**: The skills MUST record which commit of the merge request was reviewed, so findings can be tied to an exact version.

**Review**

- **FR-004**: The skills MUST detect each changed file's language and apply the rule set for that language plus a shared general rule set.
- **FR-005**: The package MUST include rule sets for C#, Go, Java, TypeScript, JavaScript and React. Angular has no separate rule set; frontendpatterns.dev is used as a pattern source for the TypeScript/JavaScript/React rules.
- **FR-006**: Each finding MUST include: file path, start and end line in the new version of the file, severity (e.g. blocker / major / minor / suggestion), rule id, a short explanation of the problem and why it matters, and suggested replacement code when a concrete fix exists.
- **FR-007**: Findings MUST only target lines that are part of the diff; issues outside the diff MAY be listed as general notes, clearly separated.
- **FR-008**: Each rule MUST reference the source (site/article) it is based on; rules MUST be written in the package's own words, not copied text from the sources.
- **FR-009**: The review MUST produce a summary: number of files reviewed, files skipped with reason, number of findings per severity.

**File mode (Story 1)**

- **FR-010**: The file-review skill MUST write a `review.md` file in the user's current working directory, unless the user names another path.
- **FR-011**: Each finding in `review.md` MUST contain a ready-to-paste comment block that renders correctly as a GitHub and GitLab comment, kept separate from the location info (file, line) the user needs to find the spot.
- **FR-012**: `review.md` MUST start with a header naming the merge request, platform, reviewed commit and review date.
- **FR-013**: The file-review skill MUST NOT post anything to the platform.

**Posting mode (Story 2)**

- **FR-014**: The posting skill MUST post each finding as an inline comment on the matching file and line of the merge request.
- **FR-015**: Before posting, the posting skill MUST show the user the full list of findings (file, line, severity, comment text) and ask one confirmation question: post all, or cancel. Nothing is posted until the user confirms; on cancel, findings are written to `review.md` instead.
- **FR-016**: The posting skill MUST use the user's own existing platform credentials and MUST NOT store, print or send credentials anywhere else.
- **FR-017**: If posting fails for any finding (permissions, line no longer in diff, network), the skill MUST NOT post it on a different line, MUST report it, and MUST write all unposted findings to `review.md`.
- **FR-018**: The posting skill MUST avoid duplicate comments when run again on the same merge request.

**Rules & packaging**

- **FR-019**: Rule sets MUST be stored as separate, human-editable files per language so that adding, changing or retiring a rule or adding a language needs no change to the skills.
- **FR-020**: Each rule MUST have a stable id that does not change between versions; retired rules MUST be marked rather than reused.
- **FR-021**: The package MUST be a Claude Code plugin containing both skills and all rule sets in one plugin, published to npm, and installable through the assistant's plugin install flow from a marketplace entry that points to the npm package.
- **FR-022**: Updating the plugin to a newer version MUST replace bundled skills and rules without deleting user-created files (such as earlier `review.md` outputs).

### Key Entities

- **Merge Request**: The pull/merge request under review — platform (GitHub/GitLab), host, project, number, reviewed commit, list of changed files.
- **Changed File**: A file in the diff — path, old path (if renamed), language, change type (added/modified/deleted/renamed), diff hunks with line numbers.
- **Rule**: A review rule — id, language, title, severity, what to look for, why it matters, fix pattern, source link, status (active/retired).
- **Rule Set**: All rules for one language, plus the shared general rule set.
- **Finding**: One review result — file, line range, severity, rule id, explanation, suggested code, posting status (not posted / posted / failed).
- **Review Report (`review.md`)**: Header (merge request, commit, date), summary, and findings grouped by file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a merge request of up to 20 changed files, the user gets a complete `review.md` in under 5 minutes.
- **SC-002**: 100% of findings point to a file and line that exist in the reviewed diff (no findings on wrong or non-diff lines).
- **SC-003**: 100% of comment blocks in `review.md` paste into GitHub and GitLab and render correctly without manual editing.
- **SC-004**: In posting mode, 100% of posted comments land on the intended line; zero comments are posted on a wrong line.
- **SC-005**: On a seeded test merge request per supported language containing known issues, at least 80% of the seeded issues are reported.
- **SC-006**: At most 20% of findings on real merge requests are judged by the user as wrong or not useful.
- **SC-007**: A maintainer can add a new rule and see it applied in under 15 minutes, editing only the rule files.
- **SC-008**: A new user can install the package and run their first review in under 10 minutes.

## Assumptions

- Users already use an AI coding assistant (Claude Code) where the skills run; the review reasoning is done by the assistant, guided by the rule files.
- Users have read access to the merge request; for private repositories and for posting mode they already have platform credentials set up on their machine (e.g. a logged-in platform CLI or access token).
- No repository clone is needed for either mode: diff, file paths and line numbers come from the platform. The posting mode places comments using the platform's own line references, which removes the need to resolve commit hashes manually.
- Self-hosted GitLab is supported when the user provides its host URL and has access.
- Rule content is the package author's own summary of the listed sources (refactoring.guru, sourcemaking.com, patterns.dev, frontendpatterns.dev, bulletproof-react, the .NET C# expert skill, the C# code smells article), with links back to them; no source text is copied verbatim.
- Shared general rules (naming, dead code, duplication, error handling, security basics, missing tests) apply to all languages, including unsupported ones.
- Reviews only cover the code in the diff; running builds, tests or linters is out of scope for v1.
- `review.md` is written in English by default; comment language follows the user's request if they ask for another language.
- GitHub and GitLab only; Bitbucket, Azure DevOps and others are out of scope for v1.
- Angular-specific rules are out of scope for v1; the rule structure allows adding them later as a new rule file.

## Clarifications

### Session 2026-10-27

- Q: Should Angular get its own rule set? → A: No; frontendpatterns.dev is a pattern source for TS/JS/React rules only.
- Q: Approval before posting comments? → A: Show all findings, ask once: post all or cancel.
- Q: Package format? → A: Claude Code plugin with both skills, published to npm.
