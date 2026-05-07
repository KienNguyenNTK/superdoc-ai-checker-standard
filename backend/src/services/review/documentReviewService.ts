import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnalysisCacheInfo,
  AnalysisCacheMetadata,
  AnalysisSummary,
  AnalysisTraceArtifact,
  AnalyzeConsistencyRequest,
  ChangeRecord,
  CheckConfig,
  CommentRecord,
  DocumentContextMemory,
  DocumentSession,
  HistoryRecord,
  IssueListResponse,
  Issue,
  ReviewMode,
  RunFormatSnapshot,
} from "../../domain/types.js";
import { buildAppliedIssueLocation } from "./issueLocation.js";
import { applyTextIssueXmlFallback } from "./docxTextFallback.js";
import { resolveIssueRange } from "./rangeResolver.js";
import type { FileDocumentSessionStore } from "../storage/documentSessionStore.js";
import { withSuperDocDocument } from "../superdoc/superdocClient.js";
import { readDocumentBlocks } from "../superdoc/documentReader.js";
import { buildContextMemory } from "../consistency/contextMemoryBuilder.js";
import { runConsistencyPipeline, runConsistencyPipelineDetailed } from "../consistency/consistencyPipeline.js";
import { summarizeContextMemory } from "../consistency/consistencyReporter.js";
import { CUSTOM_DICTIONARY, DEFAULT_MAX_ISSUES, GLOBAL_GLOSSARY_PATH } from "../../config.js";
import { applySuggestionCasing } from "../llm/spellingAnalyzer.js";
import { AnalysisTraceCollector } from "./analysisTrace.js";
import type { FileAnalysisCacheStore } from "../storage/analysisCacheStore.js";
import { hashFile } from "../hash/fileHash.js";
import { hashStableJson, sha256Hex } from "../hash/configHash.js";
import { DICTIONARY_JSON_PATH } from "../llm/vietnameseDictionary.js";

type RunReviewInput = {
  documentId: string;
  mode: ReviewMode;
  highlightColor?: string;
  maxIssues?: number;
  applyHighConfidence?: boolean;
  debugTrace?: boolean;
  useCache?: boolean;
  forceReanalyze?: boolean;
  annotateFromCache?: boolean;
};

type AnalyzeConsistencyInput = {
  documentId: string;
  request: AnalyzeConsistencyRequest;
};

const DEFAULT_ANALYZE_REQUEST: AnalyzeConsistencyRequest = {
  checks: ["spelling", "format", "terminology", "translation", "tone", "entity", "date_number"],
  mode: "comment_and_highlight",
  useLLM: true,
  useRuleEngine: true,
  maxIssues: DEFAULT_MAX_ISSUES,
  maxAnnotatedIssues: DEFAULT_MAX_ISSUES,
  maxReturnedIssues: Number.MAX_SAFE_INTEGER,
};

const DEFAULT_CHECK_CONFIG: CheckConfig = {
  checks: {
    spelling: {
      enabled: true,
      mode: "comment_and_highlight",
      autoApplyHighConfidence: false,
    },
    formatConsistency: {
      enabled: true,
      checkBold: true,
      checkItalic: true,
      checkUnderline: true,
      checkHeadingStyles: true,
      checkFirstMentionInChapter: true,
    },
    translationConsistency: {
      enabled: true,
      useGlossary: true,
      inferGlossary: true,
      requireUserConfirmGlossary: false,
    },
    toneConsistency: {
      enabled: true,
      targetTone: "formal",
    },
  },
};

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "#fff59d",
  green: "#c8e6c9",
  blue: "#bbdefb",
};
const ANALYSIS_ENGINE_VERSION = "v1";
const PROMPT_VERSION = "prompt-v1";
const DICTIONARY_VERSION = "dictionary-v1";

function nowIso() {
  return new Date().toISOString();
}

function createHistory(type: HistoryRecord["type"], message: string): HistoryRecord {
  return {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    createdAt: nowIso(),
  };
}

