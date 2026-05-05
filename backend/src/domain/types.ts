export type BlockType =
  | "paragraph"
  | "heading"
  | "tableCell"
  | "header"
  | "footer"
  | "listItem";

export type IssueStatus =
  | "pending"
  | "commented"
  | "highlighted"
  | "tracked"
  | "applied"
  | "ignored"
  | "needs_review";

export type Confidence = "high" | "medium" | "low";

export type ReviewMode =
  | "comment_only"
  | "highlight_only"
  | "track_changes"
  | "comment_and_highlight"
  | "track_changes_and_comment";

export type DocumentBlock = {
  blockId: string;
  type: BlockType;
  text: string;
  path: string;
  runRefs?: Array<{
    runId: string;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;
  metadata?: {
    tableIndex?: number;
    rowIndex?: number;
    cellIndex?: number;
    headingLevel?: number;
    styleName?: string;
  };
};

export type ResolvedRangeConfidence = "exact" | "fuzzy" | "ambiguous" | "not_found";

export type ResolvedRange = {
  blockId: string;
  path: string;
  startOffset?: number;
  endOffset?: number;
  exactText?: string;
  beforeContext?: string;
  afterContext?: string;
  confidence: ResolvedRangeConfidence;
  target?: {
    kind: "selection";
    start: {
      kind: "text";
      blockId: string;
      offset: number;
    };
    end: {
      kind: "text";
      blockId: string;
      offset: number;
    };
  };
};

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
  target?: ResolvedRange["target"];
};

export type SpellingIssue = {
  id: string;
  documentId: string;
  wrong: string;
  suggestion: string;
  reason: string;
  type: "spelling" | "accent" | "typo" | "grammar" | "style";
  confidence: Confidence;
  status: IssueStatus;
  location: IssueLocation;
  shouldAutoApply?: boolean;
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

export type DocumentSession = {
  documentId: string;
  createdAt: string;
  updatedAt: string;
  originalFileName: string;
  originalPath: string;
  reviewedPath?: string;
  finalPath?: string;
  issues: SpellingIssue[];
  comments: CommentRecord[];
  changes: ChangeRecord[];
  history: HistoryRecord[];
};
