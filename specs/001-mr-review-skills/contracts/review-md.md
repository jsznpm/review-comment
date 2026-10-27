# Contract: `review.md` Output

Rendered by `mr.mjs render` from `review.json`. Changing this structure is a MAJOR change.

```markdown
# Code Review — <MR title>

| | |
|-|-|
| Merge request | <url> |
| Platform | GitHub \| GitLab (<host>) |
| Reviewed commit | `<headSha>` |
| Reviewed at | <ISO datetime> |
| Mode | file \| post (unposted findings) |

## Summary

- Files reviewed: N · skipped: M
- Findings: blocker a · major b · minor c · suggestion d

<details><summary>Skipped files</summary>

- `path` — reason

</details>

## Findings

### `src/Orders/OrderService.cs`

#### 1. [major] CS-001 — Async void method · line 42–45

**Where to paste**: GitHub — select lines 42–45 in "Files changed", click **+**.
GitLab — comment on line 45.

**Comment** (copy everything inside the box):

````markdown
**[major] CS-001 — Async void method**

Exceptions from `async void` can't be caught by callers and will crash the process.
Return `Task` instead.

```suggestion
public async Task SaveAsync()
{
    await _repo.SaveAsync(order);
}
```
````

---

## Not anchored / general notes

Findings that could not be mapped to a diff line or are not line-specific.
```

Rules:

- Findings grouped by file in diff order, then by line.
- The comment block is wrapped in a 4-backtick fence so the inner 3-backtick suggestion survives
  copy; the user copies the inner content only.
- Suggestion fence: GitHub ```` ```suggestion ````; GitLab ```` ```suggestion:-N+0 ```` with
  `N = line - startLine` (0 for single line). Plain ```` ```<lang> ```` when not a drop-in fix.
- In `post` mode the file contains only `failed`, `unmapped` and `pending` (cancelled) findings,
  each with its status and error.
- The hidden dedupe marker is added only to posted comments, not to `review.md` blocks.
- Empty review: Summary + "No findings" + list of reviewed files.
