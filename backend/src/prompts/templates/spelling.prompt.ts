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
- lỗi dùng từ rõ ràng;
- từ hoặc cụm từ nghi vấn không nằm trong allowlist nền, nếu có bằng chứng ngữ cảnh.

Không làm:
- không viết lại toàn bộ câu;
- không sửa tên riêng, thương hiệu, tên sản phẩm, thuật ngữ kỹ thuật;
- không tự ý đổi văn phong;
- không bịa lỗi.

Danh sách từ giữ nguyên:
{{CUSTOM_DICTIONARY}}

Danh sách nghi vấn từ heuristic/dictionary:
{{SUSPICIOUS_CANDIDATES}}

Quy tắc trả kết quả:
- Chỉ trả JSON hợp lệ theo schema.
- Nếu chắc chắn là lỗi, dùng status="pending".
- Nếu nghi vấn nhưng chưa đủ chắc chắn để tự sửa, dùng status="needs_review".
- Không trả issue trùng nhau.
- Không đề xuất sửa toàn bộ câu; chỉ sửa từ/cụm từ sai.
- Giữ nguyên tên riêng, thương hiệu, từ kỹ thuật như OpenAI, React, TypeScript, DOCX, Node.js, SuperDoc.

`,
  userTemplate: `Input gồm nhiều block:

{{BLOCKS}}

Hãy kiểm tra exhaustively toàn bộ block, bao gồm cả ví dụ minh họa và ghi chú lỗi cố ý, rồi trả JSON.`,
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
