---
name: react-vite-superdoc-ui
description: Use this skill when editing the React/Vite frontend, SuperDoc workspace UI, review sidebar, prompt settings, AI command bar, context memory panel, or Vietnamese UI text.
---

# React Vite SuperDoc UI Skill

This project frontend uses React, Vite, TypeScript, and Vietnamese UI.

## Main goals

- Build a modern document-review UI.
- Keep UI simple, clean, and professional.
- Make the review sidebar easy to use.
- Let users click an issue and jump to the correct document location.
- Keep prompt settings and context memory understandable.

## Project files to inspect

- frontend/src/App.tsx
- frontend/src/components/document/SuperDocWorkspace.tsx
- frontend/src/components/document/DocumentToolbar.tsx
- frontend/src/components/review/ReviewSidebar.tsx
- frontend/src/components/review/PromptSettingsPanel.tsx
- frontend/src/components/review/ContextMemoryPanel.tsx
- frontend/src/components/ai/AiCommandBar.tsx
- frontend/src/components/agents/AgentsDropdown.tsx
- frontend/src/lib/api.ts
- frontend/src/i18n/vi.ts
- frontend/src/styles.css

## UI rules

- Use Vietnamese labels.
- Keep layout close to a document editor: top toolbar, document area, review sidebar.
- Show issue type, severity, confidence, wrong text, suggestion, reason, and status.
- Do not overload the document area with too many controls.
- Loading states should be clear.
- Error messages should tell the user what to do next.

## API rules

- Frontend must call backend APIs through frontend/src/lib/api.ts.
- Do not call OpenAI or LLM providers directly from frontend.
- Keep TypeScript types aligned with backend Issue and DocumentSession contracts.