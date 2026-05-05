# HƯỚNG DẪN HOÀN THIỆN DỰ ÁN SUPERDOC AI DOCX CHECKER — FULL FEATURES GIỐNG DEMO SUPERDOC

> Mục tiêu: hoàn thiện hệ thống kiểm tra/sửa chính tả DOCX bằng SuperDoc + LLM, trong đó frontend phải có trải nghiệm giống demo SuperDoc: import DOCX, editor toolbar đầy đủ, highlight/bôi chọn đúng vị trí, comment/review sidebar, tracked changes, AI chat bar, agents, nút share/export, và backend dùng SuperDoc SDK/Document Engine để đọc/sửa/ghi comment/track changes/highlight trực tiếp vào DOCX.

---

## 0. Điểm cần sửa so với bản hướng dẫn cũ

Bản hướng dẫn cũ mới nói khá tổng quát về:

```txt
FE hiển thị DOCX
BE gọi LLM
BE thêm comment/track changes
FE reload reviewed.docx
```

Nhưng để làm giống demo SuperDoc bạn gửi, cần bổ sung rõ các tính năng sau:

```txt
[ ] Toolbar editor đầy đủ giống Word/SuperDoc demo
[ ] Import DOCX trực tiếp
[ ] Share button
[ ] Agents menu
[ ] Chat/AI command bar
[ ] Comment/review sidebar bên phải
[ ] Highlight/bôi màu đúng chữ sai
[ ] Underline/selection đúng range lỗi chính tả
[ ] Jump/focus tới đúng vị trí lỗi khi bấm issue
[ ] Scroll tới đúng paragraph/table cell
[ ] Select đúng từ/cụm từ sai trong editor
[ ] Add comment trực tiếp tại vị trí lỗi
[ ] Replace text với tracked changes
[ ] Hiển thị lịch sử change: Added/Replaced/Deleted
[ ] Accept/reject từng change
[ ] Export/download reviewed.docx
[ ] FE nhận ranges/anchors từ BE để điều hướng đúng vị trí
[ ] BE không chỉ trả list lỗi, mà phải trả location/anchor/range để FE focus được
```

---

## 1. Product vision

Hệ thống cần hoạt động giống một bản “SuperDoc + AI proofreader”:

```txt
Người dùng import DOCX
→ DOCX mở trong SuperDoc Editor
→ Người dùng bấm AI/check chính tả hoặc nhập lệnh ở chat bar
→ Backend đọc DOCX bằng SuperDoc
→ LLM phát hiện lỗi
→ Backend ghi annotation/comment/track change/highlight vào DOCX
→ Frontend hiển thị ngay trong editor
→ Sidebar phải hiện danh sách comment/change giống demo
→ Người dùng click issue thì editor scroll và bôi đúng chữ sai
→ Người dùng accept/reject/apply từng lỗi
→ Người dùng export DOCX
```

---

## 2. Kiến trúc chuẩn

```txt
superdoc-ai-checker/
├─ frontend/
│  ├─ Vite + React + TypeScript
│  ├─ SuperDoc React Editor
│  ├─ Toolbar giống demo SuperDoc
│  ├─ Right sidebar: comments/review/issues
│  ├─ AI chat bar / command bar
│  └─ Agents menu
│
├─ backend/
│  ├─ Node.js + Express/Fastify + TypeScript
│  ├─ SuperDoc SDK/Document Engine
│  ├─ LLM OpenAI-compatible client
│  ├─ Document reader/writer
│  ├─ Comment/highlight/track-change service
│  └─ Storage + export service
│
└─ docs/
   ├─ architecture.md
   ├─ api.md
   ├─ superdoc-features.md
   └─ prompt-for-agent.md
```

---

## 3. Trải nghiệm frontend phải giống demo SuperDoc

Ảnh demo SuperDoc có các phần chính:

