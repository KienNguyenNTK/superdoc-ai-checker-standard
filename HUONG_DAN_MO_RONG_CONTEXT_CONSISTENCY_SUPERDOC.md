# HƯỚNG DẪN MỞ RỘNG SUPERDOC AI DOCX CHECKER: KIỂM TRA NGỮ CẢNH, THUẬT NGỮ, FORMAT VÀ PROMPT LLM

> Mục tiêu: nâng cấp dự án SuperDoc AI DOCX Checker từ “kiểm tra chính tả” thành hệ thống kiểm tra tài liệu DOCX chuyên nghiệp, có thể kiểm tra ngữ cảnh toàn tài liệu, tính nhất quán thuật ngữ, tính nhất quán format như bold/italic/underline/color/highlight, kiểm tra dịch thuật, văn phong, xưng hô, tên riêng và cho phép chỉnh prompt LLM từ backend/admin UI.

---

## 1. Bài toán cần giải quyết

Người dùng không chỉ muốn sửa lỗi chính tả kiểu:

```txt
khách hang → khách hàng
dử liệu → dữ liệu
```

Mà còn muốn kiểm tra các lỗi khó hơn:

```txt
1. Ở trên từ “SuperDoc” được in đậm, bên dưới lại không in đậm.
2. Chương 1 dịch “document engine” là “bộ máy tài liệu”, chương 10 dịch thành “công cụ tài liệu”.
3. Đầu tài liệu dùng “người dùng”, cuối tài liệu dùng “khách hàng” cho cùng một nghĩa.
4. Tên riêng lúc viết “OpenAI”, lúc viết “Open Ai”.
5. Xưng hô lúc “chúng tôi”, lúc “bọn mình”.
6. Một thuật ngữ đã định nghĩa ở đầu tài liệu nhưng về sau dùng sai.
7. Một heading/table/list có format khác với các phần cùng cấp.
8. Người dịch dịch được nhiều trang, sau đó quên ngữ cảnh trước đó và dịch lệch thuật ngữ/văn phong.
```

Vì vậy cần thêm các module:

```txt
Spelling Checker
Format Consistency Checker
Terminology Consistency Checker
Translation Consistency Checker
Tone/Style Consistency Checker
Name/Entity Consistency Checker
Context Memory Builder
Prompt Template Manager
```

---

## 2. Tư duy kiến trúc mới

Hệ thống không nên chỉ làm:

```txt
DOCX → raw text → LLM → lỗi chính tả
```

Mà phải làm:

```txt
DOCX
↓
SuperDoc backend đọc text + structure + format runs + location
↓
Build Document Context Memory
↓
Build Glossary / Style Rules / Format Rules
↓
Rule Engine check lỗi rõ ràng
↓
LLM check lỗi cần hiểu ngữ cảnh
↓
Resolve range đúng vị trí
↓
SuperDoc ghi comment/highlight/track changes
↓
FE hiển thị sidebar và focus đúng lỗi
```

---

## 3. Các loại check cần hỗ trợ

### 3.1 Spelling Checker

Kiểm tra chính tả cơ bản:

```txt
khách hang → khách hàng
nhân viêng → nhân viên
sản phẫm → sản phẩm
dử liệu → dữ liệu
hổ trợ → hỗ trợ
cập nhập → cập nhật
```

### 3.2 Format Consistency Checker

Kiểm tra format không nhất quán:

```txt
- Cùng một thuật ngữ lúc bold, lúc không bold
- Cùng một từ lúc italic, lúc không italic
- Cùng heading level nhưng font/size/color khác
- Cùng kiểu note/caption nhưng format khác
- Thuật ngữ quan trọng ở lần đầu mỗi chương phải bold nhưng bị quên
```

Ví dụ:

```txt
Trang 1: “SuperDoc” bold = true
Trang 25: “SuperDoc” bold = false
→ Báo lỗi: Format consistency
```

### 3.3 Terminology Consistency Checker

Kiểm tra thuật ngữ không nhất quán:

```txt
document engine → bộ máy tài liệu
document engine → công cụ tài liệu
document engine → trình xử lý tài liệu
```

