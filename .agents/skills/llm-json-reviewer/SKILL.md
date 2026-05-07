---
name: llm-json-reviewer
description: Use this skill when editing LLM prompts, JSON output schemas, spelling/grammar analyzers, prompt rendering, OpenAI calls, or any feature where the model must return structured review issues.
---

# LLM JSON Reviewer Skill

This project uses LLMs to review Vietnamese DOCX documents and return structured JSON issues.

## Main goals

- Force LLM output to valid JSON.
- Avoid hallucinated errors.
- Avoid rewriting entire paragraphs.
- Avoid changing names, brands, product names, technical terms, and intentional wording.
- Keep every issue actionable and anchored to exact document text.

## Project files to inspect

- backend/src/prompts/templates/spelling.prompt.ts
- backend/src/prompts/templates/formatConsistency.prompt.ts
- backend/src/prompts/templates/translationConsistency.prompt.ts
- backend/src/prompts/templates/consistency.prompt.ts
- backend/src/prompts/templates/entityConsistency.prompt.ts
- backend/src/prompts/templates/toneConsistency.prompt.ts
- backend/src/prompts/promptTemplateService.ts
- backend/src/services/llm/spellingAnalyzer.ts
- backend/src/services/llm/issueSchemas.ts

## LLM output rules

Each issue should include:
- type
- wrong
- suggestion
- reason
- confidence
- severity
- source
- location or enough text to resolve location

## Do not

- Do not let the LLM invent document facts.
- Do not allow vague issues without exact wrong text.
- Do not return markdown when JSON is required.
- Do not change tone unless the requested check is tone consistency.
- Do not mark valid Vietnamese names or brand names as spelling errors.

## Prompt quality checklist

A good prompt must say:
- Only return valid JSON.
- Only report issues with clear evidence.
- Do not rewrite whole sentences.
- Keep names, brands, and technical terms unchanged.
- Use the custom dictionary.
- Prefer low confidence or needs_review when unsure.