function createReviewedPath(session: DocumentSession) {
  return path.join(path.dirname(session.originalPath), "reviewed-consistency.docx");
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stripIssueAnnotation(issue: Issue, documentId: string, index: number): Issue {
  const cloned = cloneJson(issue);
  return {
    ...cloned,
    id: `issue_${String(index + 1).padStart(4, "0")}`,
    documentId,
    status: cloned.status === "needs_review" ? "needs_review" : "pending",
    location: {
      ...cloned.location,
      commentId: undefined,
      changeId: undefined,
      anchorId: undefined,
    },
  };
}

function sanitizeIssuesForCache(issues: Issue[]) {
  return issues.map((issue, index) => stripIssueAnnotation(issue, issue.documentId, index));
}

function resolveCachedIssueForBlocks(issue: Issue, blocks: Awaited<ReturnType<typeof readDocumentBlocks>>) {
  const candidates = blocks.filter((block) => {
    if (block.blockId === issue.location.blockId) return true;
    const needle = issue.location.searchText || issue.wrong;
    return needle ? block.text.includes(needle) || block.text.includes(issue.wrong) : false;
  });

  for (const block of candidates) {
    const resolved = resolveIssueRange({
      block,
      wrong: issue.wrong,
      beforeContext: issue.location.beforeContext,
      afterContext: issue.location.afterContext,
    });
    if (resolved.confidence !== "not_found") {
      issue.location = {
        ...issue.location,
        blockId: block.blockId,
        blockType: block.type,
        path: block.path,
        startOffset: resolved.startOffset,
        endOffset: resolved.endOffset,
        target: resolved.target,
      };
      return resolved;
    }
  }

  return {
    blockId: issue.location.blockId,
    path: issue.location.path,
    confidence: "not_found" as const,
    beforeContext: issue.location.beforeContext,
    afterContext: issue.location.afterContext,
  };
}

function buildSummaryFromIssues(
  issues: Issue[],
  annotatedCount: number,
  request: AnalyzeConsistencyRequest,
  blocksAnalyzed: number,
  cacheInfo?: Pick<AnalysisCacheInfo, "cacheHit" | "cacheKey" | "cachedAt" | "analysisDurationMs" | "skippedAnalysisBecauseCacheHit">
): AnalysisSummary {
  const needsReviewCount = issues.filter((issue) => issue.status === "needs_review").length;
  return {
    detectedIssues: issues.length,
    selectedIssues: annotatedCount,
    annotatedIssues: annotatedCount,
    returnedIssues: issues.length,
    maxIssues: request.maxIssues,
    maxAnnotatedIssues: request.maxAnnotatedIssues ?? request.maxIssues,
    maxReturnedIssues: request.maxReturnedIssues ?? Number.MAX_SAFE_INTEGER,
    confirmedErrorCount: issues.length - needsReviewCount,
    needsReviewCount,
    blocksAnalyzed,
    blocksWithIssues: new Set(issues.map((issue) => issue.location.blockId)).size,
    cacheHit: cacheInfo?.cacheHit,
    cacheKey: cacheInfo?.cacheKey,
    cachedAt: cacheInfo?.cachedAt,
    analysisDurationMs: cacheInfo?.analysisDurationMs,
    skippedAnalysisBecauseCacheHit: cacheInfo?.skippedAnalysisBecauseCacheHit,
  };
}

function getWorkingPath(session: DocumentSession) {
  return session.reviewedPath || session.originalPath;
}

function toCommentTarget(issue: Issue) {
  if (issue.location.target) {
    return {
      kind: "text" as const,
      blockId: issue.location.target.start.blockId,
      range: {
        start: issue.location.target.start.offset,
        end: issue.location.target.end.offset,
      },
    };
  }

  if (
    typeof issue.location.startOffset === "number" &&
    typeof issue.location.endOffset === "number"
  ) {
    return {
      kind: "text" as const,
      blockId: issue.location.blockId,
      range: {
        start: issue.location.startOffset,
        end: issue.location.endOffset,
      },
    };
  }

  return undefined;
}

function buildIssueComment(issue: Issue) {
  return [
    `AI phát hiện lỗi: ${issue.type}`,
    `Nội dung: "${issue.wrong}"`,
    `Gợi ý: "${issue.suggestion}"`,
    `Lý do: ${issue.reason}`,
    `Độ chắc chắn: ${issue.confidence}`,
    `Nguồn: ${issue.source}`,
    issue.status === "needs_review"
      ? "Trạng thái đề xuất: cần rà soát thủ công trước khi áp dụng."
      : "Trạng thái đề xuất: có thể áp dụng trực tiếp nếu xác nhận đúng ngữ cảnh.",
  ].join("\n");
}

function resolveReplacementText(issue: Issue) {
  if (
    issue.type === "spelling" ||
    issue.type === "accent" ||
    issue.type === "typo" ||
    issue.type === "grammar" ||
    issue.type === "style" ||
    issue.type === "translation_consistency" ||
    issue.type === "terminology_consistency" ||
    issue.type === "name_consistency" ||
    issue.type === "date_number_consistency"
  ) {
    return applySuggestionCasing(issue.wrong, issue.suggestion);
  }

  return issue.suggestion;
}

function canUseDirectTextReplacementFallback(issue: Issue) {
  return (
    issue.type === "spelling" ||
    issue.type === "accent" ||
    issue.type === "typo" ||
    issue.type === "grammar" ||
    issue.type === "style" ||
    issue.type === "translation_consistency" ||
    issue.type === "terminology_consistency" ||
    issue.type === "name_consistency" ||
    issue.type === "date_number_consistency"
  );
}

function isIssueAnnotated(issue: Issue) {
  return Boolean(
    issue.location.commentId ||
      issue.location.changeId ||
      issue.status === "commented" ||
      issue.status === "highlighted" ||
      issue.status === "tracked" ||
      issue.status === "applied" ||
      issue.status === "ignored"
  );
}

function getAnnotatedIssues(issues: Issue[]) {
  return issues.filter((issue) => isIssueAnnotated(issue));
}

function getAnnotatedIssueIds(issues: Issue[]) {
  return getAnnotatedIssues(issues).map((issue) => issue.id);
}

function isEmptyTextNodesError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return message.includes("Empty text nodes are not allowed");
}

function buildIssueTargetFromLocation(issue: Issue) {
  if (issue.location.target) return issue.location.target;

  if (
    typeof issue.location.startOffset === "number" &&
    typeof issue.location.endOffset === "number"
  ) {
    return {
      kind: "selection" as const,
      start: { kind: "text" as const, blockId: issue.location.blockId, offset: issue.location.startOffset },
      end: { kind: "text" as const, blockId: issue.location.blockId, offset: issue.location.endOffset },
    };
  }

  return undefined;
}

async function resolveCurrentIssueTarget(doc: any, issue: Issue) {
  const blocks = await readDocumentBlocks(doc);
  const block = blocks.find((candidate) => candidate.blockId === issue.location.blockId);
  if (!block) return buildIssueTargetFromLocation(issue);

  if (issue.type === "format_consistency" || issue.type === "heading_consistency") {
    return {
      kind: "selection" as const,
      start: { kind: "text" as const, blockId: block.blockId, offset: 0 },
      end: { kind: "text" as const, blockId: block.blockId, offset: block.text.length },
    };
  }

  const resolved = resolveIssueRange({
    block,
    wrong: issue.wrong,
    beforeContext: issue.location.beforeContext,
    afterContext: issue.location.afterContext,
  });

  return resolved.target ?? buildIssueTargetFromLocation(issue);
}

