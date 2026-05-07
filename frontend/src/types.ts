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
  | "listItem"
  | "caption"
  | "footnote";

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
  target?: {
    kind: "selection";
    start: { kind: "text"; blockId: string; offset: number };
    end: { kind: "text"; blockId: string; offset: number };
  };
};

export type Issue = {
  id: string;
  documentId: string;
  wrong: string;
  suggestion: string;
  reason: string;
  type: IssueType;
  confidence: "high" | "medium" | "low";
  severity: IssueSeverity;
  source: IssueSource;
  status: IssueStatus;
  location: IssueLocation;
  evidence?: Array<{ blockId: string; text: string; note: string }>;
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
  fileHash?: string;
  status: "uploaded";
};

export type GlossaryEntry = {
  term: string;
  preferredTranslation?: string;
  alternatives: string[];
  firstSeenBlockId: string;
  confidence: "high" | "medium" | "low";
};

export type FormatRule = {
  target: string;
  ruleType: string;
  expectedFormat: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
};

export type ToneRule = {
  rule: string;
  examples: string[];
  confidence: "high" | "medium" | "low";
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

export type AnalysisSummary = {
  detectedIssues: number;
  selectedIssues: number;
  annotatedIssues: number;
  returnedIssues: number;
  maxIssues: number;
  maxAnnotatedIssues: number;
  maxReturnedIssues: number;
  confirmedErrorCount: number;
  needsReviewCount: number;
  blocksAnalyzed: number;
  blocksWithIssues: number;
  uniqueBlockTemplates?: number;
  cacheHit?: boolean;
  cacheKey?: string;
  cachedAt?: string;
  analysisDurationMs?: number;
  skippedAnalysisBecauseCacheHit?: boolean;
};

export type AnalysisTraceStage =
  | "input_blocks"
  | "detector_output"
  | "post_pipeline"
  | "range_resolution"
  | "annotation"
  | "response_payload"
  | "client";

export type AnalysisTraceSummary = {
  detectedByDetector: number;
  afterDedup: number;
  afterSelection: number;
  annotatedInDocx: number;
  returnedToUi: number;
  rangeNotFound: number;
  droppedByBudget: number;
  duplicatesRemoved: number;
  resolvedExact: number;
  resolvedFuzzy: number;
  resolvedAmbiguous: number;
  resolvedNotFound: number;
  commentCreated: number;
  highlightApplied: number;
  trackedChangeCreated: number;
  skippedAnnotation: number;
  confirmedErrorCount: number;
  needsReviewCount: number;
  detectorBySource: {
    rule_engine: number;
    llm: number;
    hybrid: number;
  };
  cacheHit?: boolean;
  cacheKey?: string;
  cachedAt?: string;
  forceReanalyze?: boolean;
};

export type AnalysisTraceEvent = {
  stage: AnalysisTraceStage;
  decision: string;
  detail?: string;
  createdAt: string;
};

export type AnalysisTraceIssueRecord = {
  traceId: string;
  issueId?: string;
  wrong: string;
  suggestion: string;
  type: IssueType;
  source: IssueSource;
  confidence: "high" | "medium" | "low";
  status: IssueStatus;
  blockId: string;
  path?: string;
  dropped?: boolean;
  dropReason?: string;
  resolution?: "exact" | "fuzzy" | "ambiguous" | "not_found";
  returnedToUi?: boolean;
  annotated?: {
    commentCreated: boolean;
    highlightApplied: boolean;
    trackedChangeCreated: boolean;
  };
  events: AnalysisTraceEvent[];
};

export type AnalysisTraceArtifact = {
  documentId: string;
  createdAt: string;
  request: {
    checks: Array<
      "spelling" | "format" | "terminology" | "translation" | "tone" | "entity" | "date_number"
    >;
    mode: ReviewMode;
    useLLM: boolean;
    useRuleEngine: boolean;
    maxIssues: number;
    maxAnnotatedIssues: number;
    maxReturnedIssues: number;
    debugTrace: boolean;
    useCache?: boolean;
    forceReanalyze?: boolean;
    annotateFromCache?: boolean;
  };
  cache?: {
    cacheHit: boolean;
    cacheKey?: string;
    cachedAt?: string;
    forceReanalyze?: boolean;
    skippedAnalysisBecauseCacheHit?: boolean;
  };
  summary: AnalysisTraceSummary;
  stages: {
    inputBlocks: {
      blocks: number;
      uniqueTemplates: number;
      representativeChunks: number;
    };
    detectorOutput: {
      ruleIssues: number;
      dictionarySuspicionIssues: number;
      llmIssues: number;
      mergedIssues: number;
      bySource: AnalysisTraceSummary["detectorBySource"];
      needsReviewCount: number;
      confirmedErrorCount: number;
    };
    postPipeline: {
      beforeDedup: number;
      afterDedup: number;
      afterSelection: number;
      duplicatesRemoved: number;
      droppedByBudget: number;
    };
    rangeResolution: {
      exact: number;
      fuzzy: number;
      ambiguous: number;
      notFound: number;
    };
    annotation: {
      commentCreated: number;
      highlightApplied: number;
      trackedChangeCreated: number;
      annotatedInDocx: number;
      skippedAnnotation: number;
    };
    responsePayload: {
      returnedToUi: number;
    };
  };
  issues: AnalysisTraceIssueRecord[];
};

export type ClientTraceEvent = {
  id: string;
  stage: AnalysisTraceStage;
  decision: string;
  detail: string;
  createdAt: string;
  traceId?: string;
  issueId?: string;
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

export type ReviewResponse = {
  documentId: string;
  status?: string;
  issues: Issue[];
  annotatedIssues?: Issue[];
  comments: CommentRecord[];
  changes: ChangeRecord[];
  history?: HistoryRecord[];
  summary?: AnalysisSummary;
  traceEnabled?: boolean;
  traceSummary?: AnalysisTraceSummary;
  traceFileUrl?: string | null;
  reviewedFileUrl?: string | null;
  message?: string;
  todos?: string[];
  context?: DocumentContextMemory;
  cacheInfo?: AnalysisCacheInfo;
  appliedIssueId?: string;
  appliedIssueLocation?: IssueLocation;
};

export type TraceResponse = {
  traceEnabled: boolean;
  traceSummary?: AnalysisTraceSummary;
  traceFileUrl?: string | null;
  trace?: AnalysisTraceArtifact | null;
};

export type IssueListResponse = {
  documentId: string;
  issues: Issue[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  annotatedCount: number;
  unannotatedCount: number;
};

export type AnalysisCacheInfo = {
  cacheHit: boolean;
  cacheKey?: string;
  cachedAt?: string;
  analysisDurationMs?: number;
  skippedAnalysisBecauseCacheHit: boolean;
  totalIssues: number;
  annotatedIssues: number;
  unannotatedIssues: number;
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
  checks: Array<
    "spelling" | "format" | "terminology" | "translation" | "tone" | "entity" | "date_number"
  >;
};

export type IssueFilter =
  | "all"
  | "annotated"
  | "unannotated"
  | "needs_review"
  | "spelling"
  | "format"
  | "terminology"
  | "translation"
  | "tone"
  | "entity"
  | "date_number";
