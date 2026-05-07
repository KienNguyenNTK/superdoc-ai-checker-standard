import test from "node:test";
import assert from "node:assert/strict";
import type { AnalyzeConsistencyRequest, DocumentContextMemory, Issue } from "../../domain/types.js";
import { runConsistencyPipelineDetailed, selectIssuesForReview } from "./consistencyPipeline.js";

function createIssue(blockId: string, index: number): Issue {
  return {
    id: `issue-${blockId}-${index}`,
    documentId: "doc_123",
    type: "accent",
    wrong: `wrong-${blockId}-${index}`,
    suggestion: `suggestion-${blockId}-${index}`,
    reason: "Test issue",
    confidence: "high",
    severity: "error",
    source: "rule_engine",
    status: "pending",
    location: {
      blockId,
      blockType: "paragraph",
      path: `body.paragraph[${blockId}]`,
      startOffset: index,
      endOffset: index + 1,
      searchText: `wrong-${blockId}-${index}`,
    },
  };
}

test("selectIssuesForReview spreads the review budget across blocks instead of consuming the first block only", () => {
  const issues = [
    createIssue("block-1", 0),
    createIssue("block-1", 1),
    createIssue("block-1", 2),
    createIssue("block-1", 3),
    createIssue("block-2", 0),
    createIssue("block-3", 0),
  ];

  const selected = selectIssuesForReview(issues, 4);

  assert.deepEqual(
    selected.map((issue) => issue.location.blockId),
    ["block-1", "block-2", "block-3", "block-1"]
  );
});

test("selectIssuesForReview preserves order when the budget already fits", () => {
  const issues = [createIssue("block-1", 0), createIssue("block-2", 0)];

  const selected = selectIssuesForReview(issues, 5);

  assert.deepEqual(selected.map((issue) => issue.id), issues.map((issue) => issue.id));
});

test("runConsistencyPipelineDetailed reports full detection summary even when selected issues are capped", async () => {
  const repeatedText =
    "Chúng tôi luôn hổ trợ khách hang trong quá trình xử lí dử liệu và cập nhập hệ thông.";
  const blocks = Array.from({ length: 3 }, (_, index) => ({
    blockId: `block-${index + 1}`,
    type: "paragraph" as const,
    path: `body.paragraph[${index + 1}]`,
    text: repeatedText,
    runs: [
      {
        runId: "run_000",
        text: repeatedText,
        startOffset: 0,
        endOffset: repeatedText.length,
        italic: false,
        underline: false,
      },
    ],
  }));
  const request: AnalyzeConsistencyRequest = {
    checks: ["spelling"],
    mode: "comment_only",
    useLLM: false,
    useRuleEngine: false,
    maxIssues: 5,
  };
  const contextMemory: DocumentContextMemory = {
    documentId: "doc_123",
    glossary: [],
    formatRules: [],
    toneRules: [],
    entityRules: [],
  };

  const result = await runConsistencyPipelineDetailed({
    documentId: "doc_123",
    blocks,
    contextMemory,
    request,
  });

  assert.equal(result.summary.detectedIssues, result.allIssues.length);
  assert.equal(result.summary.selectedIssues, 5);
  assert.equal(
    result.summary.confirmedErrorCount + result.summary.needsReviewCount,
    result.summary.detectedIssues
  );
  assert.equal(result.summary.blocksAnalyzed, 3);
  assert.equal(result.summary.blocksWithIssues, 3);
  assert.ok((result.summary.uniqueBlockTemplates ?? 0) < blocks.length);
  assert.equal(result.selectedIssues.length, 5);
});
