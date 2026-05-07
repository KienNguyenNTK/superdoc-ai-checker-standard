---
name: git-safe-change
description: Use this skill for safe code changes, bug fixes, refactors, test updates, Git workflow, pre-commit issues, CI fixes, and avoiding risky broad edits.
---

# Git Safe Change Skill

Use this skill whenever modifying the codebase.

## Required workflow

1. Inspect relevant files before editing.
2. State the likely root cause.
3. Make the smallest safe change.
4. Keep API contracts stable.
5. Run targeted tests when possible.
6. Report changed files and why they changed.

## Do not

- Do not rewrite unrelated files.
- Do not change generated files unless required.
- Do not remove tests to make a build pass.
- Do not commit unless the user explicitly asks.
- Do not hide failing tests.

## For this project

Before changing code, consider whether the bug belongs to:
- frontend UI state;
- backend API;
- document reading;
- context memory;
- LLM prompt/schema;
- rule engine;
- issue location/range resolver;
- DOCX export.

Prefer targeted fixes over large refactors.