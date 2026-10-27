# Changelog

All notable changes to this plugin are documented here. Versions follow semantic versioning
(see `.specify/memory/constitution.md`, Principle VII). Rule ids are never reused: removed
rules are listed under **Retired**.

## [Unreleased]

## [0.1.0] - 2026-10-27

### Added

- `review-file` skill: review a GitHub PR / GitLab MR into a copy-paste `review.md`.
- `review-post` skill: review and post inline comments after one confirmation; unposted
  findings fall back to `review.md`; hidden markers prevent duplicate comments.
- `bin/mr.mjs` helper: fetch (no clone), diff line mapping, validation, rendering, posting.
- Rules:
  - General: GEN-001 … GEN-012
  - C#: CS-001 … CS-020
  - Go: GO-001 … GO-016
  - Java: JAVA-001 … JAVA-016
  - TypeScript: TS-001 … TS-015
  - JavaScript: JS-001 … JS-015
  - React: REACT-001 … REACT-020

### Changed

### Retired