### 3.4 Translation Consistency Checker

Kiểm tra bản dịch có lệch ngữ cảnh không:

```txt
source term / concept / name / role / product name
→ cách dịch ở chương trước
→ cách dịch ở chương sau
→ phát hiện không thống nhất
```

### 3.5 Tone/Style Consistency Checker

Kiểm tra văn phong:

```txt
- Toàn tài liệu dùng văn phong trang trọng nhưng đoạn sau quá bình dân
- Lúc dùng “quý khách”, lúc dùng “bạn”
- Lúc dùng “chúng tôi”, lúc dùng “bọn mình”
- Lúc dịch theo phong cách kỹ thuật, lúc dịch quá marketing
```

### 3.6 Name/Entity Consistency Checker

Kiểm tra tên riêng:

```txt
OpenAI / Open Ai / Open-AI
SuperDoc / Super Doc
8AM Coffee / 8AM coffee / 8 Am Coffee
```

### 3.7 Number/Date/Unit Consistency Checker

Kiểm tra:

```txt
10% / 10 phần trăm
01/05/2026 / May 1, 2026
VND / VNĐ / đồng
kg / kilogram / kí
```

---

## 4. Backend cần đọc được những gì từ DOCX

Muốn check format và ngữ cảnh, backend phải đọc được nhiều hơn text.

Mỗi block cần có:

```ts
type DocumentBlock = {
  blockId: string;
  type:
    | "paragraph"
    | "heading"
    | "tableCell"
    | "header"
    | "footer"
    | "listItem"
    | "caption"
    | "footnote";

  text: string;
  path: string;
  page?: number;
  runs: DocumentRun[];
  metadata?: {
    headingLevel?: number;
    tableIndex?: number;
    rowIndex?: number;
    cellIndex?: number;
    listLevel?: number;
    styleName?: string;
  };
};

type DocumentRun = {
  runId: string;
  text: string;
  startOffset: number;
  endOffset: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  highlightColor?: string;
  styleName?: string;
};
```

Ví dụ:

```json
{
  "blockId": "p_001",
  "type": "paragraph",
  "text": "SuperDoc là document engine mạnh.",
  "path": "body.paragraph[1]",
  "runs": [
    {
      "runId": "r_001",
      "text": "SuperDoc",
      "startOffset": 0,
      "endOffset": 8,
      "bold": true,
      "italic": false
    },
    {
      "runId": "r_002",
      "text": " là document engine mạnh.",
      "startOffset": 8,
      "endOffset": 34,
      "bold": false
    }
  ]
}
```

---

## 5. Module mới cần thêm ở backend

Thêm thư mục:

```txt
backend/src/services/consistency/
├─ contextMemoryBuilder.ts
├─ glossaryExtractor.ts
├─ formatPatternAnalyzer.ts
├─ terminologyConsistencyChecker.ts
├─ translationConsistencyChecker.ts
├─ toneConsistencyChecker.ts
├─ entityConsistencyChecker.ts
├─ formatConsistencyChecker.ts
├─ consistencyPipeline.ts
└─ consistencyReporter.ts
```

Thêm thư mục prompt:

```txt
backend/src/prompts/
├─ promptRegistry.ts
├─ promptTemplateService.ts
├─ templates/
│  ├─ spelling.prompt.ts
│  ├─ consistency.prompt.ts
│  ├─ translationConsistency.prompt.ts
│  ├─ toneConsistency.prompt.ts
│  ├─ glossaryExtraction.prompt.ts
│  └─ formatConsistency.prompt.ts
└─ userPrompts/
   └─ customPromptStore.ts
```

Thêm thư mục rule engine:

```txt
backend/src/services/rules/
├─ ruleEngine.ts
├─ formatRules.ts
├─ terminologyRules.ts
├─ entityRules.ts
├─ dateNumberRules.ts
└─ customRules.ts
```

---

## 6. Document Context Memory là gì?

Document Context Memory là “bộ nhớ ngữ cảnh” của toàn bộ tài liệu.

Nó lưu:

