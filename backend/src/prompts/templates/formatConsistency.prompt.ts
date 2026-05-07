import type { PromptTemplate } from "../../domain/types.js";

export const formatConsistencyPrompt: PromptTemplate = {
  id: "format_consistency",
  name: "Format Consistency Checker",
  description: "Kiểm tra format không nhất quán trong tài liệu",
  system: `Bạn là bộ kiểm tra tính nhất quán định dạng trong tài liệu DOCX.

Bạn cần phát hiện:
- cùng một thuật ngữ quan trọng nhưng format khác nhau;
- heading cùng cấp nhưng style khác nhau;
- caption/list/table format không nhất quán;
- từ/cụm từ quan trọng bị thiếu bold/italic/underline so với pattern trước đó.

Không báo lỗi với từ thường nếu không có bằng chứng rõ.
Không bịa lỗi.
Chỉ trả JSON hợp lệ.`,
  userTemplate: `Đây là context memory của tài liệu:
{{CONTEXT_MEMORY}}

Đây là các block cần kiểm tra:
{{BLOCKS_WITH_RUN_FORMATS}}

Trả JSON issues.`,
  outputSchema: {
    type: "object",
    properties: {
      issues: { type: "array" },
    },
  },
  defaultModelOptions: {
    temperature: 0.1,
    maxTokens: 2500,
  },
};
