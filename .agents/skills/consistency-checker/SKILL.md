---
name: consistency-checker
description: Use this skill when working on document context memory, format consistency, heading consistency, terminology consistency, translation consistency, tone consistency, entity consistency, or false positives in consistency checking.
---

# Consistency Checker Skill

This project checks consistency across an entire DOCX document, not only spelling.

## Main goals

Detect:
- same important term with inconsistent bold/italic/underline;
- same heading role with different visual style;
- inconsistent terminology;
- inconsistent translation;
- inconsistent entity names;
- inconsistent tone or pronoun style;
- date and number format differences.

## Project files to inspect

- backend/src/services/consistency/contextMemoryBuilder.ts
- backend/src/services/consistency/formatPatternAnalyzer.ts
- backend/src/services/consistency/headingClassifier.ts
- backend/src/services/consistency/headingConsistencyChecker.ts
- backend/src/services/consistency/visualStyleNormalizer.ts
- backend/src/services/consistency/consistencyPipeline.ts
- backend/src/services/rules/formatRules.ts
- backend/src/services/rules/terminologyRules.ts
- backend/src/services/rules/entityRules.ts
- backend/src/services/rules/dateNumberRules.ts
- backend/src/domain/types.ts

## Important rules

- Never compare unrelated headings only because they look like headings.
- Group headings by semantic role before comparing style.
- Do not report normal body text as format inconsistency unless there is strong evidence from repeated patterns.
- Use contextMemory as evidence.
- Prefer rule_engine for deterministic issues and LLM only for semantic checks.
- Every issue should include evidence when possible.

## False positive prevention

Before reporting a consistency issue:
1. Confirm there are at least two reliable examples of the expected pattern.
2. Confirm the current block belongs to the same semantic group.
3. Confirm the difference is meaningful, not temporary highlight or insignificant style noise.
4. Use needs_review if confidence is not high.