```txt
Top bar:
- Import DOCX
- Version text
- Share
- Agents
- Chat
- Theme/palette/icon button
- Download/export dropdown

Editor toolbar:
- Undo/redo
- Zoom
- Font family
- Font size
- Bold/italic/underline/strikethrough
- Text color
- Highlight/marker
- Link
- Image
- Table
- Alignment
- Bullets
- Numbered list
- Indent/outdent
- Line spacing
- More menu
- User/collab/review control

Document area:
- Nội dung DOCX
- Chữ được thêm/xóa/thay thế có màu
- Gạch chân/track changes
- Highlight/selection đúng range
- Bảng/tables giữ format

Right sidebar:
- Danh sách comment/change
- Mỗi card có user, loại change, thời gian
- Added / Replaced / Deleted
- Nội dung cũ/mới
- Scroll sidebar riêng

Bottom AI bar:
- Input: “What can I change?”
- Model selector
- Send button
```

Frontend của dự án phải tái hiện đầy đủ các nhóm tính năng này.

---

## 4. Frontend full feature checklist

### 4.1 Top app bar

Cần có component:

```txt
frontend/src/components/layout/AppTopBar.tsx
```

Tính năng:

```txt
[ ] Import DOCX button
[ ] Hiển thị version app
[ ] Share button
[ ] Agents dropdown
[ ] Chat toggle
[ ] Theme/settings button
[ ] Export/download dropdown
[ ] API/LLM/SuperDoc status
```

Nút Import DOCX:

```txt
- Upload file .docx
- Gọi POST /api/documents
- Lấy documentId + originalFileUrl
- Render file vào SuperDocEditor
```

Nút Share:

```txt
- MVP: copy link document session
- Production: tạo share token hoặc invite user
```

Agents dropdown:

```txt
- Check chính tả tiếng Việt
- Sửa văn phong
- Tóm tắt tài liệu
- Review hợp đồng
- So sánh bản trước/sau
```

Chat toggle:

```txt
- Mở/tắt AI chat command bar
```

Export dropdown:

```txt
- Download original.docx
- Download reviewed.docx
- Download final.docx
- Download issues.json
- Download issues.csv
```

---

### 4.2 Editor toolbar giống demo

Cần có component:

```txt
frontend/src/components/document/DocumentToolbar.tsx
```

Tính năng toolbar:

```txt
[ ] Undo
[ ] Redo
[ ] Zoom dropdown: 75%, 100%, 125%, fit width
[ ] Font family dropdown
[ ] Font size input/dropdown
[ ] Bold
[ ] Italic
[ ] Underline
[ ] Strikethrough
[ ] Text color
[ ] Highlight color / marker
[ ] Clear formatting
[ ] Link
[ ] Image insert
[ ] Table insert
[ ] Alignment: left/center/right/justify
[ ] Bullet list
[ ] Numbered list
[ ] Indent
[ ] Outdent
[ ] Line spacing
[ ] More menu
[ ] Review/collaboration user menu
```

Quan trọng:

```txt
Nếu SuperDoc React package đã có toolbar mặc định:
- Dùng toolbar mặc định trước.
- Sau đó thêm custom toolbar bên ngoài nếu cần.

Nếu SuperDoc hỗ trợ API command:
- Toolbar custom phải gọi command vào SuperDoc instance.

Nếu API chưa public:
- Giữ toolbar custom ở UI level và ghi TODO rõ.
```

---

### 4.3 SuperDoc editor workspace

Component:

```txt
frontend/src/components/document/SuperDocWorkspace.tsx
```

Nhiệm vụ:

```txt
[ ] Render SuperDocEditor
[ ] Nhận documentUrl/File
[ ] Nhận mode: viewing/editing/suggesting/review
[ ] Giữ editor instance ref
[ ] Expose các method:
    - loadDocument(url)
    - reloadDocument(url)
    - exportDocument()
    - focusRange(anchor)
    - selectRange(anchor)
    - highlightRange(anchor)
    - clearTemporaryHighlights()
    - setMode(mode)
```

Ví dụ:

```tsx
<SuperDocEditor
  document={documentUrl}
  documentMode={mode}
  role="editor"
  user={{
    name: currentUser.name,
    email: currentUser.email,
  }}
  onReady={handleReady}
  onException={handleException}
  onContentError={handleContentError}
/>
```

---

## 5. Tính năng quan trọng: focus đúng vị trí lỗi

Đây là phần bắt buộc để làm giống demo.

