import test from "node:test";
import assert from "node:assert/strict";
import type { Issue } from "../../domain/types.js";
import { selectIssuesForReview } from "./consistencyPipeline.js";

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
