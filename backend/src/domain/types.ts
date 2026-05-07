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
  chunkIndex?: number;
  pageNumber?: number;
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

export type PageChunkStatus =
  | "pending"
  | "analyzing"
  | "completed"
  | "failed";

export type PageChunk = {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  status: PageChunkStatus;
  issueCount?: number;
  errorMessage?: string;
};

export type AnalysisStatus =
  | "idle"
  | "analyzing"
  | "partial"
  | "completed"
  | "failed"
  | "paused";

export type AnalysisProgress = {
  documentId: string;
  fileHash: string;
  totalPages: number;
  pageSize: number;
  totalChunks: number;
  completedChunks: number;
  currentChunkIndex: number | null;
  status: AnalysisStatus;
  totalIssues: number;
  updatedAt: string;
};

export type AnnotationApplyResult = {
  issueId: string;
  status: "applied" | "range_not_found" | "skipped" | "failed";
  reason?: string;
};

export type CachedChunkAnalysis = {
  documentId: string;
  fileHash: string;
  fileName: string;
  chunkIndex: number;
  startPage: number;
  endPage: number;
  analyzedAt: string;
  status: "completed" | "failed";
  issues: Issue[];
  errorMessage?: string;
  annotationResults?: AnnotationApplyResult[];
};

export type CachedDocumentAnalysisMetadata = {
  documentId: string;
  fileHash: string;
  fileName: string;
  totalPages: number;
  pageSize: number;
  totalChunks: number;
  completedChunks: number;
  status: "partial" | "completed" | "failed";
  totalIssues: number;
  createdAt: string;
  updatedAt: string;
  cacheKey?: string;
  chunks?: PageChunk[];
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
  confidence: Confidence;
  status: IssueStatus;
  blockId: string;
  path?: string;
  dropped?: boolean;
  dropReason?: string;
  resolution?: ResolvedRangeConfidence;
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
    checks: AnalyzeConsistencyRequest["checks"];
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
  fileHash?: string;
  reviewedPath?: string;
  finalPath?: string;
  allIssuesPath?: string;
  annotatedIssueIds?: string[];
  activeIssueWindow?: IssueAnnotationWindow | null;
  traceEnabled?: boolean;
  tracePath?: string;
  analysisSummary?: AnalysisSummary;
  traceSummary?: AnalysisTraceSummary;
  cacheKey?: string;
  cacheHit?: boolean;
  cachedAt?: string;
  analysisDurationMs?: number;
  skippedAnalysisBecauseCacheHit?: boolean;
  issues: Issue[];
  comments: CommentRecord[];
  changes: ChangeRecord[];
  history: HistoryRecord[];
};

export type IssueAnnotationWindow = {
  startIndex: number;
  count: number;
  endIndex: number;
  totalIssues: number;
  issueIds: string[];
  reviewedFileName?: string;
  createdAt: string;
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
  maxAnnotatedIssues?: number;
  maxReturnedIssues?: number;
  debugTrace?: boolean;
  useCache?: boolean;
  forceReanalyze?: boolean;
  annotateFromCache?: boolean;
};

export type AnalysisCacheMetadata = {
  cacheKey: string;
  fileHash: string;
  originalFileName: string;
  createdAt: string;
  updatedAt: string;
  totalIssues: number;
  checks: AnalyzeConsistencyRequest["checks"];
  mode: ReviewMode;
  useLLM: boolean;
  useRuleEngine: boolean;
  checkConfigHash: string;
  dictionaryVersion?: string;
  dictionaryHash: string;
  promptVersion?: string;
  promptHash: string;
  analysisEngineVersion: string;
  sourceDocumentId: string;
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
  activeIssueWindow?: IssueAnnotationWindow | null;
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