Khi LLM phát hiện:

```txt
khách hang → khách hàng
```

Hệ thống không được chỉ hiện list lỗi bên phải. Phải làm được:

```txt
1. Click issue ở sidebar
2. Editor scroll tới đúng đoạn
3. Chữ "khách hang" được bôi/underline/highlight
4. Nếu có comment thì mở comment tương ứng
5. Nếu có track change thì focus vào change tương ứng
```

### 5.1 BE phải trả location/anchor

Issue response không được chỉ là:

```json
{
  "wrong": "khách hang",
  "suggestion": "khách hàng"
}
```

Mà phải là:

```json
{
  "id": "issue_001",
  "wrong": "khách hang",
  "suggestion": "khách hàng",
  "reason": "Thiếu dấu tiếng Việt",
  "confidence": "high",
  "location": {
    "blockId": "p_001",
    "blockType": "paragraph",
    "path": "body.paragraph[3]",
    "startOffset": 18,
    "endOffset": 28,
    "searchText": "khách hang",
    "beforeContext": "luôn hỗ trợ ",
    "afterContext": " trong quá trình",
    "commentId": "comment_001",
    "changeId": "change_001",
    "anchorId": "anchor_001"
  },
  "status": "commented"
}
```

### 5.2 FE focus function

Frontend cần function:

```ts
async function focusIssue(issue: SpellingIssue) {
  // 1. Nếu SuperDoc có API focus comment/change:
  //    focus commentId/changeId.
  // 2. Nếu có API select range:
  //    selectRange(anchor).
  // 3. Nếu chưa có API:
  //    reload reviewed.docx đã có comment/highlight,
  //    scroll theo blockId/path nếu mapping làm được,
  //    hoặc mở sidebar comment tương ứng.
}
```

### 5.3 Temporary highlight

Khi click issue, ngoài comment/track changes có sẵn, FE nên tạo highlight tạm thời:

```txt
- Nền vàng nhạt hoặc xanh nhạt
- Tự tắt sau 2-3 giây
- Không ghi vĩnh viễn vào DOCX nếu chỉ là focus UI
```

Nếu SuperDoc không hỗ trợ highlight tạm qua API, BE có thể tạo highlight thật vào `reviewed.docx`.

---

## 6. Tính năng highlight/bôi đúng chữ sai

Có 2 loại highlight:

### 6.1 Highlight tạm thời trên FE

Dùng khi user click issue.

```txt
Không lưu vào file DOCX
Chỉ giúp người dùng nhìn thấy vị trí
```

### 6.2 Highlight thật trong DOCX

Dùng khi backend tạo reviewed.docx.

```txt
Lưu vào file DOCX
Mở bằng Word/SuperDoc vẫn thấy highlight
```

Backend phải hỗ trợ mode:

```txt
comment_only
highlight_only
track_changes
comment_and_highlight
track_changes_and_comment
```

API:

```http
POST /api/documents/:documentId/analyze-spelling
```

Body:

```json
{
  "mode": "comment_and_highlight",
  "highlightColor": "yellow",
  "trackChanges": false,
  "maxIssues": 200
}
```

---

## 7. Right sidebar giống demo SuperDoc

Component:

```txt
frontend/src/components/review/ReviewSidebar.tsx
```

Sidebar có tabs:

```txt
[ ] AI Issues
[ ] Comments
[ ] Changes
[ ] History
```

### 7.1 AI Issues tab

Hiển thị:

```txt
- wrong → suggestion
- reason
- confidence
- type
- location label
- status
- buttons:
  - Go to issue
  - Comment
  - Apply
  - Ignore
```

### 7.2 Comments tab

Giống demo:

```txt
Card:
- Avatar
- Username
- Badge: AI / IMPORTED / USER
- Time
- Action: Added comment / Suggested change
- Content
```

Ví dụ card:

```txt
AI Spelling Checker
COMMENTED
2:10 AM
Added comment on "khách hang"
Gợi ý: "khách hàng"
```

### 7.3 Changes tab

Hiển thị tracked changes:

```txt
- Added "..."
- Deleted "..."
- Replaced "old" with "new"
```

Giống demo:

