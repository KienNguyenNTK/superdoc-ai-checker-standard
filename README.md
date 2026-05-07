# SuperDoc AI DOCX Consistency Reviewer

Hệ thống này nâng cấp demo `spelling-only` thành pipeline review DOCX theo ngữ cảnh:

`DOCX -> SuperDoc extract structure + hydrate runs -> build context memory -> rule engine + LLM consistency -> add comment/highlight/track changes -> export reviewed-consistency.docx`

## Tính năng chính

- Backend dùng SuperDoc để đọc `text + structure + format runs`, không chỉ raw text.
- Context memory theo tài liệu gồm:
  - glossary
  - format rules
  - tone rules
  - entity rules
- Rule engine cho:
  - format consistency
  - heading consistency
  - terminology exact-match
  - entity/name consistency
  - date/number/unit consistency
- LLM layer cho:
  - spelling
  - translation consistency
  - tone consistency
  - terminology consistency
- LLM output luôn parse bằng Zod trước khi merge issue.
- Issue có location đầy đủ:
  - `blockId`
  - `path`
  - `startOffset`
  - `endOffset`
  - `beforeContext`
  - `afterContext`
- Backend dùng SuperDoc để add comment, highlight, replace tracked/direct và save `reviewed-consistency.docx`.
- Frontend có:
  - sidebar filter theo loại lỗi
  - focus issue trong SuperDoc editor
  - Document Memory panel
  - Prompt Settings panel

## Stack

- `frontend/`: Vite + React + TypeScript + `@superdoc-dev/react`
- `backend/`: Node.js + Express + TypeScript + `@superdoc-dev/sdk`
- LLM chỉ chạy ở backend.
- Persistence: file + JSON dưới `storage/`.

## Cấu trúc quan trọng

```txt
backend/src/
├─ domain/types.ts
├─ prompts/
├─ services/
│  ├─ consistency/
│  ├─ llm/
│  ├─ review/
│  ├─ rules/
│  └─ superdoc/
frontend/src/
├─ components/review/
├─ lib/api.ts
└─ types.ts
```

## Chạy backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

API health:

- [http://localhost:8787/api/health](http://localhost:8787/api/health)

Biến môi trường backend:

```env
API_PORT=8787
FRONTEND_ORIGIN=http://localhost:5173
STORAGE_DIR=./storage

SUPERDOC_USER_NAME=AI Consistency Checker
SUPERDOC_USER_EMAIL=ai-checker@example.com
CUSTOM_DICTIONARY=SuperDoc,React,Vite,DOCX

LOCAL_LLM_BASE_URL=https://api.openai.com/v1
LOCAL_LLM_API_KEY=sk-your-openai-api-key
LOCAL_LLM_MODEL=gpt-4o-mini
```

Nếu không có `LOCAL_LLM_API_KEY`, backend vẫn chạy bằng heuristic/rule fallback.

## Chạy frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend:

- [http://localhost:5173](http://localhost:5173)

Biến môi trường frontend:

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_APP_VERSION=2.0.0
VITE_ENABLE_PROMPT_SETTINGS=true
```

## Sample DOCX

Repo có 2 file sample:

- [examples/sample-spelling-review.docx](/D:/inres/superdoc-ai-checker-standard/examples/sample-spelling-review.docx)
- [examples/sample-consistency-100-pages.docx](/D:/inres/superdoc-ai-checker-standard/examples/sample-consistency-100-pages.docx)

Sinh lại sample:

```bash
cd backend
npm run generate:sample
```

Generator tạo file 100 trang với:

- repeated terms
- inconsistent bold/italic
- heading/table variations
- translation/tone/entity mismatches
- spelling issues

## Luồng demo đề xuất

1. Import [examples/sample-consistency-100-pages.docx](/D:/inres/superdoc-ai-checker-standard/examples/sample-consistency-100-pages.docx)
2. Bấm `Xây context memory`
3. Mở `Document Memory` để xem glossary/format/tone/entities
4. Bấm `Phân tích consistency` hoặc chạy một agent cụ thể
5. Xem `Issues`, lọc theo `Format / Thuật ngữ / Dịch thuật / Văn phong / Tên riêng`
6. Bấm `Xem vị trí`
7. Bấm `Áp dụng` hoặc `Bỏ qua`
8. Export `reviewed-consistency.docx`

## API chính

- `POST /api/documents`
- `POST /api/documents/:documentId/build-context`
- `GET /api/documents/:documentId/context`
- `PUT /api/documents/:documentId/glossary`
- `POST /api/documents/:documentId/analyze-spelling`
- `POST /api/documents/:documentId/analyze-consistency`
- `POST /api/documents/:documentId/analyze-selection`
- `GET /api/documents/:documentId/issues/:issueId/focus`
- `POST /api/documents/:documentId/issues/:issueId/apply`
- `POST /api/documents/:documentId/issues/:issueId/ignore`
- `POST /api/documents/:documentId/issues/apply-high-confidence`
- `GET /api/documents/:documentId/comments`
- `GET /api/documents/:documentId/changes`
- `GET /api/documents/:documentId/history`
- `GET /api/documents/:documentId/export?type=original|reviewed|final|report-json|report-csv`
- `GET /api/prompts`
- `GET /api/prompts/:promptId`
- `PUT /api/prompts/:promptId`
- `POST /api/prompts/:promptId/test`
- `POST /api/prompts/:promptId/reset`

Chi tiết request/response xem:

- [docs/api.md](/D:/inres/superdoc-ai-checker-standard/docs/api.md)

## Kiểm tra đã chạy

Backend:

```bash
cd backend
npm test
npm run typecheck
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

## TODO / SDK gaps

Xem file:

- [TODO_SUPERDOC_GAPS.md](/D:/inres/superdoc-ai-checker-standard/TODO_SUPERDOC_GAPS.md)
