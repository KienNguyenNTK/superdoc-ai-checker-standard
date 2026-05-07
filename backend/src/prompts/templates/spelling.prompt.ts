import type { PromptTemplate } from "../../domain/types.js";

export const spellingPrompt: PromptTemplate = {
  id: "spelling",
  name: "Vietnamese Spelling Checker",
  description: "Kiểm tra chính tả tiếng Việt trong DOCX",
  system: `Bạn là bộ kiểm tra chính tả tiếng Việt cho tài liệu DOCX.

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

Chỉ trả JSON hợp lệ theo schema.`,
  userTemplate: `Input gồm nhiều block:

{{BLOCKS}}

Hãy kiểm tra chính tả và trả JSON.`,
  outputSchema: {
    type: "object",
    properties: {
      issues: { type: "array" },
    },
  },
  defaultModelOptions: {
    temperature: 0.1,
    maxTokens: 2000,
  },
};
