import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import mammoth from "mammoth";
import OpenAI from "openai";
import { z } from "zod";

const app = express();

const PORT = Number(process.env.API_PORT || 8787);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const MODEL = process.env.LOCAL_LLM_MODEL || "gpt-4o-mini";
const BASE_URL = process.env.LOCAL_LLM_BASE_URL || "https://api.openai.com/v1";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});

const openai = new OpenAI({
  apiKey: process.env.LOCAL_LLM_API_KEY || "local",
  baseURL: BASE_URL,
});

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
  })
);
app.use(express.json());

const IssueSchema = z.object({
  wrong: z.string(),
  suggestion: z.string(),
  reason: z.string(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  blockLabel: z.string().optional(),
  excerpt: z.string().optional(),
});

const LlmResultSchema = z.object({
  issues: z.array(IssueSchema),
});

function safeJsonParse(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }

  return JSON.parse(cleaned);
}

function splitTextIntoChunks(text: string, maxChars = 3500) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length > maxChars && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);

  return chunks.length ? chunks : [text.slice(0, maxChars)];
}

async function analyzeVietnameseSpelling(text: string) {
  const chunks = splitTextIntoChunks(text);
  const allIssues: z.infer<typeof IssueSchema>[] = [];

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `
Bạn là bộ kiểm tra chính tả tiếng Việt cho file DOCX.

Chỉ phát hiện:
- lỗi chính tả rõ ràng
- lỗi thiếu/sai dấu tiếng Việt
- lỗi gõ nhầm
- lỗi dùng từ rõ ràng

Không làm:
- không viết lại toàn bộ câu
- không sửa văn phong nếu không sai
- không sửa tên riêng, thương hiệu, tên sản phẩm, thuật ngữ công nghệ
- không bịa lỗi
- nếu tìm được vị trí rõ ràng, luôn trả thêm excerpt là một đoạn nguyên văn ngắn chứa lỗi
- excerpt phải giữ nguyên chữ sai trong tài liệu để frontend tìm đúng vị trí

Danh sách từ cần giữ nguyên:
8AM Coffee, SuperDoc, Ollama, LM Studio, LangGraph, shadcn/ui, Vite, React, DOCX, Cold Brew, Cascara, Gesha, Ethiopia Sidamo, Americano

Trả về JSON hợp lệ đúng schema:
{
  "issues": [
    {
      "wrong": "từ/cụm từ sai",
      "suggestion": "gợi ý sửa",
      "reason": "lý do ngắn",
      "confidence": "high|medium|low",
      "blockLabel": "Đoạn hoặc phần ước lượng",
      "excerpt": "Trích nguyên văn ngắn chứa lỗi"
    }
  ]
}

Nếu không có lỗi, trả:
{"issues":[]}
`,
        },
        {
          role: "user",
          content: `Kiểm tra chính tả đoạn văn bản sau. Đây là chunk ${index + 1}/${chunks.length}:\n\n${chunk}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{"issues":[]}';

    try {
      const parsed = LlmResultSchema.parse(safeJsonParse(raw));
      for (const issue of parsed.issues) {
        allIssues.push({
          ...issue,
          blockLabel: issue.blockLabel || `Chunk ${index + 1}`,
        });
      }
    } catch (error) {
      console.error("LLM JSON parse error:", error);
      console.error("Raw LLM output:", raw);
    }
  }

  return allIssues.map((issue, index) => ({
    id: `issue_${String(index + 1).padStart(3, "0")}`,
    status: "pending" as const,
    ...issue,
  }));
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    baseURL: BASE_URL,
  });
});

app.post("/api/documents/analyze-spelling", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Thiếu file DOCX" });
    }

    if (!req.file.originalname.toLowerCase().endsWith(".docx")) {
      return res.status(400).json({ error: "Chỉ hỗ trợ file .docx" });
    }

    const result = await mammoth.extractRawText({
      buffer: req.file.buffer,
    });

    const text = result.value?.trim();

    if (!text) {
      return res.status(400).json({ error: "Không đọc được text trong DOCX" });
    }

    const issues = await analyzeVietnameseSpelling(text);

    return res.json({
      issues,
      reviewedFileUrl: null,
      meta: {
        chars: text.length,
        model: MODEL,
      },
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      error: "Lỗi khi phân tích DOCX",
      detail: error?.message || String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running: http://localhost:${PORT}`);
  console.log(`Frontend origin: ${FRONTEND_ORIGIN}`);
  console.log(`LLM model: ${MODEL}`);
  console.log(`LLM base URL: ${BASE_URL}`);
});