```txt
- Thuật ngữ đã dùng
- Cách dịch ưu tiên
- Tên riêng
- Xưng hô
- Văn phong
- Format pattern
- Heading pattern
- Các định nghĩa quan trọng
- Các đoạn liên quan để so sánh
```

Schema đề xuất:

```ts
type DocumentContextMemory = {
  documentId: string;
  glossary: Array<{
    term: string;
    preferredTranslation?: string;
    alternatives: string[];
    firstSeenBlockId: string;
    occurrences: Array<{
      blockId: string;
      text: string;
      translation?: string;
      format?: RunFormatSnapshot;
    }>;
    confidence: "high" | "medium" | "low";
  }>;
  formatRules: Array<{
    target: string;
    ruleType:
      | "term_format"
      | "heading_format"
      | "table_format"
      | "caption_format"
      | "first_mention_format";
    expectedFormat: RunFormatSnapshot;
    examples: Array<{
      blockId: string;
      text: string;
    }>;
    confidence: "high" | "medium" | "low";
  }>;
  toneRules: Array<{
    rule: string;
    examples: string[];
    confidence: "high" | "medium" | "low";
  }>;
  entityRules: Array<{
    canonicalName: string;
    variants: string[];
    firstSeenBlockId: string;
  }>;
};

type RunFormatSnapshot = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  highlightColor?: string;
  fontFamily?: string;
  fontSize?: number;
  styleName?: string;
};
```

---

## 7. Luồng build context memory

API:

```http
POST /api/documents/:documentId/build-context
```

Backend làm:

```txt
1. Open DOCX bằng SuperDoc SDK
2. Extract DocumentBlock[] gồm text + runs + format
3. Rule engine tự phát hiện:
   - thuật ngữ lặp lại
   - tên riêng
   - format pattern
   - heading pattern
4. LLM hỗ trợ trích xuất:
   - glossary
   - văn phong
   - quy tắc dịch
   - xưng hô
5. Lưu:
   uploads/{documentId}/context-memory.json
   uploads/{documentId}/glossary.json
   uploads/{documentId}/format-rules.json
```

Response:

```json
{
  "documentId": "doc_123",
  "status": "context_built",
  "summary": {
    "terms": 128,
    "formatRules": 24,
    "toneRules": 7,
    "entities": 46
  },
  "contextMemoryUrl": "/files/doc_123/context-memory.json"
}
```

---

## 8. Luồng check consistency

API:

```http
POST /api/documents/:documentId/analyze-consistency
```

Body:

```json
{
  "checks": [
    "format",
    "terminology",
    "translation",
    "tone",
    "entity",
    "date_number"
  ],
  "mode": "comment_and_highlight",
  "useLLM": true,
  "useRuleEngine": true,
  "maxIssues": 300
}
```

Backend làm:

```txt
1. Open DOCX bằng SuperDoc SDK
2. Extract DocumentBlock[] đầy đủ text + format runs
3. Load context-memory.json
4. Rule engine check lỗi rõ ràng
5. LLM check lỗi cần ngữ nghĩa
6. Merge issues
7. Resolve range
8. Add comment/highlight/track changes bằng SuperDoc
9. Save reviewed-consistency.docx
10. Return issues + reviewedFileUrl
```

---

## 9. Issue schema mở rộng

```ts
type IssueType =
  | "spelling"
  | "accent"
  | "typo"
  | "grammar"
  | "style"
  | "terminology_consistency"
  | "translation_consistency"
  | "format_consistency"
  | "capitalization_consistency"
  | "tone_consistency"
  | "name_consistency"
  | "date_number_consistency"
  | "heading_consistency"
  | "table_format_consistency";

type Issue = {
  id: string;
  documentId: string;
  type: IssueType;
  wrong: string;
  suggestion: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  severity: "info" | "warning" | "error";
  source: "rule_engine" | "llm" | "hybrid";
  location: {
    blockId: string;
    blockType: string;
    path: string;
    startOffset?: number;
    endOffset?: number;
    runIds?: string[];
    searchText?: string;
    beforeContext?: string;
    afterContext?: string;
    commentId?: string;
    changeId?: string;
    anchorId?: string;
  };
  evidence?: Array<{
    blockId: string;
    text: string;
    note: string;
  }>;
  status:
    | "pending"
    | "commented"
    | "highlighted"
    | "tracked"
    | "applied"
    | "ignored"
    | "needs_review";
};
```

