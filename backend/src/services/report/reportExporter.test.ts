import test from "node:test";
import assert from "node:assert/strict";
import { exportIssuesCsv } from "./reportExporter.js";
import type { Issue } from "../../domain/types.js";

test("exportIssuesCsv renders a flat CSV report with escaped content", () => {
  const issues: Issue[] = [
    {
      id: "issue_001",
      documentId: "doc_001",
      wrong: "khach hang",
      suggestion: "khách hàng",
      reason: 'Thieu dau "a"',
      type: "accent",
      confidence: "high",
      severity: "error",
      source: "rule_engine",
      status: "pending",
      location: {
        blockId: "0001",
        blockType: "paragraph",
        path: "body.paragraph[0]",
        startOffset: 4,
        endOffset: 14,
        searchText: "khach hang",
      },
    },
  ];

  const csv = exportIssuesCsv(issues);

  assert.match(csv, /issueId,documentId,type,wrong,suggestion/);
  assert.match(csv, /issue_001,doc_001,accent,khach hang,khách hàng/);
  assert.match(csv, /"Thieu dau ""a"""/);
});
