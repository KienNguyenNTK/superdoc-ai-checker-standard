# SuperDoc AI DOCX Checker

Mục tiêu của repo này là bám sát demo SuperDoc cho luồng review DOCX bằng AI:

`Import DOCX -> render bằng SuperDoc -> backend chạy spelling review -> ghi comment/highlight/track changes vào reviewed.docx -> frontend reload reviewed.docx -> click issue thì focus đúng chữ sai -> export lại DOCX/report`.

## Stack

- `frontend/`: Vite + React + TypeScript + `@superdoc-dev/react`
- `backend/`: Node.js + Express + TypeScript + `@superdoc-dev/sdk`
- LLM chỉ được gọi ở backend; frontend không giữ API key.
- Kết quả LLM được validate bằng `zod`.

## Tính năng đã triển khai

- Import `.docx` qua `POST /api/documents`
- SuperDoc editor workspace với built-in toolbar mount vào `DocumentToolbar`
- Right review sidebar với 4 tab: `AI Issues`, `Comments`, `Changes`, `History`
- AI command bar ở đáy màn hình
- Agents menu để chạy spelling/grammar/style/format agent
- Backend dùng SuperDoc SDK để:
  - mở DOCX
  - extract block text
  - resolve range lỗi theo `blockId + wrong + context`
  - thêm comment đúng range
  - highlight đúng range
  - tạo tracked changes
  - lưu `reviewed.docx`
- Frontend reload `reviewed.docx` sau khi backend xử lý
- Click issue gọi `/focus` rồi dùng search/focus API của SuperDoc để nhảy tới lỗi
- Export `original.docx`, `reviewed.docx`, `final.docx`, `issues.json`, `issues.csv`
- Custom dictionary để tránh sửa tên riêng/thương hiệu
- Fallback heuristic khi chưa cấu hình `LOCAL_LLM_API_KEY`

## Cấu trúc repo

```txt
superdoc-ai-checker-standard/
├─ frontend/
├─ backend/
├─ examples/
│  └─ sample-spelling-review.docx
└─ HUONG_DAN_HOAN_THIEN_SUPERDOC_AI_DOCX_CHECKER_FULL_FEATURES.md
```

## Chạy backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

API mặc định: [http://localhost:8787/api/health](http://localhost:8787/api/health)

Biến môi trường chính:

```env
API_PORT=8787
FRONTEND_ORIGIN=http://localhost:5173
STORAGE_DIR=./storage

LOCAL_LLM_BASE_URL=https://api.openai.com/v1
LOCAL_LLM_API_KEY=sk-your-openai-api-key
LOCAL_LLM_MODEL=gpt-4o-mini

SUPERDOC_USER_NAME=AI Spelling Checker
SUPERDOC_USER_EMAIL=ai-checker@example.com
CUSTOM_DICTIONARY=SuperDoc,React,Vite,DOCX
```

Nếu không khai báo `LOCAL_LLM_API_KEY`, backend vẫn chạy được bằng heuristic fallback để demo flow end-to-end. Khi có API key thì backend gọi LLM thật và vẫn bắt buộc parse JSON bằng Zod.

## Chạy frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend mặc định: [http://localhost:5173](http://localhost:5173)

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_APP_VERSION=2.0.0
```

## Sample DOCX

File mẫu có lỗi chính tả nằm ở:

- [examples/sample-spelling-review.docx](/D:/inres/superdoc-ai-checker-standard/examples/sample-spelling-review.docx)

Sinh lại file mẫu:

```bash
cd backend
npm run generate:sample
```

## Luồng demo nên test

1. Import [examples/sample-spelling-review.docx](/D:/inres/superdoc-ai-checker-standard/examples/sample-spelling-review.docx)
2. Bấm `Check spelling` hoặc chạy `Vietnamese Spelling Checker`
3. Chờ backend tạo `reviewed.docx`
4. Xem `AI Issues` / `Comments` / `Changes`
5. Bấm `Go to issue`
6. Bấm `Apply` hoặc `Ignore`
7. Export `reviewed.docx`

## API chính

- `GET /api/health`
- `POST /api/documents`
- `POST /api/documents/:documentId/analyze-spelling`
- `GET /api/documents/:documentId/issues/:issueId/focus`
- `POST /api/documents/:documentId/issues/:issueId/apply`
- `POST /api/documents/:documentId/issues/:issueId/ignore`
- `POST /api/documents/:documentId/issues/apply-high-confidence`
- `GET /api/documents/:documentId/comments`
- `GET /api/documents/:documentId/changes`
- `GET /api/documents/:documentId/history`
- `GET /api/documents/:documentId/export?type=original|reviewed|final|report-json|report-csv`
- `POST /api/documents/:documentId/ai-command`
- `POST /api/documents/:documentId/agents/:agentId/run`

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

## TODO còn lại

Xem file:

- [TODO_SUPERDOC_GAPS.md](/D:/inres/superdoc-ai-checker-standard/TODO_SUPERDOC_GAPS.md)