async function listChangeIds(doc: any) {
  const result = await doc.trackChanges.list();
  return new Set((result.items || []).map((item: any) => item.id));
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

async function loadGlobalGlossary() {
  return readJsonFile<Array<{ term: string; preferredTranslation?: string; alternatives?: string[] }>>(
    GLOBAL_GLOSSARY_PATH,
    []
  );
}

async function applyFormatSuggestion(doc: any, issue: Issue, changeMode: "tracked" | "direct") {
  const target = issue.location.target;
  const format = issue.suggestedFormat;
  if (!target || !format) return false;

  let applied = false;

  if (typeof format.bold === "boolean") {
    await doc.format.bold({ target, value: format.bold, changeMode });
    applied = true;
  }
  if (typeof format.italic === "boolean") {
    await doc.format.italic({ target, value: format.italic, changeMode });
    applied = true;
  }
  if (typeof format.underline === "boolean") {
    await doc.format.underline({ target, value: format.underline, changeMode });
    applied = true;
  }
  if (format.highlightColor) {
    await doc.format.highlight({ target, value: format.highlightColor, changeMode });
    applied = true;
  }
  if (format.color) {
    await doc.format.color({ target, value: format.color, changeMode });
    applied = true;
  }
  if (typeof format.fontSize === "number") {
    await doc.format.fontSize({ target, value: format.fontSize, changeMode });
    applied = true;
  }
  if (format.fontFamily) {
    await doc.format.fontFamily({ target, value: format.fontFamily, changeMode });
    applied = true;
  }

  if (
    !applied &&
    format.styleName &&
    (issue.type === "heading_consistency" || issue.type === "table_format_consistency")
  ) {
    await doc.styles.paragraph.setStyle({
      target: {
        kind: "block",
        nodeType: "paragraph",
        nodeId: issue.location.blockId,
      },
      styleId: format.styleName,
      changeMode,
    });
    applied = true;
  }

  return applied;
}

async function annotateIssuesInDoc({
  doc,
  documentId,
  issues,
  blocks,
  request,
  todos,
  traceCollector,
}: {
  doc: any;
  documentId: string;
  issues: Issue[];
  blocks: Awaited<ReturnType<typeof readDocumentBlocks>>;
  request: AnalyzeConsistencyRequest;
  todos: string[];
  traceCollector?: AnalysisTraceCollector;
}) {
  const comments: CommentRecord[] = [];
  const changes: ChangeRecord[] = [];

  for (const [index, issue] of issues.entries()) {
    const block = blocks.find((candidate) => candidate.blockId === issue.location.blockId);
    if (!block) continue;

    const resolved = resolveIssueRange({
      block,
      wrong: issue.wrong,
      beforeContext: issue.location.beforeContext,
      afterContext: issue.location.afterContext,
    });

    issue.location = {
      ...issue.location,
      path: block.path,
      startOffset: resolved.startOffset ?? issue.location.startOffset,
      endOffset: resolved.endOffset ?? issue.location.endOffset,
      target: resolved.target ?? issue.location.target,
      anchorId: issue.location.anchorId || `anchor_${documentId}_${index + 1}`,
    };

    const shouldKeepNeedsReview = issue.status === "needs_review";
    let commentCreated = false;
    let highlightApplied = false;
    let trackedChangeCreated = false;
    const annotationNotes: string[] = [];

    const commentTarget =
      toCommentTarget(issue) ||
      (block.text
        ? {
            kind: "text" as const,
            blockId: block.blockId,
            range: { start: 0, end: Math.max(1, block.text.length) },
          }
        : undefined);

    if (
      (request.mode === "comment_only" ||
        request.mode === "comment_and_highlight" ||
        request.mode === "track_changes_and_comment") &&
      commentTarget
    ) {
      const commentReceipt = await doc.comments.create({
        target: commentTarget,
        text: buildIssueComment(issue),
      });

      issue.location.commentId = commentReceipt.inserted?.[0]?.entityId;
      issue.status = "commented";

      if (issue.location.commentId) {
        commentCreated = true;
        comments.push({
          id: issue.location.commentId,
          issueId: issue.id,
          author: "AI Consistency Checker",
          text: buildIssueComment(issue),
          createdAt: nowIso(),
          targetText: issue.wrong,
          status: "open",
        });
      }
      annotationNotes.push("comment_created");

      if (shouldKeepNeedsReview) {
        issue.status = "needs_review";
      }
    } else if (
      request.mode === "comment_only" ||
      request.mode === "comment_and_highlight" ||
      request.mode === "track_changes_and_comment"
    ) {
      annotationNotes.push("comment_target_missing");
    }

    traceCollector?.recordRangeResolution(issue, resolved);

    if (
      (request.mode === "highlight_only" || request.mode === "comment_and_highlight") &&
      issue.location.target
    ) {
      await doc.format.highlight({
        target: issue.location.target,
        value: HIGHLIGHT_COLORS.yellow,
      });
      highlightApplied = true;
      issue.status = issue.location.commentId ? "commented" : "highlighted";
      annotationNotes.push("highlight_applied");

      if (shouldKeepNeedsReview) {
        issue.status = "needs_review";
      }
    } else if (request.mode === "highlight_only" || request.mode === "comment_and_highlight") {
      annotationNotes.push("highlight_target_missing");
    }

    if (
      !shouldKeepNeedsReview &&
      (request.mode === "track_changes" || request.mode === "track_changes_and_comment")
    ) {
      if (
        issue.location.target &&
        (issue.type === "spelling" ||
          issue.type === "accent" ||
          issue.type === "typo" ||
          issue.type === "grammar" ||
          issue.type === "style" ||
          issue.type === "translation_consistency" ||
          issue.type === "terminology_consistency" ||
          issue.type === "name_consistency" ||
          issue.type === "date_number_consistency")
      ) {
        const beforeChangeIds = await listChangeIds(doc);
        const replacementText = resolveReplacementText(issue);
        await doc.replace({
          target: issue.location.target,
          text: replacementText,
          changeMode: "tracked",
        });
        const afterChanges = await doc.trackChanges.list();
        const createdChange = (afterChanges.items || []).find(
          (item: any) => !beforeChangeIds.has(item.id)
        );

        if (createdChange) {
          trackedChangeCreated = true;
          issue.location.changeId = createdChange.id;
          issue.status = "tracked";
          changes.push({
            id: createdChange.id,
            issueId: issue.id,
            type: "replace",
            oldText: issue.wrong,
            newText: replacementText,
            author: createdChange.author || "AI Consistency Checker",
            createdAt: createdChange.date || nowIso(),
            status: "pending",
          });
          annotationNotes.push("tracked_change_created");
        }
      } else if (
        issue.location.target &&
        (issue.type === "format_consistency" || issue.type === "heading_consistency")
      ) {
        try {
          const beforeChangeIds = await listChangeIds(doc);
          const applied = await applyFormatSuggestion(doc, issue, "tracked");
          if (applied) {
            const afterChanges = await doc.trackChanges.list();
            const createdChange = (afterChanges.items || []).find(
              (item: any) => !beforeChangeIds.has(item.id)
            );
            if (createdChange) {
              trackedChangeCreated = true;
              issue.location.changeId = createdChange.id;
              issue.status = "tracked";
              changes.push({
                id: createdChange.id,
                issueId: issue.id,
                type: "format",
                oldText: issue.wrong,
                newText: issue.suggestion,
                author: createdChange.author || "AI Consistency Checker",
                createdAt: createdChange.date || nowIso(),
                status: "pending",
              });
              annotationNotes.push("tracked_format_change_created");
            }
          }
        } catch {
          todos.push(
            "TODO: format tracked change fallback used direct formatting/comment path because current SuperDoc SDK operation did not produce a stable tracked change receipt."
          );
          annotationNotes.push("tracked_format_change_failed");
        }
      } else {
        annotationNotes.push("track_change_target_missing");
      }
    }

    if (shouldKeepNeedsReview || (issue.status === "pending" && issue.type === "tone_consistency")) {
      issue.status = "needs_review";
    }

    traceCollector?.recordAnnotation(issue, {
      commentCreated,
      highlightApplied,
      trackedChangeCreated,
      skipped: !commentCreated && !highlightApplied && !trackedChangeCreated,
      detail: annotationNotes.join(", ") || undefined,
    });
  }

  return {
    comments,
    changes,
    annotatedIssueIds: getAnnotatedIssueIds(issues),
  };
}

export class DocumentReviewService {
  constructor(
    private readonly store: FileDocumentSessionStore,
    private readonly analysisCacheStore?: FileAnalysisCacheStore
  ) {}

  getContextPath(documentId: string) {
    return path.join(this.store.getDocumentDir(documentId), "context-memory.json");
  }

  getGlossaryPath(documentId: string) {
    return path.join(this.store.getDocumentDir(documentId), "glossary.json");
  }

  getFormatRulesPath(documentId: string) {
    return path.join(this.store.getDocumentDir(documentId), "format-rules.json");
  }

  getCheckConfigPath(documentId: string) {
    return path.join(this.store.getDocumentDir(documentId), "check-config.json");
  }

  getAllIssuesPath(documentId: string) {
    return path.join(this.store.getDocumentDir(documentId), "issues-all.json");
  }

  getTracePath(documentId: string) {
    return path.join(this.store.getDocumentDir(documentId), "analysis-trace.json");
  }

  async ensureFileHash(session: DocumentSession) {
    if (session.fileHash) return session.fileHash;
    session.fileHash = await hashFile(session.originalPath);
    await this.store.save(session);
    return session.fileHash;
  }

  async buildCacheDescriptor(session: DocumentSession, request: AnalyzeConsistencyRequest) {
    const fileHash = await this.ensureFileHash(session);
    const sortedChecks = [...request.checks].sort();
    const checkConfigHash = hashStableJson({
      checks: sortedChecks,
      mode: request.mode,
      useLLM: request.useLLM,
      useRuleEngine: request.useRuleEngine,
      analysisEngineVersion: ANALYSIS_ENGINE_VERSION,
    });
    const dictionaryHash = hashStableJson({
      version: DICTIONARY_VERSION,
      customDictionary: CUSTOM_DICTIONARY,
      packageHash: await hashFile(DICTIONARY_JSON_PATH).catch(() => "missing_dictionary_package"),
    });
    const promptHash = hashStableJson({
      version: PROMPT_VERSION,
      checks: sortedChecks,
      useLLM: request.useLLM,
    });
    const cacheKey = sha256Hex(
      [
        fileHash,
        checkConfigHash,
        dictionaryHash,
        promptHash,
        ANALYSIS_ENGINE_VERSION,
      ].join(":")
    );

    return {
      cacheKey,
      fileHash,
      checkConfigHash,
      dictionaryHash,
      promptHash,
      dictionaryVersion: DICTIONARY_VERSION,
      promptVersion: PROMPT_VERSION,
      analysisEngineVersion: ANALYSIS_ENGINE_VERSION,
    };
  }

  buildCacheInfo(session: DocumentSession): AnalysisCacheInfo {
    const annotatedIssues = session.annotatedIssueIds?.length ?? 0;
    return {
      cacheHit: Boolean(session.cacheHit),
      cacheKey: session.cacheKey,
      cachedAt: session.cachedAt,
      analysisDurationMs: session.analysisDurationMs,
      skippedAnalysisBecauseCacheHit: Boolean(session.skippedAnalysisBecauseCacheHit),
      totalIssues: session.issues.length,
      annotatedIssues,
      unannotatedIssues: Math.max(session.issues.length - annotatedIssues, 0),
    };
  }

  async ensureReviewedCopy(session: DocumentSession) {
    const reviewedPath = createReviewedPath(session);
    await mkdir(path.dirname(reviewedPath), { recursive: true });
    if (!session.reviewedPath) {
      await copyFile(session.originalPath, reviewedPath);
      session.reviewedPath = reviewedPath;
    }
    return reviewedPath;
  }

  async buildContext(documentId: string) {
    const session = await this.requireSession(documentId);
    const documentGlossary = await readJsonFile<Array<{ term: string; preferredTranslation?: string; alternatives?: string[] }>>(
      this.getGlossaryPath(documentId),
      []
    );
    const globalGlossary = await loadGlobalGlossary();

    const contextMemory = await withSuperDocDocument(session.originalPath, async (doc) => {
      const blocks = await readDocumentBlocks(doc);
      return buildContextMemory({
        documentId,
        blocks,
        globalGlossary,
        documentGlossary,
      });
    });

    await writeJsonFile(this.getContextPath(documentId), contextMemory);
    await writeJsonFile(this.getGlossaryPath(documentId), contextMemory.glossary);
    await writeJsonFile(this.getFormatRulesPath(documentId), contextMemory.formatRules);
    await writeJsonFile(this.getCheckConfigPath(documentId), DEFAULT_CHECK_CONFIG);

    session.history.push(
      createHistory(
        "context_built",
        `Built context memory with ${summarizeContextMemory(contextMemory).terms} glossary terms.`
      )
    );
    await this.store.save(session);

    return contextMemory;
  }

  async getContext(documentId: string) {
    return readJsonFile<DocumentContextMemory | null>(this.getContextPath(documentId), null);
  }

  async getAllIssues(documentId: string) {
    return readJsonFile<Issue[]>(this.getAllIssuesPath(documentId), []);
  }

  async getTrace(documentId: string) {
    return readJsonFile<AnalysisTraceArtifact | null>(this.getTracePath(documentId), null);
  }

  async listIssues(
    documentId: string,
    query: {
      page?: number;
      pageSize?: number;
      annotated?: "true" | "false";
      status?: string;
      source?: string;
      type?: string;
    }
  ): Promise<IssueListResponse> {
    const session = await this.requireSession(documentId);
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize || 200)));

    let filtered = [...session.issues];
    if (query.annotated === "true") {
      filtered = filtered.filter((issue) => isIssueAnnotated(issue));
    } else if (query.annotated === "false") {
      filtered = filtered.filter((issue) => !isIssueAnnotated(issue));
    }
    if (query.status) {
      filtered = filtered.filter((issue) => issue.status === query.status);
    }
    if (query.source) {
      filtered = filtered.filter((issue) => issue.source === query.source);
    }
    if (query.type) {
      filtered = filtered.filter((issue) => issue.type === query.type);
    }

    const start = (page - 1) * pageSize;
    const issues = filtered.slice(start, start + pageSize);
    const annotatedCount = session.issues.filter((issue) => isIssueAnnotated(issue)).length;

    return {
      documentId,
      issues,
      total: filtered.length,
      page,
      pageSize,
      hasMore: start + pageSize < filtered.length,
      annotatedCount,
      unannotatedCount: session.issues.length - annotatedCount,
    };
  }

  async updateGlossary(documentId: string, glossary: Array<{ term: string; preferredTranslation?: string; alternatives?: string[] }>) {
    await this.requireSession(documentId);
    await writeJsonFile(this.getGlossaryPath(documentId), glossary);
    return glossary;
  }

  async annotateMoreIssues(input: {
    documentId: string;
    mode: ReviewMode;
    count?: number;
    all?: boolean;
    issueIds?: string[];
  }) {
    const session = await this.requireSession(input.documentId);
    const reviewedPath = await this.ensureReviewedCopy(session);
    const limit = input.all ? Number.MAX_SAFE_INTEGER : Math.max(1, input.count || 500);
    const requestedIssueIds = new Set(input.issueIds || []);
    const candidateIssues = requestedIssueIds.size > 0
      ? session.issues.filter((issue) => requestedIssueIds.has(issue.id))
      : session.issues;
    const pendingIssues = candidateIssues.filter((issue) => !isIssueAnnotated(issue)).slice(0, limit);
    const todos: string[] = [];

    if (pendingIssues.length === 0) {
      return { session, todos };
    }

    const mutationResult = await withSuperDocDocument(getWorkingPath(session), async (doc) => {
      const blocks = await readDocumentBlocks(doc);
      const annotationResult = await annotateIssuesInDoc({
        doc,
        documentId: input.documentId,
        issues: pendingIssues,
        blocks,
        request: {
          ...DEFAULT_ANALYZE_REQUEST,
          mode: input.mode,
          maxIssues: limit,
          maxAnnotatedIssues: limit,
          maxReturnedIssues: Number.MAX_SAFE_INTEGER,
          debugTrace: false,
        },
        todos,
      });

      await doc.save({
        out: reviewedPath,
        force: true,
      });

      return annotationResult;
    });

    session.reviewedPath = reviewedPath;
    session.annotatedIssueIds = getAnnotatedIssueIds(session.issues);
    session.comments = [...session.comments, ...mutationResult.comments];
    session.changes = [...session.changes, ...mutationResult.changes];
    if (session.analysisSummary) {
      session.analysisSummary = {
        ...session.analysisSummary,
        selectedIssues: session.annotatedIssueIds.length,
        annotatedIssues: session.annotatedIssueIds.length,
        returnedIssues: session.issues.length,
      };
    }
    session.history.push(
      createHistory(
        "highlighted",
        input.all
          ? `Annotated all remaining issues in reviewed-consistency.docx.`
          : `Annotated ${mutationResult.annotatedIssueIds.length} additional issues in reviewed-consistency.docx.`
      )
    );
    await writeJsonFile(this.getAllIssuesPath(input.documentId), session.issues);
    await this.store.save(session);
    return { session, todos };
  }

  async runReview(input: RunReviewInput) {
    return this.runConsistencyAnalysis({
      documentId: input.documentId,
      request: {
        ...DEFAULT_ANALYZE_REQUEST,
        checks: ["spelling"],
        mode: input.mode,
        maxIssues: input.maxIssues || DEFAULT_MAX_ISSUES,
        debugTrace: input.debugTrace,
        useCache: input.useCache,
        forceReanalyze: input.forceReanalyze,
        annotateFromCache: input.annotateFromCache,
      },
    });
  }

  private async runConsistencyAnalysisFromCache({
    session,
    request,
    cacheEntry,
    cacheKey,
    cachedAt,
    startedAt,
  }: {
    session: DocumentSession;
    request: AnalyzeConsistencyRequest;
    cacheEntry: {
      issues: Issue[];
      contextMemory?: DocumentContextMemory | null;
      trace?: AnalysisTraceArtifact | null;
    };
    cacheKey: string;
    cachedAt?: string;
    startedAt: number;
  }) {
    const reviewedPath = await this.ensureReviewedCopy(session);
    const todos: string[] = [
      "Đã dùng kết quả phân tích đã lưu cho file này. Backend chỉ annotate lại batch đầu vào DOCX hiện tại.",
    ];
    const contextMemory = cacheEntry.contextMemory
      ? { ...cloneJson(cacheEntry.contextMemory), documentId: session.documentId }
      : (await this.getContext(session.documentId)) || (await this.buildContext(session.documentId));
    const traceEnabled = request.debugTrace ?? session.traceEnabled ?? false;
    let analysisTrace: AnalysisTraceArtifact | undefined;

    if (cacheEntry.contextMemory) {
      await writeJsonFile(this.getContextPath(session.documentId), contextMemory);
      await writeJsonFile(this.getGlossaryPath(session.documentId), contextMemory.glossary);
      await writeJsonFile(this.getFormatRulesPath(session.documentId), contextMemory.formatRules);
    }

    const mutationResult = await withSuperDocDocument(session.originalPath, async (doc) => {
      const blocks = await readDocumentBlocks(doc);
      const issues = cacheEntry.issues.map((issue, index) =>
        stripIssueAnnotation(issue, session.documentId, index)
      );
      for (const issue of issues) {
        resolveCachedIssueForBlocks(issue, blocks);
      }

      const annotateTargets = request.annotateFromCache === false
        ? []
        : issues.slice(0, request.maxAnnotatedIssues ?? request.maxIssues);
      const annotationResult = await annotateIssuesInDoc({
        doc,
        documentId: session.documentId,
        issues: annotateTargets,
        blocks,
        request,
        todos,
      });

      await doc.save({
        out: reviewedPath,
        force: true,
      });

      const durationMs = Date.now() - startedAt;
      const summary = buildSummaryFromIssues(issues, annotationResult.annotatedIssueIds.length, request, blocks.length, {
        cacheHit: true,
        cacheKey,
        cachedAt,
        analysisDurationMs: durationMs,
        skippedAnalysisBecauseCacheHit: true,
      });

      if (traceEnabled) {
        const cachedTrace = cacheEntry.trace ? cloneJson(cacheEntry.trace) : null;
        analysisTrace = cachedTrace || {
          documentId: session.documentId,
          createdAt: nowIso(),
          request: {
            checks: [...request.checks],
            mode: request.mode,
            useLLM: request.useLLM,
            useRuleEngine: request.useRuleEngine,
            maxIssues: request.maxIssues,
            maxAnnotatedIssues: request.maxAnnotatedIssues ?? request.maxIssues,
            maxReturnedIssues: request.maxReturnedIssues ?? Number.MAX_SAFE_INTEGER,
            debugTrace: true,
            useCache: request.useCache,
            forceReanalyze: request.forceReanalyze,
            annotateFromCache: request.annotateFromCache,
          },
          cache: {
            cacheHit: true,
            cacheKey,
            cachedAt,
            forceReanalyze: false,
            skippedAnalysisBecauseCacheHit: true,
          },
          summary: {
            detectedByDetector: issues.length,
            afterDedup: issues.length,
            afterSelection: annotationResult.annotatedIssueIds.length,
            annotatedInDocx: annotationResult.annotatedIssueIds.length,
            returnedToUi: issues.length,
            rangeNotFound: 0,
            droppedByBudget: issues.length - annotationResult.annotatedIssueIds.length,
            duplicatesRemoved: 0,
            resolvedExact: annotationResult.annotatedIssueIds.length,
            resolvedFuzzy: 0,
            resolvedAmbiguous: 0,
            resolvedNotFound: 0,
            commentCreated: annotationResult.comments.length,
            highlightApplied: annotationResult.annotatedIssueIds.length,
            trackedChangeCreated: annotationResult.changes.length,
            skippedAnnotation: 0,
            confirmedErrorCount: summary.confirmedErrorCount,
            needsReviewCount: summary.needsReviewCount,
            detectorBySource: {
              rule_engine: issues.filter((issue) => issue.source === "rule_engine").length,
              llm: issues.filter((issue) => issue.source === "llm").length,
              hybrid: issues.filter((issue) => issue.source === "hybrid").length,
            },
            cacheHit: true,
            cacheKey,
            cachedAt,
            forceReanalyze: false,
          },
          stages: {
            inputBlocks: { blocks: blocks.length, uniqueTemplates: 0, representativeChunks: 0 },
            detectorOutput: {
              ruleIssues: issues.filter((issue) => issue.source === "rule_engine").length,
              dictionarySuspicionIssues: issues.filter((issue) => issue.source === "hybrid").length,
              llmIssues: issues.filter((issue) => issue.source === "llm").length,
              mergedIssues: issues.length,
              bySource: {
                rule_engine: issues.filter((issue) => issue.source === "rule_engine").length,
                llm: issues.filter((issue) => issue.source === "llm").length,
                hybrid: issues.filter((issue) => issue.source === "hybrid").length,
              },
              needsReviewCount: summary.needsReviewCount,
              confirmedErrorCount: summary.confirmedErrorCount,
            },
            postPipeline: {
              beforeDedup: issues.length,
              afterDedup: issues.length,
              afterSelection: annotationResult.annotatedIssueIds.length,
              duplicatesRemoved: 0,
              droppedByBudget: issues.length - annotationResult.annotatedIssueIds.length,
            },
            rangeResolution: { exact: annotationResult.annotatedIssueIds.length, fuzzy: 0, ambiguous: 0, notFound: 0 },
            annotation: {
              commentCreated: annotationResult.comments.length,
              highlightApplied: annotationResult.annotatedIssueIds.length,
              trackedChangeCreated: annotationResult.changes.length,
              annotatedInDocx: annotationResult.annotatedIssueIds.length,
              skippedAnnotation: 0,
            },
            responsePayload: { returnedToUi: issues.length },
          },
          issues: issues.map((issue, index) => ({
            traceId: `cache_${String(index + 1).padStart(4, "0")}`,
            issueId: issue.id,
            wrong: issue.wrong,
            suggestion: issue.suggestion,
            type: issue.type,
            source: issue.source,
            confidence: issue.confidence,
            status: issue.status,
            blockId: issue.location.blockId,
            path: issue.location.path,
            returnedToUi: true,
            dropped: index >= annotationResult.annotatedIssueIds.length,
            dropReason: index >= annotationResult.annotatedIssueIds.length ? "trimmed_by_max_issues" : undefined,
            events: [
              {
                stage: "post_pipeline",
                decision: "cache_hit",
                detail: cacheKey,
                createdAt: nowIso(),
              },
              {
                stage: "response_payload",
                decision: "returned_to_ui",
                createdAt: nowIso(),
              },
            ],
          })),
        };
        analysisTrace = {
          ...analysisTrace,
          documentId: session.documentId,
          cache: {
            cacheHit: true,
            cacheKey,
            cachedAt,
            forceReanalyze: false,
            skippedAnalysisBecauseCacheHit: true,
          },
          summary: {
            ...analysisTrace.summary,
            cacheHit: true,
            cacheKey,
            cachedAt,
            forceReanalyze: false,
            returnedToUi: issues.length,
            annotatedInDocx: annotationResult.annotatedIssueIds.length,
            droppedByBudget: issues.length - annotationResult.annotatedIssueIds.length,
          },
          stages: {
            ...analysisTrace.stages,
            responsePayload: { returnedToUi: issues.length },
            annotation: {
              ...analysisTrace.stages.annotation,
              annotatedInDocx: annotationResult.annotatedIssueIds.length,
              commentCreated: annotationResult.comments.length,
              trackedChangeCreated: annotationResult.changes.length,
            },
            postPipeline: {
              ...analysisTrace.stages.postPipeline,
              afterSelection: annotationResult.annotatedIssueIds.length,
              droppedByBudget: issues.length - annotationResult.annotatedIssueIds.length,
            },
          },
        };
      }

      return {
        issues,
        annotatedIssueIds: annotationResult.annotatedIssueIds,
        comments: annotationResult.comments,
        changes: annotationResult.changes,
        summary,
      };
    });

    session.issues = mutationResult.issues;
    session.annotatedIssueIds = mutationResult.annotatedIssueIds;
    session.comments = mutationResult.comments;
    session.changes = mutationResult.changes;
    session.reviewedPath = reviewedPath;
    session.allIssuesPath = this.getAllIssuesPath(session.documentId);
    session.traceEnabled = traceEnabled;
    session.tracePath = traceEnabled ? this.getTracePath(session.documentId) : undefined;
    session.analysisSummary = mutationResult.summary;
    session.traceSummary = analysisTrace?.summary;
    session.cacheHit = true;
    session.cacheKey = cacheKey;
    session.cachedAt = cachedAt;
    session.analysisDurationMs = mutationResult.summary.analysisDurationMs;
    session.skippedAnalysisBecauseCacheHit = true;
    await writeJsonFile(session.allIssuesPath, session.issues);
    if (traceEnabled && analysisTrace && session.tracePath) {
      await writeJsonFile(session.tracePath, analysisTrace);
    }
    session.history.push(
      createHistory(
        "analyzed",
        `Loaded ${session.issues.length} cached issues and annotated ${session.annotatedIssueIds.length} issues in reviewed-consistency.docx.`
      )
    );
    await this.store.save(session);

    return {
      session,
      contextMemory,
      todos,
      summary: mutationResult.summary,
      traceEnabled,
      traceSummary: analysisTrace?.summary,
      trace: analysisTrace,
      cacheInfo: this.buildCacheInfo(session),
    };
  }

  async runConsistencyAnalysis({ documentId, request }: AnalyzeConsistencyInput) {
    const startedAt = Date.now();
    const session = await this.requireSession(documentId);
    const todos: string[] = [];
    let analysisSummary: AnalysisSummary | undefined;
    const traceEnabled = request.debugTrace ?? session.traceEnabled ?? false;
    const effectiveRequest: AnalyzeConsistencyRequest = {
      ...request,
      maxAnnotatedIssues: request.maxAnnotatedIssues ?? request.maxIssues,
      maxReturnedIssues: request.maxReturnedIssues ?? Number.MAX_SAFE_INTEGER,
      useCache: request.useCache ?? true,
      forceReanalyze: request.forceReanalyze ?? false,
      annotateFromCache: request.annotateFromCache ?? true,
      debugTrace: traceEnabled,
    };
    const cacheDescriptor = await this.buildCacheDescriptor(session, effectiveRequest);

    if (
      this.analysisCacheStore &&
      effectiveRequest.useCache !== false &&
      effectiveRequest.forceReanalyze !== true
    ) {
      const cached = await this.analysisCacheStore.get(cacheDescriptor.cacheKey);
      if (cached && cached.issues.length > 0) {
        return this.runConsistencyAnalysisFromCache({
          session,
          request: effectiveRequest,
          cacheEntry: cached,
          cacheKey: cacheDescriptor.cacheKey,
          cachedAt: cached.metadata.updatedAt || cached.metadata.createdAt,
          startedAt,
        });
      }
    }

    const reviewedPath = await this.ensureReviewedCopy(session);
    const contextMemory = (await this.getContext(documentId)) || (await this.buildContext(documentId));
    const traceCollector = traceEnabled
      ? new AnalysisTraceCollector(documentId, effectiveRequest)
      : undefined;
    let analysisTrace: AnalysisTraceArtifact | undefined;
    traceCollector?.recordCache({
      cacheHit: false,
      cacheKey: cacheDescriptor.cacheKey,
      forceReanalyze: effectiveRequest.forceReanalyze,
      skippedAnalysisBecauseCacheHit: false,
    });

    const mutationResult = await withSuperDocDocument(getWorkingPath(session), async (doc) => {
      const blocks = await readDocumentBlocks(doc);
      const pipelineResult = await runConsistencyPipelineDetailed({
        documentId,
        blocks,
        contextMemory,
        request: effectiveRequest,
        traceCollector,
      });
      pipelineResult.allIssues.forEach((issue, index) => {
        if (!issue.id) {
          issue.id = `issue_${String(index + 1).padStart(4, "0")}`;
        }
      });
      const rawCacheIssues = sanitizeIssuesForCache(pipelineResult.allIssues);
      const annotateTargets = pipelineResult.selectedIssues;
      const annotationResult = await annotateIssuesInDoc({
        doc,
        documentId,
        issues: annotateTargets,
        blocks,
        request: effectiveRequest,
        todos,
        traceCollector,
      });

      analysisSummary = {
        ...pipelineResult.summary,
        selectedIssues: annotationResult.annotatedIssueIds.length,
        annotatedIssues: annotationResult.annotatedIssueIds.length,
        returnedIssues: pipelineResult.allIssues.length,
        maxAnnotatedIssues: effectiveRequest.maxAnnotatedIssues ?? effectiveRequest.maxIssues,
        maxReturnedIssues: effectiveRequest.maxReturnedIssues ?? Number.MAX_SAFE_INTEGER,
        cacheHit: false,
        cacheKey: cacheDescriptor.cacheKey,
        analysisDurationMs: Date.now() - startedAt,
        skippedAnalysisBecauseCacheHit: false,
      };

      traceCollector?.recordResponseIssues(pipelineResult.allIssues);
      analysisTrace = traceCollector?.buildArtifact();

      await doc.save({
        out: reviewedPath,
        force: true,
      });

      return {
        issues: pipelineResult.allIssues,
        annotatedIssueIds: annotationResult.annotatedIssueIds,
        comments: annotationResult.comments,
        changes: annotationResult.changes,
        allIssues: pipelineResult.allIssues,
        rawCacheIssues,
      };
    });

    session.issues = mutationResult.issues;
    session.annotatedIssueIds = mutationResult.annotatedIssueIds;
    session.comments = mutationResult.comments;
    session.changes = mutationResult.changes;
    session.reviewedPath = reviewedPath;
    session.allIssuesPath = this.getAllIssuesPath(documentId);
    session.traceEnabled = traceEnabled;
    session.tracePath = traceEnabled ? this.getTracePath(documentId) : undefined;
    session.analysisSummary = analysisSummary;
    session.traceSummary = analysisTrace?.summary;
    session.cacheHit = false;
    session.cacheKey = cacheDescriptor.cacheKey;
    session.cachedAt = undefined;
    session.analysisDurationMs = Date.now() - startedAt;
    session.skippedAnalysisBecauseCacheHit = false;
    await writeJsonFile(session.allIssuesPath, mutationResult.allIssues);
    if (traceEnabled && analysisTrace && session.tracePath) {
      await writeJsonFile(session.tracePath, analysisTrace);
    }
    if (this.analysisCacheStore && session.fileHash && analysisSummary) {
      const now = nowIso();
      const metadata: AnalysisCacheMetadata = {
        cacheKey: cacheDescriptor.cacheKey,
        fileHash: session.fileHash,
        originalFileName: session.originalFileName,
        createdAt: now,
        updatedAt: now,
        totalIssues: mutationResult.rawCacheIssues.length,
        checks: [...effectiveRequest.checks],
        mode: effectiveRequest.mode,
        useLLM: effectiveRequest.useLLM,
        useRuleEngine: effectiveRequest.useRuleEngine,
        checkConfigHash: cacheDescriptor.checkConfigHash,
        dictionaryVersion: cacheDescriptor.dictionaryVersion,
        dictionaryHash: cacheDescriptor.dictionaryHash,
        promptVersion: cacheDescriptor.promptVersion,
        promptHash: cacheDescriptor.promptHash,
        analysisEngineVersion: cacheDescriptor.analysisEngineVersion,
        sourceDocumentId: documentId,
      };
      const existing = await this.analysisCacheStore.get(cacheDescriptor.cacheKey);
      await this.analysisCacheStore.put({
        metadata: {
          ...metadata,
          createdAt: existing?.metadata.createdAt ?? metadata.createdAt,
        },
        issues: mutationResult.rawCacheIssues,
        trace: analysisTrace,
        contextMemory,
      });
    }

    if (analysisSummary && analysisSummary.detectedIssues > analysisSummary.selectedIssues) {
      todos.push(
        `Phát hiện ${analysisSummary.detectedIssues.toLocaleString("vi-VN")} lỗi trên ${analysisSummary.blocksAnalyzed.toLocaleString("vi-VN")} đoạn, gồm ${analysisSummary.confirmedErrorCount.toLocaleString("vi-VN")} lỗi chắc chắn và ${analysisSummary.needsReviewCount.toLocaleString("vi-VN")} mục cần rà soát. Toàn bộ lỗi đã được giữ trong session/UI; hiện mới annotate ${analysisSummary.annotatedIssues.toLocaleString("vi-VN")} lỗi đầu vào DOCX do giới hạn annotate. Hãy dùng "Annotate thêm 500 lỗi" hoặc "Annotate tất cả lỗi" nếu cần.`
      );
    }

    if (analysisSummary) {
      console.info(
        `[analysis] ${documentId}: detected=${analysisSummary.detectedIssues}, confirmed=${analysisSummary.confirmedErrorCount}, needsReview=${analysisSummary.needsReviewCount}, selected=${analysisSummary.selectedIssues}, blocks=${analysisSummary.blocksAnalyzed}, blocksWithIssues=${analysisSummary.blocksWithIssues}, uniqueTemplates=${analysisSummary.uniqueBlockTemplates ?? "n/a"}`
      );
    }

    session.history.push(createHistory(
      "analyzed",
      analysisSummary && analysisSummary.detectedIssues > analysisSummary.selectedIssues
        ? `Ran consistency analysis and found ${analysisSummary.detectedIssues} issues. Annotated ${analysisSummary.annotatedIssues} issues in reviewed-consistency.docx.`
        : `Ran consistency analysis and found ${session.issues.length} issues.`
    ));

    if (session.comments.length) {
      session.history.push(createHistory("commented", `Added ${session.comments.length} AI comments.`));
    }
    if (request.mode === "highlight_only" || request.mode === "comment_and_highlight") {
      session.history.push(createHistory("highlighted", "Highlighted consistency issues in reviewed-consistency.docx."));
    }
    if (session.changes.length) {
      session.history.push(createHistory("tracked", `Created ${session.changes.length} tracked changes.`));
    }

    await this.store.save(session);
    return {
      session,
      contextMemory,
      todos,
      summary: analysisSummary,
      traceEnabled,
      traceSummary: analysisTrace?.summary,
      trace: analysisTrace,
      cacheInfo: this.buildCacheInfo(session),
    };
  }

  async analyzeSelection(
    documentId: string,
    selection: { blockId: string; startOffset: number; endOffset: number },
    checks: AnalyzeConsistencyRequest["checks"]
  ) {
    const session = await this.requireSession(documentId);
    const contextMemory = (await this.getContext(documentId)) || (await this.buildContext(documentId));

    return withSuperDocDocument(getWorkingPath(session), async (doc) => {
      const blocks = await readDocumentBlocks(doc);
      const filteredBlocks = blocks.filter((block) => block.blockId === selection.blockId);
      return runConsistencyPipeline({
        documentId,
        blocks: filteredBlocks,
        contextMemory,
        request: {
          ...DEFAULT_ANALYZE_REQUEST,
          checks,
          maxIssues: 100,
        },
      });
    });
  }

  async applyIssue(documentId: string, issueId: string) {
    const session = await this.requireSession(documentId);
    const issue = session.issues.find((candidate) => candidate.id === issueId);
    if (!issue) throw new Error("Issue not found");

    const reviewedPath = createReviewedPath(session);
    const todos: string[] = [];
    const workingPath = getWorkingPath(session);
    const replacementText = issue.type !== "tone_consistency" ? resolveReplacementText(issue) : null;
    let appliedViaXmlFallback = false;

    try {
      await withSuperDocDocument(workingPath, async (doc) => {
        if (issue.location.changeId) {
          await doc.trackChanges.decide({
            decision: "accept",
            target: { id: issue.location.changeId },
          });

          const change = session.changes.find((candidate) => candidate.id === issue.location.changeId);
          if (change) change.status = "accepted";
        } else {
          const currentTarget = await resolveCurrentIssueTarget(doc, issue);
          if (currentTarget) {
            issue.location.target = currentTarget;
          }

          if (!currentTarget) {
            throw new Error("Không xác định được vị trí hiện tại của lỗi để áp dụng.");
          }

          if (issue.type === "format_consistency" || issue.type === "heading_consistency") {
            const applied = await applyFormatSuggestion(doc, issue, "direct");
            if (!applied) {
              todos.push(
                "TODO: style-level apply fallback is limited by current SuperDoc SDK metadata for this issue."
              );
            }
            try {
              await doc.format.highlight({
                target: currentTarget,
                value: HIGHLIGHT_COLORS.yellow,
                changeMode: "direct",
              });
            } catch {
              // Best-effort: highlight is only a visual confirmation of the applied fix.
            }
          } else if (issue.type !== "tone_consistency" && replacementText) {
            await doc.replace({
              target: currentTarget,
              text: replacementText,
              changeMode: "direct",
            });
            issue.location = buildAppliedIssueLocation(issue.location, replacementText);

            try {
              await doc.format.highlight({
                target: issue.location.target ?? currentTarget,
                value: HIGHLIGHT_COLORS.yellow,
                changeMode: "direct",
              });
            } catch {
              // Best-effort: highlight is only a visual confirmation of the applied fix.
            }
          }
        }

        if (issue.location.commentId) {
          await doc.comments.patch({
            id: issue.location.commentId,
            status: "resolved",
          });
        }

        await doc.save({ out: reviewedPath, force: true });
      });
    } catch (error) {
      if (
        !issue.location.changeId &&
        issue.type !== "tone_consistency" &&
        replacementText &&
        canUseDirectTextReplacementFallback(issue) &&
        isEmptyTextNodesError(error)
      ) {
        appliedViaXmlFallback = await applyTextIssueXmlFallback(
          workingPath,
          reviewedPath,
          issue,
          replacementText
        );

        if (!appliedViaXmlFallback) {
          throw error;
        }

        issue.location = buildAppliedIssueLocation(issue.location, replacementText);

        await withSuperDocDocument(reviewedPath, async (doc) => {
          if (issue.location.commentId) {
            await doc.comments.patch({
              id: issue.location.commentId,
              status: "resolved",
            });
          }

          const fallbackTarget = issue.location.target;
          if (fallbackTarget) {
            try {
              await doc.format.highlight({
                target: fallbackTarget,
                value: HIGHLIGHT_COLORS.yellow,
                changeMode: "direct",
              });
            } catch {
              // Best-effort: highlight is only a visual confirmation of the applied fix.
            }
          }

          await doc.save({ out: reviewedPath, force: true });
        });
      } else {
        throw error;
      }
    }

    issue.status = issue.type === "tone_consistency" ? "needs_review" : "applied";
    session.annotatedIssueIds = getAnnotatedIssueIds(session.issues);
    session.reviewedPath = reviewedPath;
    session.history.push(createHistory("applied", `Applied issue ${issue.id}: ${issue.wrong} -> ${issue.suggestion}.`));
    await this.store.save(session);
    return { session, todos };
  }

  async ignoreIssue(documentId: string, issueId: string) {
    const session = await this.requireSession(documentId);
    const issue = session.issues.find((candidate) => candidate.id === issueId);
    if (!issue) throw new Error("Issue not found");

    const todos: string[] = [];
    const reviewedPath = createReviewedPath(session);

    await withSuperDocDocument(getWorkingPath(session), async (doc) => {
      if (issue.location.commentId) {
        await doc.comments.patch({
          id: issue.location.commentId,
          status: "resolved",
        });
      }

      if (issue.location.changeId) {
        await doc.trackChanges.decide({
          decision: "reject",
          target: { id: issue.location.changeId },
        });

        const change = session.changes.find((candidate) => candidate.id === issue.location.changeId);
        if (change) change.status = "rejected";
      }

      const currentTarget = await resolveCurrentIssueTarget(doc, issue);
      if (currentTarget) {
        issue.location.target = currentTarget;
        try {
          await doc.format.highlight({
            target: currentTarget,
            value: null,
            changeMode: "direct",
          });
        } catch {
          // Best-effort: older SDKs may not support clearing highlight with null.
        }
      }

      await doc.save({ out: reviewedPath, force: true });
    });

    issue.status = "ignored";
    session.annotatedIssueIds = getAnnotatedIssueIds(session.issues);
    session.reviewedPath = reviewedPath;
    session.history.push(createHistory("ignored", `Ignored issue ${issue.id}: ${issue.wrong}.`));
    await this.store.save(session);
    return { session, todos };
  }

  async applyHighConfidence(documentId: string) {
    const session = await this.requireSession(documentId);

    for (const issue of session.issues.filter((candidate) => candidate.confidence === "high")) {
      if (issue.status === "needs_review") continue;
      if (issue.status === "applied" || issue.status === "ignored") continue;
      await this.applyIssue(documentId, issue.id);
    }

    return this.requireSession(documentId);
  }

  async requireSession(documentId: string) {
    const session = await this.store.get(documentId);
    if (!session) throw new Error("Document session not found");
    return session;
  }
}