---

## 10. Prompt LLM nằm ở đâu để sửa?

Nên thiết kế để sửa prompt dễ dàng.

### 10.1 Cấu trúc thư mục prompt

```txt
backend/src/prompts/
├─ promptRegistry.ts
├─ promptTemplateService.ts
├─ templates/
│  ├─ spelling.prompt.ts
│  ├─ consistency.prompt.ts
│  ├─ translationConsistency.prompt.ts
│  ├─ formatConsistency.prompt.ts
│  ├─ glossaryExtraction.prompt.ts
│  ├─ toneConsistency.prompt.ts
│  └─ entityConsistency.prompt.ts
└─ userPrompts/
   └─ customPromptStore.ts
```

### 10.2 promptRegistry.ts

```ts
export type PromptId =
  | "spelling"
  | "format_consistency"
  | "translation_consistency"
  | "terminology_consistency"
  | "tone_consistency"
  | "glossary_extraction"
  | "entity_consistency";

export const promptRegistry: Record<PromptId, PromptTemplate> = {
  spelling: spellingPrompt,
  format_consistency: formatConsistencyPrompt,
  translation_consistency: translationConsistencyPrompt,
  terminology_consistency: terminologyConsistencyPrompt,
  tone_consistency: toneConsistencyPrompt,
  glossary_extraction: glossaryExtractionPrompt,
  entity_consistency: entityConsistencyPrompt,
};
```

### 10.3 Prompt template type

```ts
export type PromptTemplate = {
  id: string;
  name: string;
  description: string;
  system: string;
  userTemplate: string;
  outputSchema: object;
  defaultModelOptions?: {
    temperature?: number;
    maxTokens?: number;
  };
};
```

### 10.4 Ví dụ spelling.prompt.ts

```ts
export const spellingPrompt = {
  id: "spelling",
  name: "Vietnamese Spelling Checker",
  description: "Kiểm tra chính tả tiếng Việt trong DOCX",
  system: `
Bạn là bộ kiểm tra chính tả tiếng Việt cho tài liệu DOCX.

Chỉ phát hiện:
- lỗi chính tả rõ ràng;
- lỗi sai dấu tiếng Việt;
- lỗi gõ nhầm;
- lỗi dùng từ rõ ràng.

Không làm:
- không viết lại toàn bộ câu;
- không sửa tên riêng, thương hiệu, tên sản phẩm, thuật ngữ kỹ thuật;
- không tự ý đổi văn phong;
- không bịa lỗi.

Danh sách từ giữ nguyên:
{{CUSTOM_DICTIONARY}}

Chỉ trả JSON hợp lệ theo schema.
`,
  userTemplate: `
Input gồm nhiều block:

{{BLOCKS}}

Hãy kiểm tra chính tả và trả JSON.
`,
};
```

### 10.5 Ví dụ formatConsistency.prompt.ts

```ts
export const formatConsistencyPrompt = {
  id: "format_consistency",
  name: "Format Consistency Checker",
  description: "Kiểm tra format không nhất quán trong tài liệu",
  system: `
Bạn là bộ kiểm tra tính nhất quán định dạng trong tài liệu DOCX.

Bạn cần phát hiện:
- cùng một thuật ngữ quan trọng nhưng format khác nhau;
- heading cùng cấp nhưng style khác nhau;
- caption/list/table format không nhất quán;
- từ/cụm từ quan trọng bị thiếu bold/italic/underline so với pattern trước đó.

Không báo lỗi với từ thường nếu không có bằng chứng rõ.
Không bịa lỗi.
Chỉ trả JSON hợp lệ.
`,
  userTemplate: `
Đây là context memory của tài liệu:
{{CONTEXT_MEMORY}}

Đây là các block cần kiểm tra:
{{BLOCKS_WITH_RUN_FORMATS}}

