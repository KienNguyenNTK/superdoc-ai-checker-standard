import OpenAI from "openai";
import { API_KEY, BASE_URL, CUSTOM_DICTIONARY, MODEL } from "../../config.js";
import type { DocumentBlock, Issue } from "../../domain/types.js";
import { PromptTemplateService } from "../../prompts/promptTemplateService.js";
import { PROMPTS_DIR } from "../../config.js";
import { LlmIssueListSchema, type LlmIssue } from "./issueSchemas.js";

const openai = API_KEY
  ? new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
    })
  : null;

const promptService = new PromptTemplateService(PROMPTS_DIR);

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

type HeuristicReplacement = {
  wrong: string;
  suggestion: string;
  type: LlmIssue["type"];
  confidence: LlmIssue["confidence"];
  reason: string;
};

const HEURISTIC_REPLACEMENTS: HeuristicReplacement[] = [
  { wrong: "khach hang", suggestion: "khách hàng", type: "accent", confidence: "high", reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "khách hang", suggestion: "khách hàng", type: "accent", confidence: "high", reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "thong tin", suggestion: "thông tin", type: "accent", confidence: "high", reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "du lieu", suggestion: "dữ liệu", type: "accent", confidence: "high", reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "dử liệu", suggestion: "dữ liệu", type: "accent", confidence: "high", reason: "Sai dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "ho tro", suggestion: "hỗ trợ", type: "accent", confidence: "high", reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "hổ trợ", suggestion: "hỗ trợ", type: "accent", confidence: "high", reason: "Sai dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "nhân viêng", suggestion: "nhân viên", type: "typo", confidence: "high", reason: "Sai phụ âm cuối trong từ phổ biến." },
  { wrong: "sản phẫm", suggestion: "sản phẩm", type: "accent", confidence: "high", reason: "Sai dấu trong từ phổ biến." },
  { wrong: "chinh tả", suggestion: "chính tả", type: "accent", confidence: "high", reason: "Thiếu dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "chính tã", suggestion: "chính tả", type: "accent", confidence: "high", reason: "Sai dấu tiếng Việt ở cụm từ phổ biến." },
  { wrong: "cập nhập", suggestion: "cập nhật", type: "spelling", confidence: "high", reason: "Dùng từ sai ở cụm từ phổ biến." },
  { wrong: "xử lí", suggestion: "xử lý", type: "accent", confidence: "high", reason: "Chuẩn hóa chính tả tiếng Việt." },
  { wrong: "quản lí", suggestion: "quản lý", type: "accent", confidence: "medium", reason: "Chuẩn hóa chính tả tiếng Việt." },
  { wrong: "phản hổi", suggestion: "phản hồi", type: "accent", confidence: "high", reason: "Sai dấu trong từ phổ biến." },
  { wrong: "hoăc", suggestion: "hoặc", type: "accent", confidence: "high", reason: "Sai dấu tiếng Việt." },
  { wrong: "tài liêu", suggestion: "tài liệu", type: "accent", confidence: "high", reason: "Sai dấu trong từ phổ biến." },
  { wrong: "hoạt đông", suggestion: "hoạt động", type: "accent", confidence: "high", reason: "Sai dấu trong từ phổ biến." },
  { wrong: "trãi nghiệm", suggestion: "trải nghiệm", type: "accent", confidence: "high", reason: "Sai dấu trong từ phổ biến." },
  { wrong: "kiễm tra", suggestion: "kiểm tra", type: "accent", confidence: "high", reason: "Sai dấu trong từ phổ biến." },
  { wrong: "hệ thông", suggestion: "hệ thống", type: "accent", confidence: "high", reason: "Sai dấu trong từ phổ biến." },
];

const MAX_BLOCKS_PER_CHUNK = 24;
const MAX_CHARS_PER_CHUNK = 6000;

function isWordAllUppercase(word: string) {
  const letters = [...word].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return false;
  return letters.every((char) => char === char.toLocaleUpperCase("vi-VN"));
}

function isWordCapitalized(word: string) {
  const chars = [...word];
  const firstLetterIndex = chars.findIndex((char) => /\p{L}/u.test(char));
  if (firstLetterIndex === -1) return false;
  return chars[firstLetterIndex] === chars[firstLetterIndex]?.toLocaleUpperCase("vi-VN");
}

function capitalizeWord(word: string) {
  const chars = [...word];
  const firstLetterIndex = chars.findIndex((char) => /\p{L}/u.test(char));
  if (firstLetterIndex === -1) return word;
  chars[firstLetterIndex] = chars[firstLetterIndex]!.toLocaleUpperCase("vi-VN");
  return chars.join("");
}

export function applySuggestionCasing(original: string, suggestion: string) {
  if (!original.trim() || !suggestion.trim()) return suggestion;

  const originalTokens = original.split(/(\s+)/);
  const suggestionTokens = suggestion.split(/(\s+)/);
  const originalWords = originalTokens.filter((token) => token.trim().length > 0);
  const suggestionWords = suggestionTokens.filter((token) => token.trim().length > 0);

  if (originalWords.length === suggestionWords.length) {
    let wordIndex = 0;
    return suggestionTokens
      .map((token) => {
        if (token.trim().length === 0) return token;

        const originalWord = originalWords[wordIndex] ?? "";
        const suggestionWord = suggestionWords[wordIndex] ?? token;
        wordIndex += 1;

        if (isWordAllUppercase(originalWord)) {
          return suggestionWord.toLocaleUpperCase("vi-VN");
        }

        if (isWordCapitalized(originalWord)) {
          return capitalizeWord(suggestionWord);
        }

        return suggestionWord.toLocaleLowerCase("vi-VN");
      })
      .join("");
  }

  if (isWordAllUppercase(original)) {
    return suggestion.toLocaleUpperCase("vi-VN");
  }

  if (isWordCapitalized(original)) {
    return capitalizeWord(suggestion);
  }

  return suggestion.toLocaleLowerCase("vi-VN");
}

function buildIssueKey(issue: Pick<LlmIssue, "blockId" | "wrong" | "suggestion" | "type">) {
  return [
    issue.blockId.toLowerCase(),
    issue.type,
    issue.wrong.trim().toLowerCase(),
    issue.suggestion.trim().toLowerCase(),
  ].join("::");
}

function buildSelection(blockId: string, startOffset: number, endOffset: number) {
  return {
    kind: "selection" as const,
    start: { kind: "text" as const, blockId, offset: startOffset },
    end: { kind: "text" as const, blockId, offset: endOffset },
  };
}

function mapLlmIssuesToIssues(documentId: string, blocks: DocumentBlock[], llmIssues: LlmIssue[]): Issue[] {
  return llmIssues.flatMap((rawIssue, index) => {
    const block = blocks.find((candidate) => candidate.blockId === rawIssue.blockId);
    if (!block) return [];

    const startOffset =
      typeof rawIssue.startOffset === "number"
        ? rawIssue.startOffset
        : block.text.toLowerCase().indexOf(rawIssue.wrong.toLowerCase());
    const endOffset =
      typeof rawIssue.endOffset === "number"
        ? rawIssue.endOffset
        : startOffset >= 0
          ? startOffset + rawIssue.wrong.length
          : undefined;

    return [
      {
        id: `spell_${block.blockId}_${String(index).padStart(3, "0")}`,
        documentId,
        wrong: rawIssue.wrong,
        suggestion: applySuggestionCasing(rawIssue.wrong, rawIssue.suggestion),
        reason: rawIssue.reason,
        type: rawIssue.type,
        confidence: rawIssue.confidence,
        severity: rawIssue.severity,
        source: rawIssue.source,
        status: "pending",
        shouldAutoApply: rawIssue.shouldAutoApply,
        location: {
          blockId: block.blockId,
          blockType: block.type,
          path: block.path,
          startOffset: startOffset >= 0 ? startOffset : undefined,
          endOffset,
          searchText: rawIssue.wrong,
          beforeContext: rawIssue.beforeContext,
          afterContext: rawIssue.afterContext,
          target:
            startOffset >= 0 && typeof endOffset === "number"
              ? buildSelection(block.blockId, startOffset, endOffset)
              : undefined,
        },
      } satisfies Issue,
    ];
  });
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
          suggestion: applySuggestionCasing(
            block.text.slice(foundAt, foundAt + replacement.wrong.length),
            replacement.suggestion
          ),
          reason: replacement.reason,
          type: replacement.type,
          confidence: replacement.confidence,
          severity: replacement.confidence === "high" ? "error" : "warning",
          source: "rule_engine",
          startOffset: foundAt,
          endOffset: foundAt + replacement.wrong.length,
          beforeContext: block.text.slice(Math.max(0, foundAt - 24), foundAt),
          afterContext: block.text.slice(foundAt + replacement.wrong.length, foundAt + replacement.wrong.length + 24),
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

  for (const issue of primaryIssues) merged.set(buildIssueKey(issue), issue);
  for (const issue of fallbackIssues) {
    if (!merged.has(buildIssueKey(issue))) merged.set(buildIssueKey(issue), issue);
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

  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

async function analyzeChunkWithLlm(blocks: DocumentBlock[]) {
  const rendered = await promptService.render("spelling", {
    CUSTOM_DICTIONARY: CUSTOM_DICTIONARY.join(", "),
    BLOCKS: blocks
      .map((block) => `[blockId=${block.blockId} type=${block.type} path=${block.path}]\n${block.text}`)
      .join("\n\n"),
  });

  const completion = await openai!.chat.completions.create({
    model: MODEL,
    temperature: rendered.prompt.defaultModelOptions?.temperature ?? 0.1,
    messages: [
      {
        role: "system",
        content: rendered.system,
      },
      {
        role: "user",
        content: rendered.user,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{"issues":[]}';
  return LlmIssueListSchema.parse(safeJsonParse(raw)).issues;
}

export async function analyzeSpellingIssues(blocks: DocumentBlock[], documentId = "doc_unknown") {
  const heuristicIssues = analyzeWithHeuristics(blocks);

  if (!openai) {
    return mapLlmIssuesToIssues(documentId, blocks, heuristicIssues);
  }

  try {
    const llmIssues: LlmIssue[] = [];
    for (const chunk of chunkBlocks(blocks)) {
      const chunkIssues = await analyzeChunkWithLlm(chunk);
      llmIssues.push(...chunkIssues);
    }

    if (llmIssues.length === 0 && heuristicIssues.length > 0) {
      return mapLlmIssuesToIssues(documentId, blocks, heuristicIssues);
    }

    return mapLlmIssuesToIssues(documentId, blocks, mergeIssues(llmIssues, heuristicIssues));
  } catch (error: any) {
    console.warn(
      `[spellingAnalyzer] LLM analysis failed, using heuristic fallback: ${error?.message || String(error)}`
    );
    return mapLlmIssuesToIssues(documentId, blocks, heuristicIssues);
  }
}
