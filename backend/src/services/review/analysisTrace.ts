import type {
  AnalysisTraceArtifact,
  AnalysisTraceIssueRecord,
  AnalysisTraceSummary,
  AnalyzeConsistencyRequest,
  DocumentBlock,
  Issue,
  ResolvedRange,
} from "../../domain/types.js";

type DetectorMetrics = {
  ruleIssues: number;
  dictionarySuspicionIssues: number;
  llmIssues: number;
  mergedIssues: number;
  bySource: AnalysisTraceSummary["detectorBySource"];
  needsReviewCount: number;
  confirmedErrorCount: number;
};

type AnnotationResult = {
  commentCreated?: boolean;
  highlightApplied?: boolean;
  trackedChangeCreated?: boolean;
  skipped?: boolean;
  detail?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function buildIssueSignature(issue: Issue) {
  return [
    issue.source,
    issue.type,
    issue.location.blockId,
    issue.location.startOffset ?? "na",
    issue.location.endOffset ?? "na",
    issue.wrong.toLocaleLowerCase("vi-VN"),
    issue.suggestion.toLocaleLowerCase("vi-VN"),
  ].join("::");
}

function createInitialSummary(): AnalysisTraceSummary {
  return {
    detectedByDetector: 0,
    afterDedup: 0,
    afterSelection: 0,
    annotatedInDocx: 0,
    returnedToUi: 0,
    rangeNotFound: 0,
    droppedByBudget: 0,
    duplicatesRemoved: 0,
    resolvedExact: 0,
    resolvedFuzzy: 0,
    resolvedAmbiguous: 0,
    resolvedNotFound: 0,
    commentCreated: 0,
    highlightApplied: 0,
    trackedChangeCreated: 0,
    skippedAnnotation: 0,
    confirmedErrorCount: 0,
    needsReviewCount: 0,
    detectorBySource: {
      rule_engine: 0,
      llm: 0,
      hybrid: 0,
    },
  };
}

export class AnalysisTraceCollector {
  private readonly summary = createInitialSummary();
  private readonly traceByIssue = new WeakMap<Issue, string>();
  private readonly issues = new Map<string, AnalysisTraceIssueRecord>();
  private readonly signatureCounts = new Map<string, number>();
  private readonly request: AnalysisTraceArtifact["request"];
  private inputBlocks = { blocks: 0, uniqueTemplates: 0, representativeChunks: 0 };
  private detectorOutput: AnalysisTraceArtifact["stages"]["detectorOutput"] = {
    ruleIssues: 0,
    dictionarySuspicionIssues: 0,
    llmIssues: 0,
    mergedIssues: 0,
    bySource: { rule_engine: 0, llm: 0, hybrid: 0 },
    needsReviewCount: 0,
    confirmedErrorCount: 0,
  };
  private postPipeline = {
    beforeDedup: 0,
    afterDedup: 0,
    afterSelection: 0,
    duplicatesRemoved: 0,
    droppedByBudget: 0,
  };
  private rangeResolution = { exact: 0, fuzzy: 0, ambiguous: 0, notFound: 0 };
  private annotation = {
    commentCreated: 0,
    highlightApplied: 0,
    trackedChangeCreated: 0,
    annotatedInDocx: 0,
    skippedAnnotation: 0,
  };
  private responsePayload = { returnedToUi: 0 };

  constructor(documentId: string, request: AnalyzeConsistencyRequest) {
    this.documentId = documentId;
    this.request = {
      checks: [...request.checks],
      mode: request.mode,
      useLLM: request.useLLM,
      useRuleEngine: request.useRuleEngine,
      maxIssues: request.maxIssues,
      maxAnnotatedIssues: request.maxAnnotatedIssues ?? request.maxIssues,
      maxReturnedIssues: request.maxReturnedIssues ?? Number.MAX_SAFE_INTEGER,
      debugTrace: Boolean(request.debugTrace),
      useCache: request.useCache ?? true,
      forceReanalyze: request.forceReanalyze ?? false,
      annotateFromCache: request.annotateFromCache ?? true,
    };
  }

  readonly documentId: string;
  readonly createdAt = nowIso();

  private ensureIssue(issue: Issue) {
    const existing = this.traceByIssue.get(issue);
    if (existing) return existing;

    const signature = buildIssueSignature(issue);
    const count = (this.signatureCounts.get(signature) ?? 0) + 1;
    this.signatureCounts.set(signature, count);
    const traceId = `trace_${String(this.signatureCounts.size).padStart(4, "0")}_${count}`;

    this.traceByIssue.set(issue, traceId);
    this.issues.set(traceId, {
      traceId,
      wrong: issue.wrong,
      suggestion: issue.suggestion,
      type: issue.type,
      source: issue.source,
      confidence: issue.confidence,
      status: issue.status,
      blockId: issue.location.blockId,
      path: issue.location.path,
      events: [],
    });

    return traceId;
  }

  private pushEvent(issue: Issue, stage: AnalysisTraceIssueRecord["events"][number]["stage"], decision: string, detail?: string) {
    const traceId = this.ensureIssue(issue);
    const record = this.issues.get(traceId);
    if (!record) return traceId;

    record.events.push({
      stage,
      decision,
      detail,
      createdAt: nowIso(),
    });

    record.status = issue.status;
    record.path = issue.location.path;
    record.blockId = issue.location.blockId;
    return traceId;
  }

  private getRecord(issue: Issue) {
    const traceId = this.ensureIssue(issue);
    return this.issues.get(traceId);
  }

  linkIssue(sourceIssue: Issue, targetIssue: Issue) {
    const traceId = this.ensureIssue(sourceIssue);
    this.traceByIssue.set(targetIssue, traceId);
  }

  setInputBlocks(blocks: DocumentBlock[], uniqueTemplates: number, representativeChunks: number) {
    this.inputBlocks = {
      blocks: blocks.length,
      uniqueTemplates,
      representativeChunks,
    };
  }

  setDetectorMetrics(metrics: DetectorMetrics) {
    this.detectorOutput = {
      ...metrics,
      bySource: { ...metrics.bySource },
    };
    this.summary.detectedByDetector = metrics.mergedIssues;
    this.summary.confirmedErrorCount = metrics.confirmedErrorCount;
    this.summary.needsReviewCount = metrics.needsReviewCount;
    this.summary.detectorBySource = { ...metrics.bySource };
  }

  registerDetectorIssues(issues: Issue[], decision: string) {
    for (const issue of issues) {
      this.pushEvent(issue, "detector_output", decision);
    }
  }

  recordPostPipeline(detectorIssues: Issue[], allIssues: Issue[], selectedIssues: Issue[]) {
    this.postPipeline.beforeDedup = detectorIssues.length;
    this.postPipeline.afterDedup = allIssues.length;
    this.postPipeline.afterSelection = selectedIssues.length;
    this.postPipeline.duplicatesRemoved = detectorIssues.length - allIssues.length;
    this.postPipeline.droppedByBudget = allIssues.length - selectedIssues.length;

    this.summary.afterDedup = allIssues.length;
    this.summary.afterSelection = selectedIssues.length;
    this.summary.duplicatesRemoved = this.postPipeline.duplicatesRemoved;
    this.summary.droppedByBudget = this.postPipeline.droppedByBudget;

    const selectedSet = new Set(selectedIssues);
    const seen = new Set<string>();

    for (const issue of detectorIssues) {
      const signature = buildIssueSignature(issue);
      if (seen.has(signature)) {
        const record = this.getRecord(issue);
        if (record) {
          record.dropped = true;
          record.dropReason = "deduped_as_duplicate";
        }
        this.pushEvent(issue, "post_pipeline", "deduped_as_duplicate");
        continue;
      }

      seen.add(signature);
      this.pushEvent(issue, "post_pipeline", "kept_after_dedup");
    }

    for (const issue of allIssues) {
      if (selectedSet.has(issue)) {
        this.pushEvent(issue, "post_pipeline", "selected_for_annotation");
      } else {
        const record = this.getRecord(issue);
        if (record) {
          record.dropped = true;
          record.dropReason = "trimmed_by_max_issues";
        }
        this.pushEvent(issue, "post_pipeline", "trimmed_by_max_issues");
      }
    }
  }

  recordRangeResolution(issue: Issue, resolved: ResolvedRange) {
    const decision =
      resolved.confidence === "not_found" ? "range_not_found" : `range_${resolved.confidence}`;
    this.pushEvent(issue, "range_resolution", decision);

    const record = this.getRecord(issue);
    if (record) {
      record.resolution = resolved.confidence;
      record.path = resolved.path || record.path;
    }

    if (resolved.confidence === "exact") {
      this.rangeResolution.exact += 1;
      this.summary.resolvedExact += 1;
    } else if (resolved.confidence === "fuzzy") {
      this.rangeResolution.fuzzy += 1;
      this.summary.resolvedFuzzy += 1;
    } else if (resolved.confidence === "ambiguous") {
      this.rangeResolution.ambiguous += 1;
      this.summary.resolvedAmbiguous += 1;
    } else {
      this.rangeResolution.notFound += 1;
      this.summary.resolvedNotFound += 1;
      this.summary.rangeNotFound += 1;
    }
  }

  recordAnnotation(issue: Issue, result: AnnotationResult) {
    const record = this.getRecord(issue);
    if (!record) return;

    const commentCreated = Boolean(result.commentCreated);
    const highlightApplied = Boolean(result.highlightApplied);
    const trackedChangeCreated = Boolean(result.trackedChangeCreated);
    const annotated = commentCreated || highlightApplied || trackedChangeCreated;

    record.annotated = {
      commentCreated,
      highlightApplied,
      trackedChangeCreated,
    };

    if (annotated) {
      this.annotation.annotatedInDocx += 1;
      this.summary.annotatedInDocx += 1;
    } else {
      this.annotation.skippedAnnotation += 1;
      this.summary.skippedAnnotation += 1;
      record.dropped = true;
      record.dropReason = "annotation_skipped";
    }

    if (commentCreated) {
      this.annotation.commentCreated += 1;
      this.summary.commentCreated += 1;
    }
    if (highlightApplied) {
      this.annotation.highlightApplied += 1;
      this.summary.highlightApplied += 1;
    }
    if (trackedChangeCreated) {
      this.annotation.trackedChangeCreated += 1;
      this.summary.trackedChangeCreated += 1;
    }

    if (result.skipped) {
      this.pushEvent(issue, "annotation", "annotation_skipped", result.detail);
    } else if (trackedChangeCreated) {
      this.pushEvent(issue, "annotation", "tracked_change_created", result.detail);
    } else if (commentCreated && highlightApplied) {
      this.pushEvent(issue, "annotation", "annotated_comment_and_highlight", result.detail);
    } else if (commentCreated) {
      this.pushEvent(issue, "annotation", issue.status === "needs_review" ? "needs_review_comment_only" : "comment_created", result.detail);
    } else if (highlightApplied) {
      this.pushEvent(issue, "annotation", "highlight_applied", result.detail);
    } else {
      this.pushEvent(issue, "annotation", "annotation_attempted_no_effect", result.detail);
    }
  }

  recordResponseIssues(issues: Issue[]) {
    this.responsePayload.returnedToUi = issues.length;
    this.summary.returnedToUi = issues.length;

    for (const issue of issues) {
      const record = this.getRecord(issue);
      if (!record) continue;
      record.issueId = issue.id;
      record.returnedToUi = true;
      this.pushEvent(issue, "response_payload", "returned_to_ui");
    }
  }

  recordCache(info: {
    cacheHit: boolean;
    cacheKey?: string;
    cachedAt?: string;
    forceReanalyze?: boolean;
    skippedAnalysisBecauseCacheHit?: boolean;
  }) {
    this.summary.cacheHit = info.cacheHit;
    this.summary.cacheKey = info.cacheKey;
    this.summary.cachedAt = info.cachedAt;
    this.summary.forceReanalyze = info.forceReanalyze;
    for (const issue of this.issues.values()) {
      issue.events.push({
        stage: "post_pipeline",
        decision: info.cacheHit ? "cache_hit" : "cache_miss",
        detail: info.cacheKey,
        createdAt: nowIso(),
      });
    }
    return info;
  }

  buildArtifact(): AnalysisTraceArtifact {
    return {
      documentId: this.documentId,
      createdAt: this.createdAt,
      request: this.request,
      cache: {
        cacheHit: Boolean(this.summary.cacheHit),
        cacheKey: this.summary.cacheKey,
        cachedAt: this.summary.cachedAt,
        forceReanalyze: this.summary.forceReanalyze,
        skippedAnalysisBecauseCacheHit: Boolean(this.summary.cacheHit),
      },
      summary: {
        ...this.summary,
        detectorBySource: { ...this.summary.detectorBySource },
      },
      stages: {
        inputBlocks: { ...this.inputBlocks },
        detectorOutput: {
          ...this.detectorOutput,
          bySource: { ...this.detectorOutput.bySource },
        },
        postPipeline: { ...this.postPipeline },
        rangeResolution: { ...this.rangeResolution },
        annotation: { ...this.annotation },
        responsePayload: { ...this.responsePayload },
      },
      issues: [...this.issues.values()],
    };
  }
}
