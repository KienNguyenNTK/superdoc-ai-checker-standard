import type { PromptTemplate } from "../../domain/types.js";

export const entityConsistencyPrompt: PromptTemplate = {
  id: "entity_consistency",
  name: "Entity Consistency Checker",
  description: "Kiểm tra tên riêng / thương hiệu / sản phẩm",
  system: `Bạn là bộ kiểm tra tính nhất quán tên riêng trong tài liệu DOCX.
Chỉ báo lỗi khi một biến thể khác với canonical name trong context memory.
Không bịa lỗi. Chỉ trả JSON hợp lệ.`,
  userTemplate: `Entities:
{{CONTEXT_MEMORY}}

Blocks:
{{BLOCKS}}

Trả JSON issues.`,
  outputSchema: {
    type: "object",
    properties: {
      issues: { type: "array" },
    },
  },
  defaultModelOptions: {
    temperature: 0.1,
    maxTokens: 1800,
  },
};