```txt
Replaced "get/load" with "import"
```

### 7.4 History tab

Ghi lịch sử:

```txt
- Imported DOCX
- Ran spelling checker
- Added 12 comments
- Created 5 tracked changes
- Exported reviewed.docx
```

---

## 8. AI chat bar giống demo

Component:

```txt
frontend/src/components/ai/AiCommandBar.tsx
```

Giao diện:

```txt
Input: "What can I change?"
Model selector: GPT-4o-mini / Local Qwen / Ollama
Send button
```

Command gợi ý:

```txt
- Kiểm tra chính tả tiếng Việt
- Thêm comment vào lỗi
- Sửa lỗi có độ chắc chắn cao
- Tóm tắt tài liệu
- Viết lại đoạn đang chọn cho chuyên nghiệp hơn
- Tìm các câu khó hiểu
- Chuẩn hóa văn phong
```

API:

```http
POST /api/documents/:documentId/ai-command
```

Body:

```json
{
  "command": "Kiểm tra chính tả tiếng Việt và thêm comment vào lỗi",
  "selection": {
    "blockId": "p_001",
    "startOffset": 0,
    "endOffset": 120
  },
  "mode": "comment_only"
}
```

Response:

```json
{
  "message": "Đã thêm 12 comment và 5 suggestion.",
  "issues": [],
  "reviewedFileUrl": "/files/doc_123/reviewed.docx"
}
```

---

## 9. Agents menu

Component:

```txt
frontend/src/components/agents/AgentsDropdown.tsx
```

Agents cần có:

```txt
[ ] Vietnamese Spelling Checker
[ ] Grammar Reviewer
[ ] Style Reviewer
[ ] Legal Reviewer
[ ] Contract Risk Reviewer
[ ] Format Cleaner
[ ] Table Formatter
[ ] Summary Agent
```

Mỗi agent có config:

```ts
type AgentConfig = {
  id: string;
  name: string;
  description: string;
  modes: Array<"comment_only" | "track_changes" | "highlight_only" | "both">;
  promptId: string;
  defaultMode: string;
};
```

Khi chọn agent:

```txt
Frontend gọi /api/documents/:documentId/agents/:agentId/run
```

---

## 10. Backend full SuperDoc feature requirements

Backend không được chỉ dùng `mammoth.extractRawText` cho bản hoàn chỉnh.

Bắt buộc backend phải có SuperDoc services:

```txt
backend/src/services/superdoc/
├─ superdocClient.ts
├─ documentReader.ts
├─ documentWriter.ts
├─ selectionService.ts
├─ rangeResolver.ts
├─ commentService.ts
├─ highlightService.ts
├─ trackChangesService.ts
├─ changesReader.ts
├─ exportService.ts
└─ mutationService.ts
```

### 10.1 superdocClient.ts

Nhiệm vụ:

```txt
- Khởi tạo SuperDoc SDK/Document Engine
- Open document
- Close document
- Save document
- Export document
- Dispatch operations
```

Pseudo-code:

```ts
export async function createDocumentSession(filePath: string) {
  const client = createSuperDocClient();
  await client.connect();

  const doc = await client.open({
    doc: filePath,
  });

  return {
    client,
    doc,
    async saveAs(outputPath: string) {
      await doc.save({
        inPlace: false,
        output: outputPath,
      });
    },
    async close() {
      await doc.close();
      await client.dispose();
    },
  };
}
```

> Dev phải kiểm tra lại API chính xác theo version SuperDoc SDK đang dùng. Không bịa API nếu package khác.

### 10.2 documentReader.ts

Phải đọc được:

```txt
[ ] Paragraphs
[ ] Headings
[ ] Runs
[ ] Tables
[ ] Table rows
[ ] Table cells
[ ] Lists
[ ] Headers
[ ] Footers
[ ] Existing comments
[ ] Existing tracked changes
[ ] Styles/format metadata nếu có
```

Output block:

```ts
type DocumentBlock = {
  blockId: string;
  type: "paragraph" | "heading" | "tableCell" | "header" | "footer" | "listItem";
  text: string;
  path: string;
  runRefs?: Array<{
    runId: string;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;
  metadata?: {
    tableIndex?: number;
    rowIndex?: number;
    cellIndex?: number;
    headingLevel?: number;
    styleName?: string;
  };
};
```

