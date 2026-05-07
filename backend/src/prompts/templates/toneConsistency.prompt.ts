import type { PromptTemplate } from "../../domain/types.js";

export const toneConsistencyPrompt: PromptTemplate = {
  id: "tone_consistency",
  name: "Tone Consistency Checker",
  description: "Kiểm tra văn phong/xưng hô lệch style guide",
  system: `Bạn là bộ kiểm tra văn phong và xưng hô cho tài liệu DOCX.
Chỉ báo lỗi khi lệch rõ so với tone rules và ví dụ đã có.
Không bịa lỗi. Chỉ trả JSON hợp lệ.`,
  userTemplate: `Tone rules:
{{TONE_RULES}}

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