Trả JSON issues.
`,
};
```

---

## 11. Có sửa prompt được từ UI không?

Nên có. Thêm Admin Prompt Editor.

### 11.1 Backend API prompt

```http
GET /api/prompts
GET /api/prompts/:promptId
PUT /api/prompts/:promptId
POST /api/prompts/:promptId/test
POST /api/prompts/:promptId/reset
```

### 11.2 Frontend Prompt Editor

Thêm page:

```txt
/frontend/src/pages/PromptSettingsPage.tsx
```

Tính năng:

```txt
- Chọn prompt
- Sửa system prompt
- Sửa user template
- Sửa temperature/maxTokens
- Test prompt với sample
- Validate JSON output
- Save
- Reset default
```

---

## 12. Prompt variables nên hỗ trợ

Prompt template cần hỗ trợ biến:

```txt
{{CUSTOM_DICTIONARY}}
{{DOCUMENT_TITLE}}
{{DOCUMENT_LANGUAGE}}
{{CHECK_MODE}}
{{CONTEXT_MEMORY}}
{{GLOSSARY}}
{{FORMAT_RULES}}
{{TONE_RULES}}
{{BLOCKS}}
{{BLOCKS_WITH_RUN_FORMATS}}
{{SELECTED_TEXT}}
{{USER_INSTRUCTION}}
```

Ví dụ render:

```ts
const renderedPrompt = renderTemplate(prompt.userTemplate, {
  CUSTOM_DICTIONARY: dictionaryText,
  CONTEXT_MEMORY: JSON.stringify(contextMemory),
  BLOCKS_WITH_RUN_FORMATS: formatBlocksForPrompt(blocks),
});
```

---

## 13. Rule Engine vs LLM: dùng cái nào cho check gì?

### 13.1 Dùng rule engine

Phù hợp:

```txt
- Bold/italic/underline/color không nhất quán
- Tên riêng viết khác nhau
- Ngày tháng/đơn vị không nhất quán
- Glossary exact match
- Heading style mismatch
- Table style mismatch
```

Ưu điểm:

```txt
- Nhanh
- Rẻ
- Ổn định
- Không hallucinate
```

### 13.2 Dùng LLM

Phù hợp:

```txt
- Dịch thuật lệch nghĩa
- Văn phong lệch
- Thuật ngữ có thể tương đương nhưng không exact
- Xưng hô theo ngữ cảnh
- Ý nghĩa câu có mâu thuẫn
```

### 13.3 Hybrid

Cách tốt nhất:

```txt
Rule engine phát hiện candidate
→ LLM xác nhận/giải thích
→ Backend ghi comment/highlight
```

---

## 14. UI cần thêm cho Context/Consistency Checker

### 14.1 Agents menu

Thêm agents:

```txt
- Vietnamese Spelling Checker
- Format Consistency Checker
- Terminology Consistency Checker
- Translation Consistency Checker
- Tone Consistency Checker
- Entity/Name Consistency Checker
- Full Document Consistency Checker
```

### 14.2 Sidebar filters

Thêm filter:

```txt
Tất cả
Chính tả
Format
Thuật ngữ
Dịch thuật
Văn phong
Tên riêng
Ngày/số/đơn vị
```

### 14.3 Context Memory page/panel

Thêm panel:

```txt
Document Memory
- Glossary
- Format rules
- Tone rules
- Entities
- User custom rules
```

Người dùng có thể sửa:

```txt
document engine = bộ máy tài liệu
user = người dùng
SuperDoc = luôn bold ở lần đầu mỗi chương
```

### 14.4 Prompt Settings page

Chỉ admin/dev dùng.

```txt
Settings → AI Prompts
```

Cho sửa:

```txt
- spelling prompt
- format consistency prompt
- translation consistency prompt
- tone consistency prompt
- glossary extraction prompt
```

---

## 15. API mới cần thêm

### 15.1 Build context

```http
POST /api/documents/:documentId/build-context
```

### 15.2 Get context memory

```http
GET /api/documents/:documentId/context
```

### 15.3 Update glossary

