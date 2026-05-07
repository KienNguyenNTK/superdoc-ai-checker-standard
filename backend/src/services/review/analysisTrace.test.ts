import test from "node:test";
import assert from "node:assert/strict";
import type { AnalyzeConsistencyRequest, Issue, ResolvedRange } from "../../domain/types.js";
import { AnalysisTraceCollector } from "./analysisTrace.js";

function createIssue(blockId: string, wrong: string, startOffset: number): Issue {
  return {
    id: `issue-${blockId}-${startOffset}`,
    documentId: "doc_trace",
    type: "accent",
    wrong,
    suggestion: `${wrong}-fixed`,
    reason: "Test issue",
    confidence: "high",
    severity: "error",
    source: "rule_engine",
    status: "pending",
    location: {
      blockId,
      blockType: "paragraph",
      path: `body.paragraph[${blockId}]`,
      startOffset,
      endOffset: startOffset + wrong.length,
      searchText: wrong,
    },
  };
}

const request: AnalyzeConsistencyRequest = {
  checks: ["spelling"],
  mode: "comment_and_highlight",
  useLLM: false,
  useRuleEngine: true,
  maxIssues: 2,
  debugTrace: true,
};

test("AnalysisTraceCollector marks duplicates and budget drops with explicit reasons", () => {
  const collector = new AnalysisTraceCollector("doc_trace", request);
  const issueA = createIssue("block-1", "hệ thông", 0);
  const issueADuplicate = createIssue("block-1", "hệ thông", 0);
  const issueB = createIssue("block-2", "khách hang", 4);
  const issueC = createIssue("block-3", "dử liệu", 8);

  collector.setInputBlocks([], 0, 0);
  collector.setDetectorMetrics({
    ruleIssues: 4,
    dictionarySuspicionIssues: 0,
    llmIssues: 0,
    mergedIssues: 4,
    bySource: { rule_engine: 4, llm: 0, hybrid: 0 },
    needsReviewCount: 0,
    confirmedErrorCount: 4,
  });
  collector.registerDetectorIssues([issueA, issueADuplicate, issueB, issueC], "rule_engine_output");
  collector.recordPostPipeline(
    [issueA, issueADuplicate, issueB, issueC],
    [issueA, issueB, issueC],
    [issueA, issueB]
  );

  const artifact = collector.buildArtifact();
  const duplicateRecord = artifact.issues.find((issue) => issue.wrong === "hệ thông" && issue.dropReason === "deduped_as_duplicate");
  const budgetRecord = artifact.issues.find((issue) => issue.wrong === "dử liệu");

  assert.ok(duplicateRecord);
  assert.equal(budgetRecord?.dropReason, "trimmed_by_max_issues");
  assert.equal(artifact.summary.duplicatesRemoved, 1);
  assert.equal(artifact.summary.droppedByBudget, 1);
});

test("AnalysisTraceCollector records range and annotation events for a surviving issue", () => {
  const collector = new AnalysisTraceCollector("doc_trace", request);
  const issue = createIssue("block-1", "hệ thông", 0);
  const resolved: ResolvedRange = {
    blockId: "block-1",
    path: "body.paragraph[1]",
    startOffset: 0,
    endOffset: 8,
    confidence: "exact",
  };

  collector.setDetectorMetrics({
    ruleIssues: 1,
    dictionarySuspicionIssues: 0,
    llmIssues: 0,
    mergedIssues: 1,
    bySource: { rule_engine: 1, llm: 0, hybrid: 0 },
    needsReviewCount: 0,
    confirmedErrorCount: 1,
  });
  collector.registerDetectorIssues([issue], "rule_engine_output");
  collector.recordPostPipeline([issue], [issue], [issue]);
  collector.recordRangeResolution(issue, resolved);
  collector.recordAnnotation(issue, { commentCreated: true, highlightApplied: true });
  collector.recordResponseIssues([issue]);

  const artifact = collector.buildArtifact();
  const record = artifact.issues[0];

  assert.equal(record?.events.some((event) => event.stage === "range_resolution"), true);
  assert.equal(record?.events.some((event) => event.decision === "annotated_comment_and_highlight"), true);
  assert.equal(artifact.summary.returnedToUi, 1);
});
