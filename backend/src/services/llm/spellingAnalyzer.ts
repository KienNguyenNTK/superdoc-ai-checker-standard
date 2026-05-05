import OpenAI from "openai";
import { API_KEY, BASE_URL, CUSTOM_DICTIONARY, MODEL } from "../../config.js";
import type { DocumentBlock } from "../../domain/types.js";
import { LlmIssueListSchema, type LlmIssue } from "./issueSchemas.js";

const openai = API_KEY
  ? new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
    })
  : null;

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

function buildPrompt(blocks: DocumentBlock[]) {
  const dictionary = CUSTOM_DICTIONARY.join(", ");
  const serializedBlocks = blocks
    .map(
      (block) =>
        `[blockId=${block.blockId} type=${block.type} path=${block.path}]\n${block.text}`
    )
    .join("\n\n");

  return `Bạn là bộ kiểm tra chính tả tiếng Việt cho tài liệu DOCX.

Nhiệm vụ:
- Phát hiện lỗi chính tả rõ ràng.
- Phát hiện lỗi sai dấu tiếng Việt.
- Phát hiện lỗi gõ nhầm.
- Phát hiện lỗi dùng từ rõ ràng.

Không làm:
- Không viết lại toàn bộ câu.
- Không chỉnh văn phong nếu không sai.
- Không sửa tên riêng, thương hiệu, tên sản phẩm, thuật ngữ kỹ thuật.
- Không bịa lỗi.
- Không tự ý đổi các từ trong custom dictionary.

Danh sách từ giữ nguyên:
${dictionary}

Input gồm nhiều block:
${serializedBlocks}

Chỉ trả JSON hợp lệ theo schema:
{
  "issues": [
    {
      "blockId": "p_001",
      "wrong": "khach hang",
      "suggestion": "khách hàng",
      "reason": "Thiếu dấu tiếng Việt",
      "type": "accent",
      "confidence": "high",
      "beforeContext": "luôn hỗ trợ ",
      "afterContext": " trong quá trình",
      "shouldAutoApply": true
    }
  ]
}`;
}

type HeuristicReplacement = {
  wrong: string;
  suggestion: string;
  type: LlmIssue["type"];
  confidence: LlmIssue["confidence"];
  reason: string;
};

const HEURISTIC_REPLACEMENTS: HeuristicReplacement[] = [
  {
    wrong: "khach hang",
    suggestion: "khách hàng",
    type: "accent",
    confidence: "high",
    reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "khách hang",
    suggestion: "khách hàng",
    type: "accent",
    confidence: "high",
    reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "thong tin",
    suggestion: "thông tin",
    type: "accent",
    confidence: "high",
    reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "du lieu",
    suggestion: "dữ liệu",
    type: "accent",
    confidence: "high",
    reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "dử liệu",
    suggestion: "dữ liệu",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "ho tro",
    suggestion: "hỗ trợ",
    type: "accent",
    confidence: "high",
    reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "hổ trợ",
    suggestion: "hỗ trợ",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "nhân viêng",
    suggestion: "nhân viên",
    type: "typo",
    confidence: "high",
    reason: "Sai phụ âm cuối trong từ phổ biến.",
  },
  {
    wrong: "sản phẫm",
    suggestion: "sản phẩm",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu trong từ phổ biến.",
  },
  {
    wrong: "chinh tả",
    suggestion: "chính tả",
    type: "accent",
    confidence: "high",
    reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "chính tã",
    suggestion: "chính tả",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu tiếng Việt ở cụm từ phổ biến.",
  },
  {
    wrong: "cập nhập",
    suggestion: "cập nhật",
    type: "spelling",
    confidence: "high",
    reason: "Dùng từ sai ở cụm từ phổ biến.",
  },
  {
    wrong: "xử lí",
    suggestion: "xử lý",
    type: "accent",
    confidence: "high",
    reason: "Chuẩn hóa chính tả tiếng Việt.",
  },
  {
    wrong: "quản lí",
    suggestion: "quản lý",
    type: "accent",
    confidence: "medium",
    reason: "Chuẩn hóa chính tả tiếng Việt.",
  },
  {
    wrong: "phản hổi",
    suggestion: "phản hồi",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu trong từ phổ biến.",
  },
  {
    wrong: "hoăc",
    suggestion: "hoặc",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu tiếng Việt.",
  },
  {
    wrong: "tài liêu",
    suggestion: "tài liệu",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu trong từ phổ biến.",
  },
  {
    wrong: "hoạt đông",
    suggestion: "hoạt động",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu trong từ phổ biến.",
  },
  {
    wrong: "trãi nghiệm",
    suggestion: "trải nghiệm",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu trong từ phổ biến.",
  },
  {
    wrong: "kiễm tra",
    suggestion: "kiểm tra",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu trong từ phổ biến.",
  },
  {
    wrong: "hệ thông",
    suggestion: "hệ thống",
    type: "accent",
    confidence: "high",
    reason: "Sai dấu trong từ phổ biến.",
  },
];

