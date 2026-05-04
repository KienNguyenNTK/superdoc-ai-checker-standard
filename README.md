# SuperDoc AI Checker — Standard FE/BE

Bản chuẩn tách riêng:

```txt
superdoc-ai-checker-standard/
├─ frontend/   # Vite + React + SuperDoc Editor
└─ backend/    # Express API + DOCX extract + OpenAI/local LLM
```

## Chức năng hiện có

- Upload `.docx` trên frontend
- Hiển thị DOCX bằng SuperDoc
- Frontend gọi backend qua `VITE_API_BASE_URL`
- Backend extract text từ DOCX bằng `mammoth`
- Backend gọi LLM qua OpenAI-compatible API:
  - OpenAI API
  - LM Studio
  - Ollama
- Backend trả danh sách lỗi về panel bên phải

> Bản này mới hiển thị lỗi ở panel. Chưa ghi comment/track changes ngược vào DOCX. Bước tiếp theo mới thêm SuperDoc SDK backend để tạo file `reviewed.docx`.

---

## 1. Chạy backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend chạy tại:

```txt
http://localhost:8787
```

Test:

```txt
http://localhost:8787/api/health
```

---

## 2. Cấu hình OpenAI API

Trong `backend/.env`:

```env
API_PORT=8787
FRONTEND_ORIGIN=http://localhost:5173

LOCAL_LLM_BASE_URL=https://api.openai.com/v1
LOCAL_LLM_API_KEY=sk-your-openai-api-key
LOCAL_LLM_MODEL=gpt-4o-mini
```

---

## 3. Cấu hình LM Studio

Trong `backend/.env`:

```env
API_PORT=8787
FRONTEND_ORIGIN=http://localhost:5173

LOCAL_LLM_BASE_URL=http://localhost:1234/v1
LOCAL_LLM_API_KEY=local
LOCAL_LLM_MODEL=qwen2.5-7b-instruct
```

Tên model phải đúng với model LM Studio đang serve.

---

## 4. Cấu hình Ollama

Chạy:

```bash
ollama pull qwen2.5:7b
ollama serve
```

Trong `backend/.env`:

```env
API_PORT=8787
FRONTEND_ORIGIN=http://localhost:5173

LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_API_KEY=ollama
LOCAL_LLM_MODEL=qwen2.5:7b
```

---

## 5. Chạy frontend

Mở terminal khác:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend chạy tại:

```txt
http://localhost:5173
```

Trong `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8787
```

---

## 6. Luồng hệ thống

```txt
Frontend
Upload DOCX
↓
POST /api/documents/analyze-spelling
↓
Backend
Extract text bằng mammoth
↓
OpenAI-compatible LLM
OpenAI / LM Studio / Ollama
↓
Backend nhận JSON lỗi
↓
Frontend hiển thị lỗi ở panel phải
```

---

## 7. Deploy gợi ý

### Frontend

Build:

```bash
cd frontend
npm run build
```

Deploy thư mục:

```txt
frontend/dist
```

Ví dụ Vercel/Netlify/Nginx.

### Backend

Chạy Node server:

```bash
cd backend
npm install
npm run start
```

Set env thật trên server:

```env
API_PORT=8787
FRONTEND_ORIGIN=https://your-frontend-domain.com
LOCAL_LLM_BASE_URL=https://api.openai.com/v1
LOCAL_LLM_API_KEY=sk-...
LOCAL_LLM_MODEL=gpt-4o-mini
```

Nếu dùng local LLM trên server riêng, đổi `LOCAL_LLM_BASE_URL` sang endpoint của server đó.

---

## 8. Bước tiếp theo nên làm

Bước nâng cấp tiếp theo:

```txt
LLM trả lỗi
→ Backend tìm lại vị trí trong DOCX
→ SuperDoc SDK thêm comment/track changes
→ Backend lưu reviewed.docx
→ Backend trả reviewedFileUrl
→ Frontend reload reviewed.docx
```

Khi đó người dùng sẽ thấy lỗi nằm trực tiếp trong file Word, không chỉ ở panel.
