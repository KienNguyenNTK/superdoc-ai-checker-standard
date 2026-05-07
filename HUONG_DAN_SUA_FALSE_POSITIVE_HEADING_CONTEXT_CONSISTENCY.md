# HƯỚNG DẪN SỬA FALSE POSITIVE: HEADING/TITLE BỊ SO SÁNH SAI NHÓM TRONG FORMAT CONSISTENCY CHECKER

> Mục tiêu: sửa lỗi hệ thống đang báo sai “heading lệch định dạng” do đem **title chính của tài liệu** so với **section heading** như `1. Giới thiệu`, `2. Danh sách yêu cầu...`. Đây là false positive vì các loại heading này có vai trò khác nhau, không được so sánh cùng nhóm.

---

## 1. Vấn đề hiện tại

Trong UI, hệ thống báo lỗi kiểu:

```txt
1. Giới thiệu → Chuẩn hóa style heading level 1
2. Danh sách yêu cầu kiểm thử → Chuẩn hóa style heading level 1
3. Bảng dữ liệu mẫu → Chuẩn hóa style heading level 1
```

Nhưng nhìn bằng mắt thì các heading mục này đang giống nhau.

Khả năng cao backend đang làm như sau:

```ts
const headings = blocks.filter(block => block.type === "heading");
const basePattern = headings[0];
compareAllHeadingsWithBasePattern(headings, basePattern);
```

Vấn đề là `headings[0]` thường là title lớn đầu tài liệu:

```txt
TÀI LIỆU TEST KIỂM TRA CHÍNH TẢ DOCX
```

Sau đó hệ thống đem title này so với:

```txt
1. Giới thiệu
2. Danh sách yêu cầu kiểm thử
3. Bảng dữ liệu mẫu
```

Về mặt XML hoặc style, chúng có thể cùng bị parse là heading hoặc heading level 1, nhưng về mặt nghiệp vụ thì khác nhóm.

---

## 2. Kết luận nghiệp vụ

Không được so sánh:

```txt
document_title ↔ section_heading
document_title ↔ chapter_heading
title_page ↔ heading level 1
table_title ↔ section_heading
caption ↔ heading
```

Chỉ được so sánh trong cùng nhóm semantic role:

```txt
document_title ↔ document_title
chapter_heading ↔ chapter_heading
section_heading_level_1 ↔ section_heading_level_1
section_heading_level_2 ↔ section_heading_level_2
table_title ↔ table_title
figure_caption ↔ figure_caption
```

Nếu một nhóm chỉ có 1 item thì không check consistency.

---

## 3. Cần thêm semantic heading grouping

Tạo file:

```txt
backend/src/services/consistency/headingClassifier.ts
```

### Type đề xuất

```ts
export type HeadingSemanticRole =
  | "document_title"
  | "document_subtitle"
  | "chapter_heading"
  | "section_heading_level_1"
  | "section_heading_level_2"
  | "section_heading_level_3"
  | "table_title"
  | "figure_caption"
  | "appendix_heading"
  | "normal_heading"
  | "unknown";
```

### Function classifyHeading

```ts
export function classifyHeading(block: DocumentBlock): HeadingSemanticRole {
  const text = normalizeHeadingText(block.text);
  const headingLevel = block.metadata?.headingLevel;
  const page = block.page ?? block.metadata?.page;
  const isFirstPage = page === 1 || block.metadata?.isFirstPage === true;

  // Title chính: thường ở trang đầu, chữ dài, all caps, không có numbering
  if (
    isFirstPage &&
    !hasSectionNumbering(text) &&
    isLikelyDocumentTitle(text, block)
  ) {
    return "document_title";
  }

  if (isSubtitle(text, block)) {
    return "document_subtitle";
  }

  if (/^(chương|chapter)\s+\d+/i.test(text)) {
    return "chapter_heading";
  }

  if (/^\d+\.\s+\S+/.test(text)) {
    return "section_heading_level_1";
  }

  if (/^\d+\.\d+\s+\S+/.test(text)) {
    return "section_heading_level_2";
  }

  if (/^\d+\.\d+\.\d+\s+\S+/.test(text)) {
    return "section_heading_level_3";
  }

  if (/^(bảng|table)\s+\d+/i.test(text)) {
    return "table_title";
  }

  if (/^(hình|figure|fig\.)\s+\d+/i.test(text)) {
    return "figure_caption";
  }

  if (/^(phụ lục|appendix)\s+/i.test(text)) {
    return "appendix_heading";
  }

  if (headingLevel) {
    return `normal_heading` as HeadingSemanticRole;
  }

  return "unknown";
}
```

