---
name: docx-superdoc-engineer
description: Use this skill when working on DOCX reading, SuperDoc integration, issue location, comments, highlights, tracked changes, reviewed DOCX export, range resolving, or preserving Word document structure.
---

# DOCX SuperDoc Engineer Skill

You are working on a SuperDoc AI DOCX checker project.

## Main goals

- Preserve DOCX structure: paragraphs, headings, tables, headers, footers, captions, lists.
- Never treat a DOCX as plain text only when location, formatting, comments, highlights, or tracked changes matter.
- Maintain stable issue locations using blockId, path, startOffset, endOffset, runIds, and target selection.
- Ensure comments/highlights/track changes are anchored to the exact wrong text.
- Export reviewed DOCX without corrupting the original document.

## Project-specific rules

- Backend owns document parsing and DOCX mutation.
- Frontend should display issues and send actions, not directly mutate DOCX internals.
- Do not break Issue, IssueLocation, ResolvedRange, SelectionTarget, CommentRecord, or ChangeRecord contracts.
- If fixing an apply/comment/highlight bug, inspect:
  - backend/src/services/review/documentReviewService.ts
  - backend/src/services/review/rangeResolver.ts
  - backend/src/services/review/issueLocation.ts
  - backend/src/services/superdoc/documentReader.ts
  - backend/src/services/report/reportExporter.ts

## Required behavior

Before changing code:
1. Identify whether the bug is in parsing, issue detection, range resolving, applying issue, or exporting.
2. Trace the flow from upload/analyze to reviewed DOCX export.
3. Keep tests or add a regression test when possible.

When suggesting fixes:
- Prefer small, safe changes.
- Keep exact offsets and surrounding context.
- Do not replace whole paragraphs unless absolutely necessary.
- Preserve tables and inline formatting.