### 10.3 rangeResolver.ts

Rất quan trọng.

Nhiệm vụ:

```txt
LLM trả blockId + wrong
→ tìm đúng vị trí trong block
→ tính startOffset/endOffset
→ tạo anchor/range để SuperDoc có thể comment/highlight/replace
```

Output:

```ts
type ResolvedRange = {
  blockId: string;
  path: string;
  startOffset: number;
  endOffset: number;
  exactText: string;
  beforeContext: string;
  afterContext: string;
  confidence: "exact" | "fuzzy" | "ambiguous" | "not_found";
};
```

Logic:

```txt
1. Exact match wrong trong block text
2. Nếu có 1 match → exact
3. Nếu nhiều match → dùng beforeContext/afterContext
4. Nếu vẫn nhiều → ambiguous, chỉ comment ở block
5. Nếu không thấy → not_found, không sửa
```

### 10.4 commentService.ts

Nhiệm vụ:

```txt
- Add comment vào đúng ResolvedRange
- Comment phải anchor đúng chữ sai nếu có range exact
- Nếu ambiguous thì comment vào paragraph/block
```

Comment content:

```txt
AI phát hiện lỗi chính tả
Từ/cụm từ: "khách hang"
Gợi ý: "khách hàng"
Lý do: Thiếu dấu tiếng Việt
Độ chắc chắn: high
```

### 10.5 highlightService.ts

Nhiệm vụ:

```txt
- Highlight range lỗi bằng màu vàng/xanh
- Có thể tạo highlight vĩnh viễn trong reviewed.docx
- Có thể remove highlight nếu user ignore
```

API nội bộ:

```ts
async function highlightIssue(doc, range, color = "yellow") {}
async function removeHighlight(doc, issueId) {}
```

### 10.6 trackChangesService.ts

Nhiệm vụ:

```txt
- Bật tracked changes/review mode nếu cần
- Replace wrong → suggestion dưới dạng tracked change
- Reviewer: AI Spelling Checker
- Đọc lại danh sách changes
- Accept/reject change nếu SDK hỗ trợ
```

Logic:

```txt
confidence high + range exact:
  create tracked replacement
confidence medium:
  comment + highlight
confidence low:
  panel only
```

### 10.7 changesReader.ts

Nhiệm vụ:

```txt
- Đọc existing changes
- Đọc changes do AI tạo
- Trả về sidebar FE
```

Response:

```json
{
  "changes": [
    {
      "id": "change_001",
      "type": "replace",
      "oldText": "khách hang",
      "newText": "khách hàng",
      "author": "AI Spelling Checker",
      "createdAt": "2026-05-04T10:00:00Z",
      "status": "pending"
    }
  ]
}
```

---

## 11. Backend API đầy đủ

### 11.1 Health

```http
GET /api/health
```

Response:

```json
{
  "ok": true,
  "superdoc": "ready",
  "llm": {
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-4o-mini"
  }
}
```

### 11.2 Upload/import DOCX

```http
POST /api/documents
```

Response:

```json
{
  "documentId": "doc_123",
  "originalFileUrl": "/files/doc_123/original.docx",
  "status": "uploaded"
}
```

### 11.3 Analyze spelling

```http
POST /api/documents/:documentId/analyze-spelling
```

Body:

```json
{
  "mode": "comment_and_highlight",
  "trackChanges": false,
  "highlight": true,
  "highlightColor": "yellow",
  "maxIssues": 200,
  "applyHighConfidence": false
}
```

Response:

```json
{
  "documentId": "doc_123",
  "status": "reviewed",
  "issues": [],
  "comments": [],
  "changes": [],
  "reviewedFileUrl": "/files/doc_123/reviewed.docx"
}
```

### 11.4 Focus issue data

```http
GET /api/documents/:documentId/issues/:issueId/focus
```

Response:

```json
{
  "issueId": "issue_001",
  "location": {
    "blockId": "p_001",
    "path": "body.paragraph[3]",
    "startOffset": 18,
    "endOffset": 28,
    "commentId": "comment_001",
    "changeId": null,
    "anchorId": "anchor_001"
  }
}
```

### 11.5 Apply issue

```http
POST /api/documents/:documentId/issues/:issueId/apply
```

Nhiệm vụ:

```txt
- Replace wrong → suggestion
- Hoặc accept tracked change tương ứng
- Update issue status
- Save reviewed.docx
```

### 11.6 Ignore issue

```http
POST /api/documents/:documentId/issues/:issueId/ignore
```

Nhiệm vụ:

```txt
- Mark ignored
- Remove temporary/permanent highlight nếu cần
- Resolve/remove comment nếu cần
```

### 11.7 Apply all high confidence

```http
POST /api/documents/:documentId/issues/apply-high-confidence
```

### 11.8 Get comments

```http
GET /api/documents/:documentId/comments
```

### 11.9 Get changes

```http
GET /api/documents/:documentId/changes
```

### 11.10 Export

```http
GET /api/documents/:documentId/export?type=original|reviewed|final|report-json|report-csv
```

### 11.11 AI command

```http
POST /api/documents/:documentId/ai-command
```

Body:

```json
{
  "command": "Kiểm tra chính tả và thêm comment vào lỗi",
  "mode": "comment_and_highlight",
  "selection": null
}
```

### 11.12 Run agent

```http
POST /api/documents/:documentId/agents/:agentId/run
```

---

## 12. LLM schema đầy đủ

LLM phải trả cả context để resolve vị trí tốt hơn.

```json
{
  "issues": [
    {
      "blockId": "p_001",
      "wrong": "khách hang",
      "suggestion": "khách hàng",
      "reason": "Thiếu dấu tiếng Việt",
      "type": "accent",
      "confidence": "high",
      "beforeContext": "luôn hỗ trợ ",
      "afterContext": " trong quá trình",
      "shouldAutoApply": true
    }
  ]
}
```

Zod schema:

```ts
const LlmIssueSchema = z.object({
  blockId: z.string(),
  wrong: z.string(),
  suggestion: z.string(),
  reason: z.string(),
  type: z.enum(["spelling", "accent", "typo", "grammar", "style"]),
  confidence: z.enum(["high", "medium", "low"]),
  beforeContext: z.string().optional(),
  afterContext: z.string().optional(),
  shouldAutoApply: z.boolean().optional(),
});
```

---

## 13. Prompt LLM chuẩn

```txt
Bạn là bộ kiểm tra chính tả tiếng Việt cho tài liệu DOCX.

Nhiệm vụ:
- Phát hiện lỗi chính tả rõ ràng.
- Phát hiện lỗi sai dấu tiếng Việt.
- Phát hiện lỗi gõ nhầm.
- Phát hiện lỗi dùng từ rõ ràng.

Không làm:
- Không viết lại toàn bộ câu.
- Không chỉnh văn phong nếu không sai.
- Không sửa tên riêng, thương hiệu, tên sản phẩm, thuật ngữ kỹ thuật.
- Không bịa lỗi.
- Không tự ý đổi các từ trong custom dictionary.

Danh sách từ giữ nguyên:
{{CUSTOM_DICTIONARY}}

Input gồm nhiều block, mỗi block có blockId:

[blockId=p_001 type=paragraph]
Chúng tôi luôn hổ trợ khách hang trong quá trình xử lí dử liệu.

Yêu cầu output:
- Chỉ trả JSON hợp lệ.
- Mỗi lỗi phải có blockId.
- Mỗi lỗi nên có beforeContext và afterContext để backend định vị đúng range.
- Nếu không chắc chắn, confidence = low.
- Nếu không có lỗi, trả {"issues":[]}.

Schema:
{
  "issues": [
    {
      "blockId": "p_001",
      "wrong": "khách hang",
      "suggestion": "khách hàng",
      "reason": "Thiếu dấu tiếng Việt",
      "type": "accent",
      "confidence": "high",
      "beforeContext": "luôn hổ trợ ",
      "afterContext": " trong quá trình",
      "shouldAutoApply": true
    }
  ]
}
```

---