```http
PUT /api/documents/:documentId/glossary
```

### 15.4 Analyze consistency

```http
POST /api/documents/:documentId/analyze-consistency
```

### 15.5 Analyze selected range

```http
POST /api/documents/:documentId/analyze-selection
```

Body:

```json
{
  "selection": {
    "blockId": "p_001",
    "startOffset": 0,
    "endOffset": 100
  },
  "checks": ["spelling", "translation", "format"]
}
```

### 15.6 Prompt APIs

```http
GET /api/prompts
GET /api/prompts/:promptId
PUT /api/prompts/:promptId
POST /api/prompts/:promptId/test
POST /api/prompts/:promptId/reset
```

---

## 16. Pipeline hoàn chỉnh cho tài liệu dài

Với file 100 trang, không được gửi toàn bộ vào LLM một lần.

```txt
1. Upload DOCX
2. Extract structure bằng SuperDoc
3. Build context memory toàn tài liệu
4. Lưu memory
5. Check bằng rule engine toàn tài liệu
6. Với các phần cần hiểu nghĩa:
   - chia theo chunk
   - lấy context liên quan từ memory
   - gửi LLM
7. Merge issues
8. Resolve location
9. Add comment/highlight/track changes
10. Save reviewed.docx
```

Chunk format:

```txt
[blockId=p_001 type=heading page=1]
Chương 1: Giới thiệu SuperDoc

[blockId=p_002 type=paragraph page=1]
SuperDoc là bộ máy tài liệu...

[runs]
0-8: "SuperDoc" bold=true
9-...
```

Context gửi kèm:

```txt
Glossary:
- document engine = bộ máy tài liệu
- track changes = theo dõi thay đổi

Format rules:
- SuperDoc first mention in chapter: bold=true

Tone:
- formal
- use "người dùng", not "khách hàng" unless talking about paying customers
```

---

## 17. Cách xử lý format consistency “bold ở trên, dưới không bold”

### 17.1 Extract format

Backend cần lấy các runs:

```json
{
  "text": "SuperDoc",
  "bold": true,
  "blockId": "p_001",
  "startOffset": 0,
  "endOffset": 8
}
```

và:

```json
{
  "text": "SuperDoc",
  "bold": false,
  "blockId": "p_088",
  "startOffset": 12,
  "endOffset": 20
}
```

### 17.2 Detect pattern

```txt
Term: SuperDoc
Pattern: first mention in section/chapter should be bold
Violation: p_088, bold=false
```

### 17.3 Create issue

```json
{
  "type": "format_consistency",
  "wrong": "SuperDoc",
  "suggestion": "In đậm từ SuperDoc",
  "reason": "Ở các phần trước, SuperDoc được in đậm khi xuất hiện như thuật ngữ chính.",
  "confidence": "high",
  "location": {
    "blockId": "p_088",
    "startOffset": 12,
    "endOffset": 20
  }
}
```

### 17.4 Write to DOCX

Backend dùng SuperDoc:

```txt
- highlight từ SuperDoc
- add comment: “Nên in đậm để thống nhất với các lần xuất hiện trước”
- nếu user apply: set bold=true cho range
```

---

## 18. Apply issue cho consistency

API:

```http
POST /api/documents/:documentId/issues/:issueId/apply
```

Nếu issue type là:

```txt
format_consistency
```

Backend apply:

```txt
- set bold/italic/underline/color theo suggestion
```

Nếu issue type là:

```txt
translation_consistency
```

Backend apply:

```txt
- replace wrong → suggestion bằng track changes
```

Nếu issue type là:

```txt
tone_consistency
```

Backend nên:

```txt
- không auto apply mặc định
- chỉ comment vì cần người duyệt
```

---

## 19. Settings cho từng loại check

Thêm config:

