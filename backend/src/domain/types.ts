export type BlockType =
  | "paragraph"
  | "heading"
  | "tableCell"
  | "header"
  | "footer"
  | "listItem"
  | "caption"
  | "footnote";

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

export type IssueType =
  | "spelling"
  | "accent"
  | "typo"
  | "grammar"
  | "style"
  | "terminology_consistency"
  | "translation_consistency"
  | "format_consistency"
  | "capitalization_consistency"
  | "tone_consistency"
  | "name_consistency"
  | "date_number_consistency"
  | "heading_consistency"
  | "table_format_consistency";

export type IssueSeverity = "info" | "warning" | "error";
export type IssueSource = "rule_engine" | "llm" | "hybrid";

export type HeadingSemanticRole =
  | "document_title"
  | "document_subtitle"
  | "chapter_heading"
  | "section_heading_level_1"
  | "section_heading_level_2"
  | "section_heading_level_3"
  | "table_title"
  | "figure_caption"
  | "appendix_heading"
  | "normal_heading"
  | "unknown";

export type RunFormatSnapshot = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlightColor?: string;
  fontFamily?: string;
  fontSize?: number;
  styleName?: string;
};

export type DocumentRun = RunFormatSnapshot & {
  runId: string;
  text: string;
  startOffset: number;
  endOffset: number;
};

export type DocumentBlock = {
  blockId: string;
  type: BlockType;
  text: string;
  path: string;
  page?: number;
  runs: DocumentRun[];
  metadata?: {
    tableIndex?: number;
    rowIndex?: number;
    cellIndex?: number;
    headingLevel?: number;
    listLevel?: number;
    styleName?: string;
  };
};

export type ResolvedRangeConfidence = "exact" | "fuzzy" | "ambiguous" | "not_found";

export type SelectionTarget = {
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

export type ResolvedRange = {
  blockId: string;
  path: string;
  startOffset?: number;
  endOffset?: number;
  exactText?: string;
  beforeContext?: string;
  afterContext?: string;
  confidence: ResolvedRangeConfidence;
  target?: SelectionTarget;
};

export type IssueLocation = {
  blockId: string;
  blockType: BlockType;
  path: string;
  startOffset?: number;
  endOffset?: number;
  runIds?: string[];
  searchText: string;
  beforeContext?: string;
  afterContext?: string;
  commentId?: string;
  changeId?: string;
  anchorId?: string;
  target?: SelectionTarget;
};

export type IssueEvidence = {
  blockId: string;
  text: string;
  note: string;
};

export type Issue = {
  id: string;
  documentId: string;
  type: IssueType;
  wrong: string;
  suggestion: string;
  reason: string;
  confidence: Confidence;
  severity: IssueSeverity;
  source: IssueSource;
  status: IssueStatus;
  location: IssueLocation;
  evidence?: IssueEvidence[];
  shouldAutoApply?: boolean;
  suggestedFormat?: RunFormatSnapshot;
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
  type: "replace" | "insert" | "delete" | "format";
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
    | "exported"
    | "context_built";
  message: string;
  createdAt: string;
};

export type GlossaryOccurrence = {
  blockId: string;
  text: string;
  translation?: string;
  format?: RunFormatSnapshot;
};

export type GlossaryEntry = {
  term: string;
  preferredTranslation?: string;
  alternatives: string[];
  firstSeenBlockId: string;
  occurrences: GlossaryOccurrence[];
  confidence: Confidence;
};

export type FormatRule = {
  target: string;
  ruleType:
    | "term_format"
    | "heading_format"
    | "table_format"
    | "caption_format"
    | "first_mention_format";
  expectedFormat: RunFormatSnapshot;
  semanticRole?: HeadingSemanticRole;
  examples: Array<{
    blockId: string;
    text: string;
  }>;
  confidence: Confidence;
};

export type ToneRule = {
  rule: string;
  examples: string[];
  confidence: Confidence;
};

export type EntityRule = {
  canonicalName: string;
  variants: string[];
  firstSeenBlockId: string;
};

export type DocumentContextMemory = {
  documentId: string;
  glossary: GlossaryEntry[];
  formatRules: FormatRule[];
  toneRules: ToneRule[];
  entityRules: EntityRule[];
};

export type CheckConfig = {
  checks: {
    spelling: {
      enabled: boolean;
      mode: ReviewMode;
      autoApplyHighConfidence: boolean;
    };
    formatConsistency: {
      enabled: boolean;
      checkBold: boolean;
      checkItalic: boolean;
      checkUnderline: boolean;
      checkHeadingStyles: boolean;
      checkFirstMentionInChapter: boolean;
    };
    translationConsistency: {
      enabled: boolean;
      useGlossary: boolean;
      inferGlossary: boolean;
      requireUserConfirmGlossary: boolean;
    };
    toneConsistency: {
      enabled: boolean;
      targetTone: string;
    };
  };
};

export type PromptTemplate = {
  id: string;
  name: string;
  description: string;
  system: string;
  userTemplate: string;
  outputSchema: object;
  defaultModelOptions?: {
    temperature?: number;
    maxTokens?: number;
  };
};

export type PromptTestResult = {
  ok: boolean;
  promptId: string;
  renderedSystem: string;
  renderedUser: string;
  parsed?: unknown;
  rawOutput?: string;
  error?: string;
};

export type DocumentSession = {
  documentId: string;
  createdAt: string;
  updatedAt: string;
  originalFileName: string;
  originalPath: string;
  reviewedPath?: string;
  finalPath?: string;
  issues: Issue[];
  comments: CommentRecord[];
  changes: ChangeRecord[];
  history: HistoryRecord[];
};

export type AnalyzeConsistencyRequest = {
  checks: Array<
    | "spelling"
    | "format"
    | "terminology"
    | "translation"
    | "tone"
    | "entity"
    | "date_number"
  >;
  mode: ReviewMode;
  useLLM: boolean;
  useRuleEngine: boolean;
  maxIssues: number;
};