## 14. Frontend data types

```ts
export type IssueStatus =
  | "pending"
  | "commented"
  | "highlighted"
  | "tracked"
  | "applied"
  | "ignored"
  | "needs_review";

export type IssueLocation = {
  blockId: string;
  blockType: "paragraph" | "heading" | "tableCell" | "header" | "footer" | "listItem";
  path: string;
  startOffset?: number;
  endOffset?: number;
  searchText: string;
  beforeContext?: string;
  afterContext?: string;
  commentId?: string;
  changeId?: string;
  anchorId?: string;
};

export type SpellingIssue = {
  id: string;
  documentId: string;
  wrong: string;
  suggestion: string;
  reason: string;
  type: "spelling" | "accent" | "typo" | "grammar" | "style";
  confidence: "high" | "medium" | "low";
  location: IssueLocation;
  status: IssueStatus;
};
```

---

## 15. Review sidebar card design

Card giống demo:

```txt
[Avatar] AI Spelling Checker
        COMMENTED / REPLACED / ADDED
        2:10 AM

Added comment on "khách hang"
Gợi ý: "khách hàng"
```

For replacement:

```txt
AI Spelling Checker
REPLACED
2:10 AM

Replaced "khách hang" with "khách hàng"
```

For highlight:

```txt
AI Spelling Checker
HIGHLIGHTED
2:10 AM

Highlighted possible spelling issue: "hổ trợ"
```

---

## 16. UI layout đề xuất

```txt
┌──────────────────────────────────────────────────────────────────────────┐
│ Import DOCX | v1.0 | Share | Agents ▼ | Chat | Theme | Export ▼          │
├──────────────────────────────────────────────────────────────────────────┤
│ Undo Redo | 100% | Arial | 20 | B I U S | Color | Highlight | Link ...   │
├──────────────────────────────────────────────┬───────────────────────────┤
│                                              │  Review Sidebar           │
│              SuperDoc Editor                 │  ┌─────────────────────┐  │
│                                              │  │ AI issue/comment card │  │
│   text with highlighted spelling issue       │  └─────────────────────┘  │
│                                              │                           │
├──────────────────────────────────────────────┴───────────────────────────┤
│                     AI command bar: What can I change?                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Phases triển khai mới

### Phase 1 — UI giống demo

```txt
[ ] AppTopBar
[ ] DocumentToolbar
[ ] SuperDocWorkspace
[ ] ReviewSidebar
[ ] AiCommandBar
[ ] AgentsDropdown
[ ] ExportDropdown
```

### Phase 2 — Backend SuperDoc read/write

```txt
[ ] Open DOCX bằng SuperDoc SDK
[ ] Extract blocks có blockId
[ ] Resolve range đúng vị trí
[ ] Add comment đúng range
[ ] Add highlight đúng range
[ ] Save reviewed.docx
```

### Phase 3 — Jump/focus đúng lỗi

```txt
[ ] BE trả location/anchor/commentId/changeId
[ ] FE click issue
[ ] Scroll tới block/range
[ ] Select/highlight đúng chữ sai
[ ] Mở comment/change tương ứng
```

### Phase 4 — Track changes giống demo

```txt
[ ] Replace text dưới dạng tracked change
[ ] Sidebar hiển thị Replaced "old" with "new"
[ ] Accept/reject change
[ ] Apply all high confidence
```

### Phase 5 — Agents/chat

```txt
[ ] AI command bar
[ ] Agents menu
[ ] Run agent endpoint
[ ] Agent result hiển thị ở sidebar
```

---

## 18. Acceptance criteria mới

Dự án chỉ được coi là đạt yêu cầu khi:

```txt
[ ] FE nhìn và thao tác gần giống demo SuperDoc
[ ] Upload/import DOCX chạy ổn
[ ] Toolbar editor có các chức năng cơ bản
[ ] Sidebar phải hiện comment/change/AI issue
[ ] LLM phát hiện được lỗi chính tả
[ ] BE ghi comment vào đúng từ sai trong DOCX
[ ] BE highlight được đúng từ sai trong DOCX
[ ] Click issue ở sidebar trỏ/focus đúng vị trí trong editor
[ ] Có thể replace wrong → suggestion bằng track changes
[ ] Review sidebar hiển thị Added/Replaced/Commented giống demo
[ ] Export reviewed.docx mở lại vẫn thấy comment/highlight/track changes
```

---

## 19. Những việc tuyệt đối không được làm

```txt
[ ] Không chỉ hiện lỗi ở panel mà không liên kết được với vị trí trong DOCX
[ ] Không sửa thẳng file mà không có comment/track changes
[ ] Không để LLM tự viết lại toàn bộ tài liệu
[ ] Không để frontend gọi OpenAI/local LLM trực tiếp
[ ] Không bịa SuperDoc API nếu SDK không hỗ trợ
[ ] Không bỏ qua bảng/header/footer nếu tài liệu có các phần này
[ ] Không đánh dấu sai tên riêng/thương hiệu trong dictionary
```

---

## 20. Prompt cho AI agent/dev làm theo file này

```txt
Bạn là Senior Full-stack Engineer chuyên về document editor, DOCX automation và AI agent.

