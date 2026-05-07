import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnalyzeConsistencyRequest,
  ChangeRecord,
  CheckConfig,
  CommentRecord,
  DocumentContextMemory,
  DocumentSession,
  HistoryRecord,
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
import { runConsistencyPipeline } from "../consistency/consistencyPipeline.js";
import { summarizeContextMemory } from "../consistency/consistencyReporter.js";
import { DEFAULT_MAX_ISSUES, GLOBAL_GLOSSARY_PATH } from "../../config.js";
import { applySuggestionCasing } from "../llm/spellingAnalyzer.js";

type RunReviewInput = {
  documentId: string;
  mode: ReviewMode;
  highlightColor?: string;
  maxIssues?: number;
  applyHighConfidence?: boolean;
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

export class DocumentReviewService {
  constructor(private readonly store: FileDocumentSessionStore) {}

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

  async updateGlossary(documentId: string, glossary: Array<{ term: string; preferredTranslation?: string; alternatives?: string[] }>) {
    await this.requireSession(documentId);
    await writeJsonFile(this.getGlossaryPath(documentId), glossary);
    return glossary;
  }

  async runReview(input: RunReviewInput) {
    return this.runConsistencyAnalysis({
      documentId: input.documentId,
      request: {
        ...DEFAULT_ANALYZE_REQUEST,
        checks: ["spelling"],
        mode: input.mode,
        maxIssues: input.maxIssues || DEFAULT_MAX_ISSUES,
      },
    });
  }

  async runConsistencyAnalysis({ documentId, request }: AnalyzeConsistencyInput) {
    const session = await this.requireSession(documentId);
    const reviewedPath = await this.ensureReviewedCopy(session);
    const contextMemory = (await this.getContext(documentId)) || (await this.buildContext(documentId));
    const todos: string[] = [];

    const mutationResult = await withSuperDocDocument(getWorkingPath(session), async (doc) => {
      const blocks = await readDocumentBlocks(doc);
      const rawIssues = await runConsistencyPipeline({
        documentId,
        blocks,
        contextMemory,
        request,
      });
      const issues: Issue[] = [];
      const comments: CommentRecord[] = [];
      const changes: ChangeRecord[] = [];

      for (const [index, rawIssue] of rawIssues.entries()) {
        const block = blocks.find((candidate) => candidate.blockId === rawIssue.location.blockId);
        if (!block) continue;

        const resolved = resolveIssueRange({
          block,
          wrong: rawIssue.wrong,
          beforeContext: rawIssue.location.beforeContext,
          afterContext: rawIssue.location.afterContext,
        });

        const issue: Issue = {
          ...rawIssue,
          id: rawIssue.id || `issue_${String(index + 1).padStart(3, "0")}`,
          location: {
            ...rawIssue.location,
            path: block.path,
            startOffset: resolved.startOffset ?? rawIssue.location.startOffset,
            endOffset: resolved.endOffset ?? rawIssue.location.endOffset,
            target: resolved.target ?? rawIssue.location.target,
            anchorId: rawIssue.location.anchorId || `anchor_${documentId}_${index + 1}`,
          },
        };

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
        }

        if (
          (request.mode === "highlight_only" || request.mode === "comment_and_highlight") &&
          issue.location.target
        ) {
          await doc.format.highlight({
            target: issue.location.target,
            value: HIGHLIGHT_COLORS.yellow,
          });
          issue.status = issue.location.commentId ? "commented" : "highlighted";
        }

        if (
          request.mode === "track_changes" ||
          request.mode === "track_changes_and_comment"
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
                }
              }
            } catch {
              todos.push(
                "TODO: format tracked change fallback used direct formatting/comment path because current SuperDoc SDK operation did not produce a stable tracked change receipt."
              );
            }
          }
        }

        if (issue.status === "pending" && issue.type === "tone_consistency") {
          issue.status = "needs_review";
        }

        issues.push(issue);
      }

      await doc.save({
        out: reviewedPath,
        force: true,
      });

      return { issues, comments, changes };
    });

    session.issues = mutationResult.issues;
    session.comments = mutationResult.comments;
    session.changes = mutationResult.changes;
    session.reviewedPath = reviewedPath;
    session.history.push(
      createHistory("analyzed", `Ran consistency analysis and found ${session.issues.length} issues.`)
    );

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
    return { session, contextMemory, todos };
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
    session.reviewedPath = reviewedPath;
    session.history.push(createHistory("ignored", `Ignored issue ${issue.id}: ${issue.wrong}.`));
    await this.store.save(session);
    return { session, todos };
  }

  async applyHighConfidence(documentId: string) {
    const session = await this.requireSession(documentId);

    for (const issue of session.issues.filter((candidate) => candidate.confidence === "high")) {
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
