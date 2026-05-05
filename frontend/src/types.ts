export type DocumentMode = "viewing" | "editing" | "suggesting";

export type IssueStatus =
  | "pending"
  | "commented"
  | "highlighted"
  | "tracked"
  | "applied"
  | "ignored"
  | "needs_review";

export type ReviewMode =
  | "comment_only"
  | "highlight_only"
  | "track_changes"
  | "comment_and_highlight"
  | "track_changes_and_comment";

export type BlockType =
  | "paragraph"
  | "heading"
  | "tableCell"
  | "header"
  | "footer"
  | "listItem";

export type IssueLocation = {
  blockId: string;
  blockType: BlockType;
  path: string;
  startOffset?: number;
  endOffset?: number;
  searchText: string;
  beforeContext?: string;
  afterContext?: string;
  commentId?: string;
  changeId?: string;
  anchorId?: string;
  target?: {
    kind: "selection";
    start: { kind: "text"; blockId: string; offset: number };
    end: { kind: "text"; blockId: string; offset: number };
  };
};

export type SpellingIssue = {
  id: string;
  documentId: string;
  wrong: string;
  suggestion: string;
  reason: string;
  type: "spelling" | "accent" | "typo" | "grammar" | "style";
  confidence: "high" | "medium" | "low";
  status: IssueStatus;
  location: IssueLocation;
};

export type CommentRecord = {
  id: string;
  issueId?: string;
  author: string;
  text: string;
  createdAt: string;
  targetText?: string;
  status?: "open" | "resolved";
};

export type ChangeRecord = {
  id: string;
  issueId?: string;
  type: "replace" | "insert" | "delete";
  oldText?: string;
  newText?: string;
  author: string;
  createdAt: string;
  status: "pending" | "accepted" | "rejected";
};

export type HistoryRecord = {
  id: string;
  type:
    | "imported"
    | "analyzed"
    | "commented"
    | "highlighted"
    | "tracked"
    | "applied"
    | "ignored"
    | "exported";
  message: string;
  createdAt: string;
};

export type ApiHealth = {
  ok: boolean;
  superdoc: string;
  llm: {
    baseURL: string;
    model: string;
  };
  dictionarySize: number;
};

export type UploadedDocument = {
  documentId: string;
  originalFileUrl: string;
  status: "uploaded";
};

export type ReviewResponse = {
  documentId: string;
  status?: string;
  issues: SpellingIssue[];
  comments: CommentRecord[];
  changes: ChangeRecord[];
  history?: HistoryRecord[];
  reviewedFileUrl?: string | null;
  message?: string;
  todos?: string[];
};

export type FocusIssueResponse = {
  issueId: string;
  location: IssueLocation;
};

export type ReviewTab = "issues" | "comments" | "changes" | "history";

export type AgentOption = {
  id: string;
  name: string;
  description: string;
  defaultMode: ReviewMode;
};