### Helper functions

```ts
function normalizeHeadingText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function hasSectionNumbering(text: string) {
  return /^\d+(\.\d+)*\.??\s+/.test(text);
}

function isLikelyDocumentTitle(text: string, block: DocumentBlock) {
  const words = text.split(/\s+/).filter(Boolean);
  const upperRatio =
    text.replace(/[^A-ZÀ-Ỹ]/g, "").length /
    Math.max(1, text.replace(/[^A-Za-zÀ-ỹ]/g, "").length);

  const visual = getVisualStyle(block);

  return (
    words.length >= 4 &&
    upperRatio > 0.65 &&
    visual.fontSize >= 16 &&
    visual.bold === true
  );
}

function isSubtitle(text: string, block: DocumentBlock) {
  const visual = getVisualStyle(block);
  return visual.italic === true && visual.fontSize <= 13 && text.length > 10;
}
```

---

## 4. Group heading theo semantic role

Tạo file:

```txt
backend/src/services/consistency/headingConsistencyChecker.ts
```

Không làm:

```ts
const headings = blocks.filter(b => b.type === "heading");
checkAllTogether(headings);
```

Mà làm:

```ts
const headingGroups = groupBy(
  blocks.filter(isHeadingLike),
  block => classifyHeading(block)
);

for (const [role, items] of headingGroups.entries()) {
  if (items.length < 2) continue;
  if (role === "document_title") continue; // thường chỉ có 1 title
  checkHeadingGroupConsistency(role, items);
}
```

---

## 5. Normalize visual style trước khi so sánh

DOCX có thể nhìn giống nhưng XML khác nhau. Không được so sánh raw XML/run-by-run.

Tạo file:

```txt
backend/src/services/consistency/visualStyleNormalizer.ts
```

### Visual style snapshot

```ts
type VisualStyleSnapshot = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlightColor?: string;
  alignment?: string;
  styleName?: string;
};
```

### Normalize

```ts
export function getVisualStyle(block: DocumentBlock): VisualStyleSnapshot {
  const runs = block.runs ?? [];

  return {
    bold: dominantBoolean(runs.map(r => r.bold)),
    italic: dominantBoolean(runs.map(r => r.italic)),
    underline: dominantBoolean(runs.map(r => r.underline)),
    fontSize: roundFontSize(dominantNumber(runs.map(r => r.fontSize))),
    fontFamily: normalizeFontFamily(dominantString(runs.map(r => r.fontFamily))),
    color: normalizeColor(dominantString(runs.map(r => r.color))),
    highlightColor: normalizeHighlight(dominantString(runs.map(r => r.highlightColor))),
    styleName: normalizeStyleName(block.metadata?.styleName),
  };
}
```

Bỏ qua:

```txt
- run count
- numbering text: 1., 2., 3.
- khoảng trắng
- styleName khác nhưng visual giống
- highlight tạm do AI/selection tạo ra
- metadata không ảnh hưởng hiển thị
```

---

## 6. Rule so sánh heading đúng

Chỉ báo mismatch nếu khác biệt visual rõ ràng.

Ví dụ:

```ts
function compareHeadingVisualStyle(
  base: VisualStyleSnapshot,
  current: VisualStyleSnapshot
) {
  const diffs: string[] = [];

  if (base.bold !== current.bold) diffs.push("bold");
  if (base.italic !== current.italic) diffs.push("italic");
  if (base.underline !== current.underline) diffs.push("underline");

  if (
    base.fontSize != null &&
    current.fontSize != null &&
    Math.abs(base.fontSize - current.fontSize) >= 2
  ) {
    diffs.push("fontSize");
  }

  if (isColorClearlyDifferent(base.color, current.color)) {
    diffs.push("color");
  }

  if (isHighlightClearlyDifferent(base.highlightColor, current.highlightColor)) {
    diffs.push("highlightColor");
  }

  // Không báo nếu chỉ khác 1 thứ nhỏ, trừ khi đó là bold/heading quan trọng
  const severe = diffs.includes("bold") || diffs.includes("fontSize");
  const shouldReport = diffs.length >= 2 || severe;

  return {
    shouldReport,
    diffs,
  };
}
```

---

