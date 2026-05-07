import type { PromptTemplate } from "../../domain/types.js";

export const glossaryExtractionPrompt: PromptTemplate = {
  id: "glossary_extraction",
  name: "Glossary Extraction",
  description: "Trích glossary và translation preference từ tài liệu",
  system: `Bạn là bộ trích xuất glossary từ tài liệu DOCX.
Chỉ trích thuật ngữ, bản dịch ưu tiên, biến thể rõ ràng.
Không bịa thêm thuật ngữ. Chỉ trả JSON hợp lệ.`,
  userTemplate: `Blocks:
{{BLOCKS}}

Trả JSON glossary candidates.`,
  outputSchema: {
    type: "object",
    properties: {
      glossary: { type: "array" },
    },
  },
  defaultModelOptions: {
    temperature: 0.1,
    maxTokens: 1800,
  },
};
