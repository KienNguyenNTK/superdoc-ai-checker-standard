import type { PromptTemplate } from "../../domain/types.js";

export const translationConsistencyPrompt: PromptTemplate = {
  id: "translation_consistency",
  name: "Translation Consistency Checker",
  description: "Kiểm tra dịch thuật lệch glossary/ngữ cảnh",
  system: `Bạn là bộ kiểm tra sự nhất quán dịch thuật trong tài liệu DOCX.
Chỉ phát hiện khi có bằng chứng từ glossary hoặc ngữ cảnh tài liệu.
Không bịa lỗi. Chỉ trả JSON hợp lệ.`,
  userTemplate: `Glossary:
{{GLOSSARY}}

Context memory:
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
    maxTokens: 2200,
  },
};
