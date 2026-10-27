# Release Gates — 0.1.0

Constitution, Development Workflow & Quality Gates.

- [x] 1. Fixture reviews for all languages pass (recall ≥ 80%, ≥ baseline, 0 wrong-line) — see `us3-eval.md`
- [x] 2a. Every rule has ≥ 1 `https://` source (lint) — all 63 source URLs return HTTP 200 except medium.com (403 to scripts; user-supplied, opens in a browser)
- [ ] 2b. Manual originality review: rules were written from scratch for this project, not copied, but nobody has yet compared each rule file against its source pages sentence by sentence — **needs a human pass before publish**
- [x] 3. No rule id reused or renamed — `tests/rules/published-ids.json` holds all 114 ids
- [x] 4. Changelog `[0.1.0]` and versions consistent (`package.json` = `plugin.json` = 0.1.0, unit test)
- [x] `claude plugin validate .` and `claude plugin validate .claude-plugin/marketplace.json` pass
- [x] `npm pack --dry-run`: 29 files, 46.5 kB, no `specs/`, `.specify/`, `.claude/`, `tests/`
