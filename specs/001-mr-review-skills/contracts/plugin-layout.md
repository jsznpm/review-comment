# Contract: Plugin & npm Package Layout

## `.claude-plugin/plugin.json`

```json
{
  "name": "review-comment",
  "version": "<same as package.json>",
  "description": "Review GitHub PRs and GitLab MRs: write copy-paste review.md or post inline comments.",
  "author": { "name": "<author>" },
  "license": "MIT",
  "keywords": ["code-review", "github", "gitlab", "pull-request", "merge-request"]
}
```

Skills are discovered from `skills/*/SKILL.md` (default location; no explicit list needed).

## `.claude-plugin/marketplace.json`

```json
{
  "name": "review-comment",
  "owner": { "name": "<author>" },
  "plugins": [
    {
      "name": "review-comment",
      "description": "Merge request review skills",
      "source": { "source": "npm", "package": "review-comment" }
    }
  ]
}
```

## `package.json` (constraints)

- `name`: `review-comment`; `version` equals `plugin.json` version (test enforces).
- `type`: `module`; `engines.node`: `>=18`.
- `dependencies`: none (test enforces empty/absent).
- `files`: `.claude-plugin/`, `skills/`, `rules/`, `bin/`, `lib/`, `README.md`, `CHANGELOG.md`, `LICENSE`.
- `scripts.test`: `node --test tests/unit tests/rules`.

## User-visible names

| Item | Invocation |
|------|------------|
| File mode skill | `/review-comment:review-file <mr-url> [output-path]` |
| Posting mode skill | `/review-comment:review-post <mr-url>` |

Renaming either is a MAJOR change (Constitution VII).
