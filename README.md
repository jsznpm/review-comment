# review-comment

A [Claude Code](https://code.claude.com) plugin that reviews **GitHub pull requests** and
**GitLab merge requests** (gitlab.com and self-hosted) with language-specific rules for
C#, Go, Java, TypeScript, JavaScript and React.

It has two skills:

| Skill | What it does | Posts to the MR? |
|-------|--------------|------------------|
| `/review-comment:review-file <url> [output]` | Writes `review.md`: every finding with file, line(s), severity, rule id, explanation and a ready-to-paste comment block with suggested code | **Never** |
| `/review-comment:review-post <url>` | Same review, shows all findings, asks **once** (Post all / Cancel), then posts inline comments. Anything not posted goes to `review.md` | After your confirmation |

No repository clone is needed — the diff, file paths, line numbers and commit SHAs come
from the GitHub/GitLab API.

## Install

Requires Claude Code and Node.js ≥ 18.

```text
/plugin install review-comment --marketplace jsznpm/review-comment
```

or in two steps:

```text
/plugin marketplace add jsznpm/review-comment
/plugin install review-comment@review-comment
```

The marketplace entry points to the [`review-comment`](https://www.npmjs.com/package/review-comment)
npm package. Update later with `/plugin update review-comment`; your own files (such as
earlier `review.md` outputs) are never touched.

## Usage

```text
/review-comment:review-file https://github.com/acme/shop/pull/42
/review-comment:review-file https://gitlab.example.com/team/api/-/merge_requests/7 reviews/mr-7.md
/review-comment:review-post https://gitlab.com/group/project/-/merge_requests/15
```

### `review.md` example

`````markdown
### `src/Orders/OrderService.cs`

#### 1. [major] CS-001 — Async void method · line 21

**Where to paste**: GitHub — in **Files changed**, hover line 21 and click **+**.

**Comment** (copy everything inside the box):

````markdown
**[major] CS-001 — Async void method**

Exceptions thrown here can't be caught by callers and will crash the process. Return `Task` instead.

```suggestion
    public async Task PlaceOrderAsync(Order order)
```
````
`````

Suggestion blocks use each platform's syntax (` ```suggestion ` on GitHub,
` ```suggestion:-N+0 ` on GitLab), so the comment gets an **Apply suggestion** button.

## Authentication

Tried in this order:

1. **CLI login** — `gh auth login` (GitHub) or `glab auth login --hostname <host>` (GitLab).
2. **Token** — `GITHUB_TOKEN` (or `GH_TOKEN`) / `GITLAB_TOKEN` environment variable.
3. **Anonymous** — public repositories only, read-only (GitHub allows 60 API requests/hour).

`review-file` works anonymously on public repositories. `review-post` needs 1 or 2 with
permission to comment. Tokens are only sent to the merge request's own API host and are
never stored, logged or printed. There is no telemetry.

## Working files

Each run keeps its intermediate JSON in `.review-comment/` in the current directory
(`mr.json`, `findings.json`, `review.json`) for debugging. Add these to your `.gitignore`:

```gitignore
.review-comment/
review.md
```

Re-running `review-post` on the same merge request does not duplicate comments: every posted
comment carries a hidden marker, and findings whose code moved after a new push are
re-anchored or reported, never posted on a wrong line.

## Rules

| File | Prefix | Rules | Based on |
|------|--------|-------|----------|
| `rules/general.md` | `GEN` | 12 | refactoring.guru code smells, sourcemaking.com anti-patterns |
| `rules/csharp.md` | `CS` | 20 | refactoring.guru C# patterns, .NET C# development expert skill, "10 most common C# code smells" |
| `rules/go.md` | `GO` | 16 | refactoring.guru Go patterns, Go Code Review Comments |
| `rules/java.md` | `JAVA` | 16 | refactoring.guru Java patterns and refactorings |
| `rules/typescript.md` | `TS` | 15 | refactoring.guru TypeScript patterns, patterns.dev, frontendpatterns.dev |
| `rules/javascript.md` | `JS` | 15 | patterns.dev, sourcemaking.com, frontendpatterns.dev, refactoring.guru |
| `rules/react.md` | `REACT` | 20 | patterns.dev, bulletproof-react, react.dev |

A file gets the general rules plus every language whose extensions match
(`rules/languages.json`), so `.tsx` files get `GEN` + `TS` + `REACT` rules. Lock files,
generated and minified files are skipped.

Rule text is written in this project's own words; each rule links to its sources.

### Add or change rules

Rules are data — no skill changes needed:

- **New rule**: add a `### <PREFIX>-NNN — Title` section with the keys `severity`, `status`,
  `applies-to`, `look-for`, `why`, `fix`, `sources` (see any rule file), then run `npm test`.
- **Retire a rule**: set `status: retired`. Never delete or reuse an id.
- **New language**: add `rules/<lang>.md` with front matter (`language`, `prefix`, `version`)
  and one entry in `rules/languages.json`.

## Development

```bash
npm test                          # unit tests + rule lint + fixture checks (no network)
claude --plugin-dir .             # load the plugin from the working tree
node tests/fixtures/build.mjs     # regenerate seeded fixture diffs
node tests/fixtures/eval.mjs      # release gate: runs review-file on every fixture via `claude -p`
```

The eval fails if any language finds fewer than 80% of its seeded issues, drops below its
baseline in `tests/fixtures/baseline.json`, or produces a finding on a line outside the diff.

Versioning follows semver: rule additions are minor releases, wording and false-positive fixes
are patches, changes to skill names or the `review.md` format are major. See
[CHANGELOG.md](CHANGELOG.md).

## License

MIT