## 7. Chọn baseline đúng cho từng group

Không lấy item đầu tiên làm chuẩn nếu item đầu tiên có thể lỗi.

Nên dùng majority/dominant pattern:

```ts
function getDominantVisualPattern(items: DocumentBlock[]) {
  const styles = items.map(getVisualStyle);
  return {
    bold: majority(styles.map(s => s.bold)),
    italic: majority(styles.map(s => s.italic)),
    underline: majority(styles.map(s => s.underline)),
    fontSize: majorityRounded(styles.map(s => s.fontSize)),
    color: majorityColor(styles.map(s => s.color)),
    highlightColor: majorityHighlight(styles.map(s => s.highlightColor)),
  };
}
```

Ví dụ:

```txt
1. Giới thiệu                  → bold=true, blue, pink highlight
2. Danh sách yêu cầu kiểm thử  → bold=true, blue, pink highlight
3. Bảng dữ liệu mẫu            → bold=true, blue, pink highlight
4. Đoạn văn dài                → bold=false, black, no highlight
```

Dominant pattern là 3 item đầu. Item số 4 mới bị báo lỗi.

---

## 8. Issue reason phải nói rõ so với nhóm nào

Issue không được ghi mơ hồ:

```txt
Heading cùng cấp đang lệch định dạng so với pattern trước đó.
```

Phải ghi rõ:

```txt
Heading này thuộc nhóm section_heading_level_1 nhưng lệch với pattern phổ biến của 3 heading cùng nhóm: bold=true, color=blue, highlight=pink. Hiện tại bold=false, color=black, không có highlight.
```

Schema issue nên thêm:

```ts
evidence: [
  {
    blockId: "p_002",
    text: "1. Giới thiệu",
    note: "Heading cùng nhóm, style chuẩn"
  },
  {
    blockId: "p_010",
    text: "2. Danh sách yêu cầu kiểm thử",
    note: "Heading cùng nhóm, style chuẩn"
  }
]
```

---

## 9. Acceptance criteria

Fix được coi là đạt khi:

```txt
[ ] Không còn so document title với section heading.
[ ] Không báo false positive cho các heading nhìn giống nhau.
[ ] Chỉ so heading trong cùng semantic role.
[ ] Group có 1 item thì bỏ qua.
[ ] Baseline dùng majority pattern, không dùng heading đầu tiên một cách mù quáng.
[ ] Bỏ qua numbering/run count/khoảng trắng.
[ ] Bỏ qua highlight tạm của AI/selection.
[ ] Báo lỗi đúng khi một section heading thật sự lệch style.
[ ] Issue reason nêu rõ group và evidence.
```

---

## 10. Prompt ngắn để giao AI/dev sửa

```txt
Đọc file HUONG_DAN_SUA_FALSE_POSITIVE_HEADING_CONTEXT_CONSISTENCY.md và sửa Format Consistency Checker phần heading.

Hiện hệ thống đang báo false positive vì đem title chính của tài liệu như “TÀI LIỆU TEST KIỂM TRA...” so với các section heading như “1. Giới thiệu”, “2. Danh sách...”. Đây là sai nghiệp vụ.

Yêu cầu sửa:
- Thêm semantic heading grouping: document_title, document_subtitle, chapter_heading, section_heading_level_1, section_heading_level_2, table_title, figure_caption, appendix_heading.
- Chỉ so sánh format trong cùng group.
- Không so document_title với section_heading.
- Nếu group chỉ có 1 item thì bỏ qua.
- Normalize visual style trước khi so sánh.
- Bỏ qua numbering, run count, khoảng trắng, styleName khác nhưng visual giống, highlight tạm do AI/selection.
- Dùng majority/dominant pattern làm baseline thay vì lấy heading đầu tiên.
- Chỉ báo lỗi khi khác biệt visual rõ ràng: bold khác, font size lệch >=2pt, màu chữ khác rõ, highlight/background khác rõ.
- Issue phải có reason rõ so với nhóm nào và evidence các heading cùng nhóm.

Sau khi sửa, test bằng file DOCX có:
1. title chính rất to;
2. nhiều section heading giống nhau;
3. một section heading cố ý lệch style;
4. một table title;
5. một caption.

Kết quả mong muốn:
- Không báo lỗi cho title chính.
- Không báo lỗi cho các section heading giống nhau.
- Chỉ báo lỗi cho heading cố ý lệch style.
```
