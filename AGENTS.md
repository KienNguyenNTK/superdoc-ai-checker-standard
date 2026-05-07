# AGENTS.md

## Project overview

This repository is a SuperDoc AI DOCX Checker.

It has:
- backend Node.js/TypeScript;
- frontend React/Vite/TypeScript;
- DOCX upload, parsing, review, comment/highlight/track-changes, and export;
- LLM prompts for spelling, format consistency, terminology, translation, tone, and entity checks;
- rule engine and context memory for deterministic consistency checks.

## Use these skills

Use the following repo skills when relevant:

- docx-superdoc-engineer: DOCX parsing, SuperDoc integration, exact issue location, comment, highlight, track changes, export.
- llm-json-reviewer: prompts, OpenAI calls, JSON schemas, LLM review output.
- consistency-checker: context memory, format consistency, heading consistency, terminology, tone, entity, translation.
- react-vite-superdoc-ui: frontend React/Vite UI, review sidebar, toolbar, prompt settings, context memory panel.
- backend-api-contract: backend routes, frontend API client, session payloads, issue actions, export APIs.
- test-docx-regression: sample DOCX files, regression tests, issue detection/export tests.
- git-safe-change: safe code edits, minimal diffs, tests, pre-commit/CI fixes.

## Repository rules

- Do not expose API keys in frontend.
- Frontend must not call LLM providers directly.
- Backend owns DOCX parsing, LLM calls, issue detection, issue application, and export.
- Preserve Issue, IssueLocation, SelectionTarget, ResolvedRange, CommentRecord, and ChangeRecord contracts.
- Keep Vietnamese UI professional and easy to understand.
- Prefer deterministic rule checks when possible.
- Use LLM only when semantic/contextual judgment is required.
- Avoid hallucinated review issues.
- Do not rewrite whole DOCX paragraphs unless explicitly requested.
- Preserve original.docx; write reviewed/final output files separately.

## Test commands

When relevant, run:

```bash
npm test