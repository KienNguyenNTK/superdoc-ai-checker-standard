import OpenAI from "openai";
import { API_KEY, BASE_URL, CUSTOM_DICTIONARY, MODEL } from "../../config.js";
import type { DocumentBlock, Issue } from "../../domain/types.js";
import { PromptTemplateService } from "../../prompts/promptTemplateService.js";
import { PROMPTS_DIR } from "../../config.js";
import { LlmIssueListSchema, type LlmIssue } from "./issueSchemas.js";
import {
  getVietnameseDictionaryService,
  normalizeVietnameseTerm,
  tokenizeVietnameseText,
} from "./vietnameseDictionary.js";

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
  status?: LlmIssue["status"];
};

type ContextualReplacement = {
  pattern: RegExp;
  wrong: string;
  suggestion: string;
  type: LlmIssue["type"];
  confidence: LlmIssue["confidence"];
  reason: string;
  status?: LlmIssue["status"];
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
  { wrong: "giử", suggestion: "giữ", type: "accent", confidence: "high", reason: "Sai dấu trong động từ phổ biến." },
  { wrong: "gơi ý", suggestion: "gợi ý", type: "accent", confidence: "high", reason: "Sai dấu trong cụm từ phổ biến." },
  { wrong: "goi ý", suggestion: "gợi ý", type: "accent", confidence: "medium", reason: "Thiếu dấu trong cụm từ phổ biến." },
  { wrong: "rõ rang", suggestion: "rõ ràng", type: "accent", confidence: "high", reason: "Sai dấu trong cụm từ phổ biến." },
  { wrong: "rỏ ràng", suggestion: "rõ ràng", type: "accent", confidence: "high", reason: "Sai dấu trong cụm từ phổ biến." },
  { wrong: "ngử cảnh", suggestion: "ngữ cảnh", type: "accent", confidence: "high", reason: "Sai dấu trong thuật ngữ phổ biến." },
  { wrong: "chử", suggestion: "chữ", type: "accent", confidence: "high", reason: "Sai dấu trong danh từ phổ biến." },
  { wrong: "lúng cúng", suggestion: "lúng túng", type: "spelling", confidence: "high", reason: "Dùng từ sai trong cụm mô tả phổ biến." },
  { wrong: "nhận diên", suggestion: "nhận diện", type: "accent", confidence: "high", reason: "Sai dấu trong cụm từ phổ biến." },
  { wrong: "định dang", suggestion: "định dạng", type: "accent", confidence: "high", reason: "Thiếu dấu trong cụm từ phổ biến." },
  { wrong: "phẩn mềm", suggestion: "phần mềm", type: "accent", confidence: "high", reason: "Sai dấu trong cụm từ phổ biến." },
  { wrong: "thanh tóan", suggestion: "thanh toán", type: "accent", confidence: "high", reason: "Sai dấu trong cụm từ phổ biến." },
  { wrong: "ro rang", suggestion: "rõ ràng", type: "accent", confidence: "medium", reason: "Thiếu dấu trong cụm từ phổ biến." },
];

const CONTEXTUAL_REPLACEMENTS: ContextualReplacement[] = [
  {
    pattern: /\bsữa\b(?=\s+(?:lỗi|câu|đoạn|văn\s+bản|nội\s+dung|tiêu\s+đề|định\s+dạng|chính\s+tả))/gu,
    wrong: "sữa",
    suggestion: "sửa",
    type: "spelling",
    confidence: "high",
    reason: "Theo ngữ cảnh chỉnh sửa văn bản, động từ đúng là “sửa”, không phải “sữa”.",
  },
  {
    pattern: /\b(?:gợi|gơi|goi)\s+ý\s+sữa\b/gu,
    wrong: "sữa",
    suggestion: "sửa",
    type: "spelling",
    confidence: "high",
    reason: "Trong cụm “gợi ý sửa”, từ đúng là “sửa”, không phải “sữa”.",
  },
];

const COMMON_NEEDS_REVIEW_SUGGESTIONS = new Map<string, string>([
  ["giử", "giữ"],
  ["gơi", "gợi"],
  ["gơi ý", "gợi ý"],
  ["goi", "gọi"],
  ["chử", "chữ"],
]);