```json
{
  "checks": {
    "spelling": {
      "enabled": true,
      "mode": "comment_and_highlight",
      "autoApplyHighConfidence": false
    },
    "formatConsistency": {
      "enabled": true,
      "checkBold": true,
      "checkItalic": true,
      "checkUnderline": true,
      "checkHeadingStyles": true,
      "checkFirstMentionInChapter": true
    },
    "translationConsistency": {
      "enabled": true,
      "useGlossary": true,
      "inferGlossary": true,
      "requireUserConfirmGlossary": false
    },
    "toneConsistency": {
      "enabled": true,
      "targetTone": "formal"
    }
  }
}
```

Có thể lưu tại:

```txt
uploads/{documentId}/check-config.json
```

hoặc DB.

---

## 20. Acceptance criteria

Dự án đạt yêu cầu khi:

```txt
[ ] Upload DOCX dài 100 trang được
[ ] Build context memory được
[ ] Extract được text + format runs
[ ] Check chính tả được
[ ] Check thuật ngữ không nhất quán được
[ ] Check format bold/italic/underline không nhất quán được
[ ] Check tên riêng không nhất quán được
[ ] LLM prompt có thể sửa ở backend
[ ] Có Prompt Settings API/UI
[ ] Issue có location rõ
[ ] Click issue focus đúng vị trí
[ ] Backend add comment/highlight/track changes đúng vị trí
[ ] Apply format issue có thể set bold/italic/underline
[ ] Export reviewed.docx mở lại vẫn giữ comment/highlight/track changes
```

---

## 21. Prompt ngắn để giao dev/AI agent

```txt
Đọc kỹ file HUONG_DAN_MO_RONG_CONTEXT_CONSISTENCY_SUPERDOC.md và triển khai mở rộng dự án SuperDoc AI DOCX Checker.

Mục tiêu: không chỉ kiểm tra chính tả, mà còn kiểm tra ngữ cảnh, thuật ngữ, dịch thuật, văn phong, tên riêng và format consistency trong DOCX. Ví dụ: nếu từ “SuperDoc” ở trên in đậm nhưng ở dưới không in đậm, hệ thống phải phát hiện, highlight đúng vị trí, add comment và cho phép apply để in đậm lại.

Yêu cầu:
- Backend dùng SuperDoc để đọc text + structure + format runs, không chỉ raw text.
- Tạo Document Context Memory gồm glossary, format rules, tone rules, entity rules.
- Thêm rule engine để check các lỗi rõ ràng như bold/italic/heading/table/style mismatch.
- Thêm LLM consistency checker để check thuật ngữ/dịch thuật/văn phong/ngữ cảnh.
- LLM chỉ trả JSON issue, backend validate bằng Zod.
- Issue phải có blockId/path/startOffset/endOffset/beforeContext/afterContext.
- Backend dùng SuperDoc add comment/highlight/track changes đúng range.
- Frontend có sidebar filter theo loại lỗi: spelling, format, terminology, translation, tone, entity.
- Click issue phải focus/bôi đúng vị trí.
- Có Prompt Template Manager ở backend để sửa prompt LLM.
- Có API/UI để xem/sửa/test prompt: GET/PUT/POST test /api/prompts.
- Có custom dictionary/glossary để người dùng chỉnh thuật ngữ.
- Không bịa SuperDoc API; nếu chưa hỗ trợ thì ghi TODO và fallback.

Bàn giao source code chạy được, README, .env.example, API docs, test DOCX 100 trang và TODO rõ ràng.
```

---

## 22. Kết luận

Để làm đúng yêu cầu “dịch nhiều trang rồi check ngữ cảnh về sau có lệch không”, dự án cần thêm 3 năng lực lớn:

```txt
1. Document Context Memory
   Ghi nhớ thuật ngữ, văn phong, format, tên riêng toàn tài liệu.

2. Consistency Checkers
   Rule engine + LLM để kiểm tra format, dịch thuật, thuật ngữ, văn phong.

3. Prompt Manager
   Cho phép sửa prompt LLM theo từng loại check mà không phải sửa code nhiều.
```

Khi hoàn thiện, hệ thống sẽ không chỉ sửa chính tả mà còn hoạt động như một AI reviewer cho tài liệu DOCX dài, đặc biệt phù hợp cho sách dịch, hợp đồng, tài liệu kỹ thuật và tài liệu nội bộ nhiều trang.
