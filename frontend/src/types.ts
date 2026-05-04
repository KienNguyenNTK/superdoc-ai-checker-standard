export type DocumentMode = "viewing" | "editing" | "suggesting";

export type SpellingIssue = {
  id: string;
  wrong: string;
  suggestion: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  blockLabel?: string;
  excerpt?: string;
  commentId?: string;
  status: "pending" | "accepted" | "ignored";
};

export type AnalyzeResult = {
  issues: SpellingIssue[];
  reviewedFileUrl?: string | null;
  meta?: {
    chars?: number;
    model?: string;
  };
};

export type ApiHealth = {
  ok: boolean;
  model: string;
  baseURL: string;
};