const MAX_BLOCKS_PER_CHUNK = 24;
const MAX_CHARS_PER_CHUNK = 6000;

export type BlockTemplateGroup = {
  signature: string;
  representative: DocumentBlock;
  blocks: DocumentBlock[];
};

export type SpellingAnalysisDiagnostics = {
  representativeBlockCount: number;
  representativeChunkCount: number;
  heuristicIssueCount: number;
  dictionarySuspicionIssueCount: number;
  llmIssueCount: number;
  mergedIssueCount: number;
  needsReviewCount: number;
  bySource: {
    rule_engine: number;
    llm: number;
    hybrid: number;
  };
};

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

function formatIssueSeverity(confidence: LlmIssue["confidence"], status?: LlmIssue["status"]) {
  if (status === "needs_review") {
    return confidence === "low" ? "info" : "warning";
  }

  return confidence === "high" ? "error" : "warning";
}

function createLlmIssue(params: {
  blockId: string;
  wrong: string;
  suggestion: string;
  reason: string;
  type: LlmIssue["type"];
  confidence: LlmIssue["confidence"];
  source: LlmIssue["source"];
  startOffset: number;
  endOffset: number;
  beforeContext: string;
  afterContext: string;
  status?: LlmIssue["status"];
  shouldAutoApply?: boolean;
}): LlmIssue {
  return {
    blockId: params.blockId,
    wrong: params.wrong,
    suggestion: params.suggestion,
    reason: params.reason,
    type: params.type,
    confidence: params.confidence,
    severity: formatIssueSeverity(params.confidence, params.status),
    source: params.source,
    status: params.status,
    startOffset: params.startOffset,
    endOffset: params.endOffset,
    beforeContext: params.beforeContext,
    afterContext: params.afterContext,
    shouldAutoApply: params.status === "needs_review" ? false : params.shouldAutoApply,
  };
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

function cloneTemplateIssueForBlock(templateIssue: LlmIssue, blockId: string): LlmIssue {
  return {
    ...templateIssue,
    blockId,
  };
}

function createBlockSignature(block: DocumentBlock) {
  return `${block.type}::${block.text}`;
}

function isLikelyProperNoun(token: string) {
  return /^[\p{Lu}]/u.test(token) && token !== token.toLocaleUpperCase("vi-VN");
}

function isAsciiWord(token: string) {
  return /^[A-Za-z]+$/.test(token);
}

function belongsToKnownPhrase(
  normalizedTokens: string[],
  index: number,
  hasTerm: (term: string) => boolean
) {
  const current = normalizedTokens[index];
  if (!current) return false;

  const prev = normalizedTokens[index - 1];
  const next = normalizedTokens[index + 1];

  if (prev && hasTerm(`${prev} ${current}`)) return true;
  if (next && hasTerm(`${current} ${next}`)) return true;
  if (prev && next && hasTerm(`${prev} ${current} ${next}`)) return true;

  return false;
}

function createContextWindow(text: string, startOffset: number, endOffset: number) {
  return {
    beforeContext: text.slice(Math.max(0, startOffset - 24), startOffset),
    afterContext: text.slice(endOffset, endOffset + 24),
  };
}

function buildPromptSuspicionHints(blocks: DocumentBlock[], suspiciousIssues: LlmIssue[]) {
  if (suspiciousIssues.length === 0) {
    return "Không có nghi vấn bổ sung từ tầng dictionary.";
  }

  const blockMap = new Map(blocks.map((block) => [block.blockId, block] as const));

  return suspiciousIssues
    .slice(0, 40)
    .map((issue) => {
      const block = blockMap.get(issue.blockId);
      const excerpt = block?.text.slice(
        Math.max(0, (issue.startOffset ?? 0) - 18),
        Math.min(block.text.length, (issue.endOffset ?? 0) + 28)
      );

      return `- [${issue.blockId}] "${issue.wrong}" -> "${issue.suggestion}" | ${issue.reason}${excerpt ? ` | ngữ cảnh: ${excerpt}` : ""}`;
    })
    .join("\n");
}

export function buildBlockTemplateGroups(blocks: DocumentBlock[]): BlockTemplateGroup[] {
  const groups = new Map<string, BlockTemplateGroup>();

  for (const block of blocks) {
    const signature = createBlockSignature(block);
    const existing = groups.get(signature);

    if (existing) {
      existing.blocks.push(block);
      continue;
    }

    groups.set(signature, {
      signature,
      representative: block,
      blocks: [block],
    });
  }

  return [...groups.values()];
}

export function expandTemplateIssues(
  templateIssues: LlmIssue[],
  groups: BlockTemplateGroup[]
) {
  const groupByRepresentativeId = new Map(
    groups.map((group) => [group.representative.blockId, group] as const)
  );

  return templateIssues.flatMap((templateIssue) => {
    const group = groupByRepresentativeId.get(templateIssue.blockId);
    if (!group) return [templateIssue];

    return group.blocks.map((block) =>
      cloneTemplateIssueForBlock(templateIssue, block.blockId)
    );
  });
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

    const status = rawIssue.status ?? "pending";

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
        status,
        shouldAutoApply: status === "needs_review" ? false : rawIssue.shouldAutoApply,
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

        const wrong = block.text.slice(foundAt, foundAt + replacement.wrong.length);
        const { beforeContext, afterContext } = createContextWindow(
          block.text,
          foundAt,
          foundAt + replacement.wrong.length
        );

        issues.push(
          createLlmIssue({
            blockId: block.blockId,
            wrong,
            suggestion: applySuggestionCasing(wrong, replacement.suggestion),
            reason: replacement.reason,
            type: replacement.type,
            confidence: replacement.confidence,
            source: "rule_engine",
            startOffset: foundAt,
            endOffset: foundAt + replacement.wrong.length,
            beforeContext,
            afterContext,
            status: replacement.status,
            shouldAutoApply: replacement.confidence === "high",
          })
        );

        searchFrom = foundAt + replacement.wrong.length;
      }
    }

    for (const replacement of CONTEXTUAL_REPLACEMENTS) {
      for (const match of lowerText.matchAll(replacement.pattern)) {
        const foundAt = match.index ?? -1;
        if (foundAt === -1) continue;

        const wrongAt = lowerText.indexOf(replacement.wrong, foundAt);
        if (wrongAt === -1) continue;

        const wrong = block.text.slice(wrongAt, wrongAt + replacement.wrong.length);
        const { beforeContext, afterContext } = createContextWindow(
          block.text,
          wrongAt,
          wrongAt + replacement.wrong.length
        );

        issues.push(
          createLlmIssue({
            blockId: block.blockId,
            wrong,
            suggestion: applySuggestionCasing(wrong, replacement.suggestion),
            reason: replacement.reason,
            type: replacement.type,
            confidence: replacement.confidence,
            source: "rule_engine",
            startOffset: wrongAt,
            endOffset: wrongAt + replacement.wrong.length,
            beforeContext,
            afterContext,
            status: replacement.status,
            shouldAutoApply: replacement.confidence === "high",
          })
        );
      }
    }
  }

  return issues;
}

