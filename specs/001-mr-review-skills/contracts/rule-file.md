# Contract: Rule Files

## `rules/languages.json`

```json
{
  "version": 1,
  "general": "general.md",
  "languages": {
    "csharp":     { "file": "csharp.md",     "prefix": "CS",    "extensions": [".cs"] },
    "go":         { "file": "go.md",         "prefix": "GO",    "extensions": [".go"] },
    "java":       { "file": "java.md",       "prefix": "JAVA",  "extensions": [".java"] },
    "typescript": { "file": "typescript.md", "prefix": "TS",    "extensions": [".ts", ".mts", ".cts", ".tsx"] },
    "javascript": { "file": "javascript.md", "prefix": "JS",    "extensions": [".js", ".mjs", ".cjs", ".jsx"] },
    "react":      { "file": "react.md",      "prefix": "REACT", "extensions": [".jsx", ".tsx"] }
  },
  "skip": ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "go.sum", "*.min.js", "dist/**", "build/**", "*.g.cs", "*.Designer.cs"]
}
```

A file gets `general.md` + every language whose `extensions` match (so `.tsx` → general,
typescript, react). Adding a language = new `.md` + one entry here; no skill change.

## `rules/<lang>.md`

```markdown
---
language: csharp
prefix: CS
version: 1.0.0
---

# C# Review Rules

### CS-001 — Async void method

- **severity**: major
- **status**: active
- **applies-to**: methods, event handlers
- **look-for**: `async void` outside event handlers
- **why**: exceptions crash the process; callers cannot await
- **fix**: return `Task`; keep `async void` only for event handlers
- **sources**: https://refactoring.guru/..., https://medium.com/@dgallivan23/...

```csharp
// bad
public async void Save() { ... }
// good
public async Task SaveAsync() { ... }
```
```

Lint rules (`tests/rules`, part of `npm test`):

- Heading format `### <PREFIX>-NNN — <title>`, prefix equals front matter `prefix`.
- Ids unique across all files; NNN zero-padded 3 digits.
- Required keys: severity, status, applies-to, look-for, why, fix, sources (≥ 1 `https://` URL).
- `severity` ∈ blocker/major/minor/suggestion; `status` ∈ active/retired.
- Every id present in the last published version still exists (retire, never delete).
- Each file in `languages.json` exists and vice versa.