const MAX_BLOCKS_PER_CHUNK = 24;
const MAX_CHARS_PER_CHUNK = 6000;

function buildIssueKey(issue: Pick<LlmIssue, "blockId" | "wrong" | "suggestion">) {
  return [
    issue.blockId.toLowerCase(),
    issue.wrong.trim().toLowerCase(),
    issue.suggestion.trim().toLowerCase(),
  ].join("::");
}

export function analyzeWithHeuristics(blocks: DocumentBlock[]): LlmIssue[] {
  const protectedWords = new Set(CUSTOM_DICTIONARY.map((entry) => entry.toLowerCase()));
  const issues: LlmIssue[] = [];

  for (const block of blocks) {
    const lowerText = block.text.toLowerCase();

    for (const replacement of HEURISTIC_REPLACEMENTS) {
      if (protectedWords.has(replacement.wrong.toLowerCase())) continue;

      let searchFrom = 0;
      while (searchFrom < lowerText.length) {
        const foundAt = lowerText.indexOf(replacement.wrong.toLowerCase(), searchFrom);
        if (foundAt === -1) break;

        issues.push({
          blockId: block.blockId,
          wrong: block.text.slice(foundAt, foundAt + replacement.wrong.length),
          suggestion: replacement.suggestion,
          reason: replacement.reason,
          type: replacement.type,
          confidence: replacement.confidence,
          beforeContext: block.text.slice(Math.max(0, foundAt - 24), foundAt),
          afterContext: block.text.slice(
            foundAt + replacement.wrong.length,
            foundAt + replacement.wrong.length + 24
          ),
          shouldAutoApply: replacement.confidence === "high",
        });

        searchFrom = foundAt + replacement.wrong.length;
      }
    }
  }

  return issues;
}

export function mergeIssues(primaryIssues: LlmIssue[], fallbackIssues: LlmIssue[]) {
  const merged = new Map<string, LlmIssue>();

  for (const issue of primaryIssues) {
    merged.set(buildIssueKey(issue), issue);
  }

  for (const issue of fallbackIssues) {
    if (!merged.has(buildIssueKey(issue))) {
      merged.set(buildIssueKey(issue), issue);
    }
  }

  return [...merged.values()];
}

export function chunkBlocks(
  blocks: DocumentBlock[],
  maxBlocks = MAX_BLOCKS_PER_CHUNK,
  maxChars = MAX_CHARS_PER_CHUNK
) {
  const chunks: DocumentBlock[][] = [];
  let currentChunk: DocumentBlock[] = [];
  let currentChars = 0;

  for (const block of blocks) {
    const blockChars = block.text.length + block.path.length + block.blockId.length + 32;
    const shouldFlush =
      currentChunk.length > 0 &&
      (currentChunk.length >= maxBlocks || currentChars + blockChars > maxChars);

    if (shouldFlush) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(block);
    currentChars += blockChars;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function analyzeChunkWithLlm(blocks: DocumentBlock[]) {
  const completion = await openai!.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: buildPrompt(blocks),
      },
      {
        role: "user",
        content: "Kiểm tra chính tả tiếng Việt cho các block ở trên.",
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{"issues":[]}';
  return LlmIssueListSchema.parse(safeJsonParse(raw)).issues;
}

export async function analyzeSpellingIssues(blocks: DocumentBlock[]) {
  const heuristicIssues = analyzeWithHeuristics(blocks);

  if (!openai) {
    return heuristicIssues;
  }

  try {
    const llmIssues: LlmIssue[] = [];
    for (const chunk of chunkBlocks(blocks)) {
      const chunkIssues = await analyzeChunkWithLlm(chunk);
      llmIssues.push(...chunkIssues);
    }

    if (llmIssues.length === 0 && heuristicIssues.length > 0) {
      console.warn(
        `[spellingAnalyzer] LLM returned 0 issues, falling back to ${heuristicIssues.length} heuristic issues.`
      );
      return heuristicIssues;
    }

    return mergeIssues(llmIssues, heuristicIssues);
  } catch (error: any) {
    console.warn(
      `[spellingAnalyzer] LLM analysis failed, using heuristic fallback: ${error?.message || String(error)}`
    );
    return heuristicIssues;
  }
}
