import test from "node:test";
import assert from "node:assert/strict";

import { pickBestIssueMatch } from "./issue-navigation";
import type { SpellingIssue } from "../types";

test("prefers excerpt-based match over plain wrong-text match", () => {
  const issue: SpellingIssue = {
    id: "issue_001",
    wrong: "chính tả",
    suggestion: "chỉnh tả",
    reason: "lỗi chính tả",
    confidence: "high",
    status: "pending",
    excerpt: "Công cụ này hỗ trợ kiểm tra chính tả cho DOCX.",
  };

  const result = pickBestIssueMatch(
    issue,
    [
      {
        source: "wrong",
        snippet: "Một đoạn khác cũng có chữ chính tả ở đây.",
        target: { kind: "text", blockId: "block-wrong", range: { start: 22, end: 30 } },
      },
      {
        source: "excerpt",
        snippet: "Công cụ này hỗ trợ kiểm tra chính tả cho DOCX.",
        target: { kind: "text", blockId: "block-excerpt", range: { start: 27, end: 35 } },
      },
    ]
  );

  assert.equal(result?.target && "blockId" in result.target ? result.target.blockId : null, "block-excerpt");
});

test("uses block label as a tie-breaker when multiple excerpt matches exist", () => {
  const issue: SpellingIssue = {
    id: "issue_002",
    wrong: "nhân viêng",
    suggestion: "nhân viên",
    reason: "lỗi chính tả",
    confidence: "high",
    status: "pending",
    blockLabel: "2. Danh sách yêu cầu kiểm thử",
    excerpt: "nhân viêng nhập dữ liệu đơn hàng",
  };

  const result = pickBestIssueMatch(
    issue,
    [
      {
        source: "excerpt",
        snippet: "1. Giới thiệu\nnhân viêng nhập dữ liệu đơn hàng",
        target: { kind: "text", blockId: "block-a", range: { start: 0, end: 10 } },
      },
      {
        source: "excerpt",
        snippet: "2. Danh sách yêu cầu kiểm thử\nnhân viêng nhập dữ liệu đơn hàng",
        target: { kind: "text", blockId: "block-b", range: { start: 0, end: 10 } },
      },
    ]
  );

  assert.equal(result?.target && "blockId" in result.target ? result.target.blockId : null, "block-b");
});

test("returns null when there is no valid target", () => {
  const issue: SpellingIssue = {
    id: "issue_003",
    wrong: "khách hang",
    suggestion: "khách hàng",
    reason: "lỗi sai dấu",
    confidence: "medium",
    status: "pending",
  };

  const result = pickBestIssueMatch(
    issue,
    []
  );

  assert.equal(result, null);
});
