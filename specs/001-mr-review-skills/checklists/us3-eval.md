# US3 Fixture Eval — 2026-10-27

Command: `node tests/fixtures/eval.mjs --update-baseline` (Claude Code 2.1.311, `claude -p`, plugin loaded with `--plugin-dir .`)

| language | recall | found | wrong-line | result | missed |
|----------|--------|-------|------------|--------|--------|
| csharp | 100% | 7/7 | 0 | pass | |
| go | 100% | 7/7 | 0 | pass | |
| java | 88% | 7/8 | 0 | pass | JAVA-002@32 (`return null;`) |
| javascript | 100% | 7/7 | 0 | pass | |
| react | 100% | 7/7 | 0 | pass | |
| typescript | 100% | 7/7 | 0 | pass | |

Baseline written to `tests/fixtures/baseline.json`. No rule tuning was needed (all ≥ 80%).

## Scenario 3 (rules as data)

- Added `GO-999` to `rules/go.md` only → `npm test` 76/76 pass; `mr.mjs validate` accepted a
  `GO-999` finding on a Go file. No skill file changed. Rule removed afterwards.
- `.tsx` files get `general.md`, `typescript.md`, `react.md` (unit test `languages.test.mjs`);
  `validate` rejects other prefixes (unit test `findings.test.mjs`).
- Not done: a full model review that cites `GO-999` (needs a `claude -p` run).
