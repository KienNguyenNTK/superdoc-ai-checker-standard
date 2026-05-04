import type {
  DocumentApi,
  SuperDoc,
  TextAddress,
  TextTarget,
} from "superdoc";
import type { SpellingIssue } from "../types";
import {
  pickBestIssueMatch,
  type IssueCommentTarget,
  type IssueMatchCandidate,
} from "./issue-navigation";

const BODY_STORY = {
  kind: "story",
  storyType: "body",
} as const;

type SuperDocInstance = InstanceType<typeof SuperDoc>;
type QueryMatchItem = ReturnType<DocumentApi["query"]["match"]>["items"][number];

export async function ensureIssueComment(
  superdoc: SuperDocInstance,
  issue: SpellingIssue
) {
  const editor = superdoc.activeEditor;
  if (!editor) {
    return null;
  }

  if (issue.commentId && hasComment(editor.doc, issue.commentId)) {
    return issue.commentId;
  }

  const target = findIssueCommentTarget(editor.doc, issue);
  if (!target) {
    return null;
  }

  const existingComments = editor.doc.comments.list({ includeResolved: true }).items as unknown as Array<{
    commentId: string;
    text?: string;
  }>;
  const previousIds = new Set(existingComments.map((item) => item.commentId));

  const text = buildIssueCommentText(issue);
  editor.doc.comments.create({ text, target });

  const createdComments = editor.doc.comments.list({ includeResolved: true }).items as unknown as Array<{
    commentId: string;
    text?: string;
  }>;
  const createdComment = createdComments.find(
    (item) => !previousIds.has(item.commentId) && item.text === text
  );

  return createdComment?.commentId ?? null;
}

export async function navigateToIssue(superdoc: SuperDocInstance, issue: SpellingIssue) {
  const commentId = issue.commentId || (await ensureIssueComment(superdoc, issue));
  if (!commentId) {
    return false;
  }

  const didNavigate = await superdoc.navigateTo({
    kind: "entity",
    entityType: "comment",
    entityId: commentId,
  });

  superdoc.commentsStore?.setActiveComment?.(superdoc, commentId);
  return didNavigate;
}

export function syncIssueResolution(superdoc: SuperDocInstance, issue: SpellingIssue) {
  const editor = superdoc.activeEditor;
  if (!editor || !issue.commentId || !hasComment(editor.doc, issue.commentId)) {
    return;
  }

  const current = editor.doc.comments.get({ commentId: issue.commentId });
  const nextStatus = issue.status === "pending" ? "active" : "resolved";
  const currentStatus = current.status === "open" ? "active" : "resolved";

  if (currentStatus !== nextStatus) {
    editor.doc.comments.patch({
      commentId: issue.commentId,
      status: nextStatus,
    });
  }
}

function hasComment(doc: DocumentApi, commentId: string) {
  try {
    return !!doc.comments.get({ commentId });
  } catch {
    return false;
  }
}

function findIssueCommentTarget(doc: DocumentApi, issue: SpellingIssue): IssueCommentTarget | null {
  const candidates: IssueMatchCandidate[] = [];

  if (issue.excerpt) {
    candidates.push(...queryCandidates(doc, issue.excerpt, "excerpt"));
  }

  candidates.push(...queryCandidates(doc, issue.wrong, "wrong"));

  return pickBestIssueMatch(issue, candidates)?.target ?? null;
}

function queryCandidates(
  doc: DocumentApi,
  pattern: string,
  source: IssueMatchCandidate["source"]
) {
  const text = pattern.trim();
  if (!text) {
    return [];
  }

  const result = doc.query.match({
    select: {
      type: "text",
      pattern: text,
      caseSensitive: false,
    },
    in: BODY_STORY,
    limit: 10,
  });

  return result.items
    .map((item) => toIssueMatchCandidate(item, source))
    .filter((item): item is IssueMatchCandidate => !!item);
}

function toIssueMatchCandidate(
  item: QueryMatchItem,
  source: IssueMatchCandidate["source"]
): IssueMatchCandidate | null {
  if (item.matchKind !== "text") {
    return null;
  }

  return {
    source,
    snippet: item.snippet,
    target: queryItemToCommentTarget(item),
  };
}

function queryItemToCommentTarget(item: QueryMatchItem): TextAddress | TextTarget | null {
  if (item.matchKind !== "text" || !item.blocks.length) {
    return null;
  }

  if (item.blocks.length === 1) {
    const [block] = item.blocks;
    return {
      kind: "text",
      blockId: block.blockId,
      range: {
        start: block.range.start,
        end: block.range.end,
      },
      story: BODY_STORY,
    };
  }

  return {
    kind: "text",
    story: BODY_STORY,
    segments: item.blocks.map((block: QueryMatchItem["blocks"][number]) => ({
      blockId: block.blockId,
      range: {
        start: block.range.start,
        end: block.range.end,
      },
    })) as TextTarget["segments"],
  };
}

function buildIssueCommentText(issue: SpellingIssue) {
  return `${issue.wrong} → ${issue.suggestion}\n${issue.reason}`;
}
