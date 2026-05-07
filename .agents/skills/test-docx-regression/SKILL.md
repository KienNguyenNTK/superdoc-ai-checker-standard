---
name: test-docx-regression
description: Use this skill when creating DOCX test files, adding regression tests, testing spelling/format/context checks, testing export, or verifying that comments/highlights/track changes work.
---

# Test DOCX Regression Skill

This project needs regression tests because DOCX review behavior can easily break.

## Main goals

- Create realistic DOCX test cases.
- Test spelling, grammar, format, heading, terminology, table, and export behavior.
- Prevent regressions in range resolving and reviewed DOCX output.

## Existing useful files

- backend/scripts/generate-sample-docx.mjs
- examples/sample-spelling-review.docx
- examples/sample-consistency-100-pages.docx
- examples/file-test-sai-chinh-ta.docx
- backend/src/services/consistency/*.test.ts
- backend/src/services/review/*.test.ts
- backend/src/services/report/*.test.ts

## Test cases to prefer

- Vietnamese spelling errors with exact offsets.
- Same term bold in one place, not bold in another.
- Same heading role with inconsistent font size/bold.
- Tables with inconsistent formatting.
- Brand names that must not be changed.
- Long document with repeated patterns.
- Apply issue then export reviewed DOCX.

## Testing rules

- Add a minimal regression test for every bug fix when possible.
- Test both issue detection and issue application when relevant.
- Prefer deterministic rule tests over LLM-dependent tests.
- Keep test documents small unless testing long-document behavior.