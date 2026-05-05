import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  ChangeRecord,
  CommentRecord,
  DocumentSession,
  HistoryRecord,
  ReviewMode,
  SpellingIssue,
} from "../../domain/types.js";
import { resolveIssueRange } from "./rangeResolver.js";
import type { FileDocumentSessionStore } from "../storage/documentSessionStore.js";
import { withSuperDocDocument } from "../superdoc/superdocClient.js";
import { readDocumentBlocks } from "../superdoc/documentReader.js";
import { analyzeSpellingIssues } from "../llm/spellingAnalyzer.js";

type RunReviewInput = {
  documentId: string;
  mode: ReviewMode;
  highlightColor?: string;
  maxIssues?: number;
  applyHighConfidence?: boolean;
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
  return path.join(path.dirname(session.originalPath), "reviewed.docx");
}

function getWorkingPath(session: DocumentSession) {
  return session.reviewedPath || session.originalPath;
}

function toCommentTarget(issue: SpellingIssue) {
  if (
    typeof issue.location.startOffset !== "number" ||
    typeof issue.location.endOffset !== "number"
  ) {
    return undefined;
  }

  return {
    kind: "text" as const,
    blockId: issue.location.blockId,
    range: {
      start: issue.location.startOffset,
      end: issue.location.endOffset,
    },
  };
}

function buildIssueComment(issue: SpellingIssue) {
  return [
    "AI phát hiện lỗi chính tả.",
    `Từ/cụm từ: "${issue.wrong}"`,
    `Gợi ý: "${issue.suggestion}"`,
    `Lý do: ${issue.reason}`,
    `Độ chắc chắn: ${issue.confidence}`,
  ].join("\n");
}

async function listChangeIds(doc: any) {
  const result = await doc.trackChanges.list();
  return new Set((result.items || []).map((item: any) => item.id));
}

export class DocumentReviewService {
  constructor(private readonly store: FileDocumentSessionStore) {}

  async runReview(input: RunReviewInput) {
    const session = await this.requireSession(input.documentId);
    const reviewedPath = createReviewedPath(session);
    const highlightColor = HIGHLIGHT_COLORS[input.highlightColor || "yellow"] || "#fff59d";

    await mkdir(path.dirname(reviewedPath), { recursive: true });
    if (!session.reviewedPath) {
      await copyFile(session.originalPath, reviewedPath);
      session.reviewedPath = reviewedPath;
    }

    const mutationResult = await withSuperDocDocument(getWorkingPath(session), async (doc) => {
      const blocks = await readDocumentBlocks(doc);
      const llmIssues = await analyzeSpellingIssues(blocks);
      const issues: SpellingIssue[] = [];
      const comments: CommentRecord[] = [];
      const changes: ChangeRecord[] = [];

      for (const [index, rawIssue] of llmIssues.slice(0, input.maxIssues || 200).entries()) {
        const block = blocks.find((candidate) => candidate.blockId === rawIssue.blockId);
        if (!block) continue;

        const resolved = resolveIssueRange({
          block,
          wrong: rawIssue.wrong,
          beforeContext: rawIssue.beforeContext,
          afterContext: rawIssue.afterContext,
        });

        const issue: SpellingIssue = {
          id: `issue_${String(index + 1).padStart(3, "0")}`,
          documentId: session.documentId,
          wrong: rawIssue.wrong,
          suggestion: rawIssue.suggestion,
          reason: rawIssue.reason,
          type: rawIssue.type,
          confidence: rawIssue.confidence,
          status: "needs_review",
          shouldAutoApply: rawIssue.shouldAutoApply,
          location: {
            blockId: block.blockId,
            blockType: block.type,
            path: block.path,
            startOffset: resolved.startOffset,
            endOffset: resolved.endOffset,
            searchText: rawIssue.wrong,
            beforeContext: rawIssue.beforeContext,
            afterContext: rawIssue.afterContext,
            anchorId: `anchor_${session.documentId}_${index + 1}`,
            target: resolved.target,
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
          (input.mode === "comment_only" ||
            input.mode === "comment_and_highlight" ||
            input.mode === "track_changes_and_comment") &&
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
              author: "AI Spelling Checker",
              text: buildIssueComment(issue),
              createdAt: nowIso(),
              targetText: issue.wrong,
              status: "open",
            });
          }
        }

        if (
          (input.mode === "highlight_only" || input.mode === "comment_and_highlight") &&
          issue.location.target
        ) {
          await doc.format.highlight({
            target: issue.location.target,
            value: highlightColor,
          });
          issue.status = issue.location.commentId ? "commented" : "highlighted";
        }

        if (
          (input.mode === "track_changes" ||
            input.mode === "track_changes_and_comment" ||
            input.applyHighConfidence) &&
          issue.location.target &&
          (input.applyHighConfidence ? issue.confidence === "high" : true)
        ) {
          const beforeChangeIds = await listChangeIds(doc);
          await doc.replace({
            target: issue.location.target,
            text: issue.suggestion,
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
              newText: issue.suggestion,
              author: createdChange.author || "AI Spelling Checker",
              createdAt: createdChange.date || nowIso(),
              status: "pending",
            });
          }
        }

        if (issue.status === "needs_review") {
          issue.status = resolved.confidence === "not_found" ? "needs_review" : "pending";
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
      createHistory("analyzed", `Ran spelling checker and found ${session.issues.length} issues.`)
    );

    if (session.comments.length) {
      session.history.push(
        createHistory("commented", `Added ${session.comments.length} AI comments.`)
      );
    }

    if (input.mode === "highlight_only" || input.mode === "comment_and_highlight") {
      session.history.push(
        createHistory("highlighted", "Highlighted spelling issues in reviewed.docx.")
      );
    }

    if (session.changes.length) {
      session.history.push(
        createHistory("tracked", `Created ${session.changes.length} tracked changes.`)
      );
    }

    await this.store.save(session);
    return session;
  }

  async applyIssue(documentId: string, issueId: string) {
    const session = await this.requireSession(documentId);
    const issue = session.issues.find((candidate) => candidate.id === issueId);
    if (!issue) throw new Error("Issue not found");

    const reviewedPath = createReviewedPath(session);

    await withSuperDocDocument(getWorkingPath(session), async (doc) => {
      if (issue.location.changeId) {
        await doc.trackChanges.decide({
          decision: "accept",
          target: { id: issue.location.changeId },
        });

        const change = session.changes.find((candidate) => candidate.id === issue.location.changeId);
        if (change) change.status = "accepted";
      } else if (issue.location.target) {
        await doc.replace({
          target: issue.location.target,
          text: issue.suggestion,
          changeMode: "direct",
        });
      }

      await doc.save({ out: reviewedPath, force: true });
    });

    issue.status = "applied";
    session.reviewedPath = reviewedPath;
    session.history.push(
      createHistory("applied", `Applied issue ${issue.id}: ${issue.wrong} -> ${issue.suggestion}.`)
    );
    await this.store.save(session);
    return session;
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

      todos.push(
        "TODO: remove permanent highlight for ignored issues when a stable inverse highlight operation is confirmed in the current SuperDoc SDK."
      );

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
