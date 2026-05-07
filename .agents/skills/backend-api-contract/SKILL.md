---
name: backend-api-contract
description: Use this skill when editing backend routes, API payloads, frontend API client, document sessions, analyze requests, issue actions, prompt settings, or export endpoints.
---

# Backend API Contract Skill

This project has a backend/frontend split. Backend APIs must remain stable.

## Main goals

- Keep API contracts explicit.
- Keep frontend and backend types aligned.
- Do not break document sessions, issue locations, or export flows.
- Validate user inputs and LLM outputs.

## Project files to inspect

- backend/src/app.ts
- backend/src/index.ts
- backend/src/domain/types.ts
- backend/src/services/storage/documentSessionStore.ts
- backend/src/services/review/documentReviewService.ts
- backend/src/services/consistency/consistencyPipeline.ts
- backend/src/prompts/promptTemplateService.ts
- frontend/src/lib/api.ts
- frontend/src/types.ts

## API rules

Backend should handle:
- DOCX upload
- document parsing
- context memory building
- analyze consistency
- applying issue
- ignoring issue
- adding comments/highlights/tracked changes
- exporting reviewed DOCX
- listing and editing prompt templates

Frontend should handle:
- rendering state
- calling API
- showing progress/errors
- displaying issues
- sending user actions

## Safety rules

- Never expose API keys to frontend.
- Never trust LLM JSON without validation.
- Never mutate original.docx directly; write reviewed/final outputs.
- Preserve session history.