function issuesOverlap(left: Pick<LlmIssue, "blockId" | "startOffset" | "endOffset">, right: Pick<LlmIssue, "blockId" | "startOffset" | "endOffset">) {
  if (left.blockId !== right.blockId) return false;
  if (typeof left.startOffset !== "number" || typeof left.endOffset !== "number") return false;
  if (typeof right.startOffset !== "number" || typeof right.endOffset !== "number") return false;

  return left.startOffset < right.endOffset && right.startOffset < left.endOffset;
}

function filterSuspicionIssuesAgainstConfirmedIssues(
  suspicionIssues: LlmIssue[],
  confirmedIssues: LlmIssue[]
) {
  return suspicionIssues.filter(
    (suspicion) =>
      !confirmedIssues.some(
        (confirmed) =>
          confirmed.status !== "needs_review" && issuesOverlap(suspicion, confirmed)
      )
  );
}

export async function analyzeDictionarySuspicionIssues(blocks: DocumentBlock[]) {
  try {
    const dictionary = await getVietnameseDictionaryService();
    const issues: LlmIssue[] = [];
    const seen = new Set<string>();

    for (const block of blocks) {
      const tokens = tokenizeVietnameseText(block.text);
      const normalizedTokens = tokens.map((token) => token.normalized);

      for (const [index, token] of tokens.entries()) {
        if (!/\p{L}/u.test(token.text)) continue;
        if (token.normalized.length < 3) continue;
        if (isAsciiWord(token.text)) continue;
        if (dictionary.isPreservedToken(token.text)) continue;
        if (dictionary.hasSingleWord(token.text)) continue;
        if (isLikelyProperNoun(token.text)) continue;
        if (belongsToKnownPhrase(normalizedTokens, index, dictionary.hasTerm)) continue;

        const key = [
          block.blockId,
          token.startOffset,
          token.endOffset,
          token.normalized,
        ].join("::");
        if (seen.has(key)) continue;
        seen.add(key);

        const suggestedBase =
          COMMON_NEEDS_REVIEW_SUGGESTIONS.get(token.normalized) ??
          dictionary.suggestSingleWord(token.text) ??
          token.text;
        const suggestion = applySuggestionCasing(token.text, suggestedBase);
        const confidence = suggestion !== token.text ? "medium" : "low";
        const { beforeContext, afterContext } = createContextWindow(
          block.text,
          token.startOffset,
          token.endOffset
        );

        issues.push(
          createLlmIssue({
            blockId: block.blockId,
            wrong: token.text,
            suggestion,
            reason:
              suggestion !== token.text
                ? "Từ này không có trong allowlist nền; cần rà soát lại và ưu tiên kiểm tra gợi ý đã suy ra."
                : "Từ này không có trong allowlist nền; cần rà soát lại theo ngữ cảnh trước khi sửa.",
            type: "spelling",
            confidence,
            source: "hybrid",
            startOffset: token.startOffset,
            endOffset: token.endOffset,
            beforeContext,
            afterContext,
            status: "needs_review",
            shouldAutoApply: false,
          })
        );
      }
    }

    return issues;
  } catch (error: any) {
    console.warn(
      `[spellingAnalyzer] Dictionary suspicion layer unavailable: ${error?.message || String(error)}`
    );
    return [];
  }
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

async function analyzeChunkWithLlm(blocks: DocumentBlock[], suspiciousIssues: LlmIssue[]) {
  const rendered = await promptService.render("spelling", {
    CUSTOM_DICTIONARY: CUSTOM_DICTIONARY.join(", "),
    BLOCKS: blocks
      .map((block) => `[blockId=${block.blockId} type=${block.type} path=${block.path}]\n${block.text}`)
      .join("\n\n"),
    SUSPICIOUS_CANDIDATES: buildPromptSuspicionHints(blocks, suspiciousIssues),
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

function countIssuesByWrongText(issues: LlmIssue[]) {
  const counts = new Map<string, number>();

  for (const issue of issues) {
    const key = normalizeVietnameseTerm(issue.wrong);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([wrong, count]) => `${wrong}(${count})`)
    .join(", ");
}

export async function analyzeSpellingIssuesDetailed(blocks: DocumentBlock[], documentId = "doc_unknown") {
  const groups = buildBlockTemplateGroups(blocks);
  const representativeBlocks = groups.map((group) => group.representative);
  const representativeChunks = chunkBlocks(representativeBlocks).length;
  const representativeHeuristicIssues = analyzeWithHeuristics(representativeBlocks);
  const representativeDictionarySuspicionIssues = filterSuspicionIssuesAgainstConfirmedIssues(
    await analyzeDictionarySuspicionIssues(representativeBlocks),
    representativeHeuristicIssues
  );
  const heuristicIssues = expandTemplateIssues(representativeHeuristicIssues, groups);
  const dictionarySuspicionIssues = expandTemplateIssues(
    representativeDictionarySuspicionIssues,
    groups
  );
  const buildDiagnostics = (finalIssues: Issue[], llmIssueCount: number): SpellingAnalysisDiagnostics => ({
    representativeBlockCount: representativeBlocks.length,
    representativeChunkCount: representativeChunks,
    heuristicIssueCount: heuristicIssues.length,
    dictionarySuspicionIssueCount: dictionarySuspicionIssues.length,
    llmIssueCount,
    mergedIssueCount: finalIssues.length,
    needsReviewCount: finalIssues.filter((issue) => issue.status === "needs_review").length,
    bySource: {
      rule_engine: finalIssues.filter((issue) => issue.source === "rule_engine").length,
      llm: finalIssues.filter((issue) => issue.source === "llm").length,
      hybrid: finalIssues.filter((issue) => issue.source === "hybrid").length,
    },
  });

  if (!openai) {
    const finalIssues = mergeIssues(heuristicIssues, dictionarySuspicionIssues);
    console.info(
      `[spellingAnalyzer] blocks=${blocks.length}, representative=${representativeBlocks.length}, rule=${heuristicIssues.length}, dictionary=${dictionarySuspicionIssues.length}, llm=0, needs_review=${finalIssues.filter((issue) => issue.status === "needs_review").length}${dictionarySuspicionIssues.length ? `, probe=${countIssuesByWrongText(dictionarySuspicionIssues)}` : ""}`
    );
    const mappedIssues = mapLlmIssuesToIssues(documentId, blocks, finalIssues);
    return {
      issues: mappedIssues,
      diagnostics: buildDiagnostics(mappedIssues, 0),
    };
  }

  try {
    const llmIssues: LlmIssue[] = [];

    for (const chunk of chunkBlocks(representativeBlocks)) {
      const chunkIds = new Set(chunk.map((block) => block.blockId));
      const chunkSuspiciousIssues = representativeDictionarySuspicionIssues.filter((issue) =>
        chunkIds.has(issue.blockId)
      );
      const chunkIssues = await analyzeChunkWithLlm(chunk, chunkSuspiciousIssues);
      llmIssues.push(...chunkIssues);
    }

    const expandedLlmIssues = expandTemplateIssues(llmIssues, groups);
    const filteredDictionarySuspicionIssues = filterSuspicionIssuesAgainstConfirmedIssues(
      dictionarySuspicionIssues,
      mergeIssues(expandedLlmIssues, heuristicIssues)
    );
    const finalIssues = mergeIssues(
      expandedLlmIssues,
      mergeIssues(heuristicIssues, filteredDictionarySuspicionIssues)
    );

    console.info(
      `[spellingAnalyzer] blocks=${blocks.length}, representative=${representativeBlocks.length}, rule=${heuristicIssues.length}, dictionary=${dictionarySuspicionIssues.length}, llm=${expandedLlmIssues.length}, needs_review=${finalIssues.filter((issue) => issue.status === "needs_review").length}${dictionarySuspicionIssues.length ? `, probe=${countIssuesByWrongText(dictionarySuspicionIssues)}` : ""}`
    );

    if (expandedLlmIssues.length === 0 && heuristicIssues.length > 0) {
      const mappedIssues = mapLlmIssuesToIssues(
        documentId,
        blocks,
        mergeIssues(heuristicIssues, filteredDictionarySuspicionIssues)
      );
      return {
        issues: mappedIssues,
        diagnostics: buildDiagnostics(mappedIssues, 0),
      };
    }

    const mappedIssues = mapLlmIssuesToIssues(documentId, blocks, finalIssues);
    return {
      issues: mappedIssues,
      diagnostics: buildDiagnostics(mappedIssues, expandedLlmIssues.length),
    };
  } catch (error: any) {
    console.warn(
      `[spellingAnalyzer] LLM analysis failed, using heuristic fallback: ${error?.message || String(error)}`
    );
    const finalIssues = mergeIssues(heuristicIssues, dictionarySuspicionIssues);
    const mappedIssues = mapLlmIssuesToIssues(documentId, blocks, finalIssues);
    return {
      issues: mappedIssues,
      diagnostics: buildDiagnostics(mappedIssues, 0),
    };
  }
}

export async function analyzeSpellingIssues(blocks: DocumentBlock[], documentId = "doc_unknown") {
  const result = await analyzeSpellingIssuesDetailed(blocks, documentId);
  return result.issues;
}
