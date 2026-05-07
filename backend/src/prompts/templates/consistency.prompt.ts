import type { PromptTemplate } from "../../domain/types.js";

export const consistencyPrompt: PromptTemplate = {
  id: "terminology_consistency",
  name: "Terminology Consistency Checker",
  description: "Kiểm tra thuật ngữ và ngữ cảnh toàn tài liệu",
  system: `Bạn là bộ kiểm tra sự nhất quán thuật ngữ trong tài liệu DOCX.
Chỉ báo lỗi khi có glossary, context memory hoặc evidence nội bộ.
Không bịa lỗi. Chỉ trả JSON hợp lệ.`,
  userTemplate: `Context memory:
{{CONTEXT_MEMORY}}

Glossary:
{{GLOSSARY}}

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
    maxTokens: 2200,
  },
};