Hãy đọc kỹ file HUONG_DAN_HOAN_THIEN_SUPERDOC_AI_DOCX_CHECKER_FULL_FEATURES.md và triển khai dự án đúng theo yêu cầu.

Mục tiêu:
Tạo hệ thống SuperDoc AI DOCX Checker giống demo SuperDoc tôi gửi: có import DOCX, editor toolbar, right review sidebar, highlight/bôi đúng vị trí, comment/track changes, AI chat bar, agents, export DOCX.

Yêu cầu bắt buộc:
1. Frontend và backend tách riêng.
2. Frontend dùng React/Vite/TypeScript/SuperDoc React.
3. Backend dùng Node.js/Express/TypeScript/SuperDoc SDK hoặc Document Engine.
4. Frontend không gọi LLM trực tiếp.
5. Backend giữ API key và gọi LLM.
6. LLM chỉ trả JSON issue.
7. Backend validate JSON bằng Zod.
8. Backend dùng SuperDoc để:
   - đọc cấu trúc DOCX;
   - resolve range lỗi;
   - add comment đúng vị trí;
   - highlight đúng chữ sai;
   - tạo track changes;
   - save/export reviewed.docx.
9. Frontend phải:
   - render SuperDoc editor;
   - có toolbar giống demo;
   - có review sidebar giống demo;
   - có AI command bar;
   - có agents menu;
   - click issue thì focus/scroll/bôi đúng vị trí lỗi;
   - reload reviewed.docx sau khi backend xử lý.
10. Nếu SuperDoc SDK version hiện tại không có API nào đó, hãy ghi rõ TODO và implement fallback hợp lý, không bịa API.

Thứ tự làm:
Phase 1: Làm UI giống demo.
Phase 2: Nối upload/import DOCX.
Phase 3: Backend đọc DOCX bằng SuperDoc.
Phase 4: LLM phát hiện lỗi chính tả.
Phase 5: Backend add comment + highlight vào đúng range.
Phase 6: FE reload reviewed.docx và focus issue.
Phase 7: Track changes + accept/reject.
Phase 8: Agents + AI chat command bar.
Phase 9: Export final/reviewed/report.

Kết quả bàn giao:
- Source code chạy được.
- README chi tiết.
- .env.example FE/BE.
- Test DOCX có lỗi chính tả.
- Demo được luồng:
  Import DOCX → Check chính tả → Highlight/comment đúng vị trí → Sidebar hiện issue → Click issue focus đúng lỗi → Export reviewed.docx.
```

---

## 21. Kết luận

Bản hoàn chỉnh không chỉ là:

```txt
FE hiện DOCX + BE trả list lỗi
```

Mà phải là:

```txt
SuperDoc editor đầy đủ
+
AI proofreader
+
comment/highlight/track changes đúng vị trí
+
review sidebar giống demo
+
click issue trỏ đúng range lỗi
+
export reviewed.docx giữ nguyên các annotation
```

Đây là yêu cầu cốt lõi để sản phẩm thật sự giống demo SuperDoc và dùng được cho kiểm tra chính tả DOCX chuyên nghiệp.
