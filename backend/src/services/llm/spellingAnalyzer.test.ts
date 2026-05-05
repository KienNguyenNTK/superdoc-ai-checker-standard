import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentBlock } from "../../domain/types.js";
import {
  analyzeWithHeuristics,
  chunkBlocks,
  mergeIssues,
} from "./spellingAnalyzer.js";
import type { LlmIssue } from "./issueSchemas.js";

function createBlock(text: string, blockId = "block-1"): DocumentBlock {
  return {
    blockId,
    type: "paragraph",
    path: `body.paragraph[${blockId}]`,
    text,
  };
}

test("analyzeWithHeuristics detects common Vietnamese spelling issues from sample doc", () => {
  const blocks = [
    createBlock("Hệ thống này sẽ hổ trợ khách hang và xử lí dử liệu."),
    createBlock("Nhiều nhân viêng nhập sản phẫm sai chính tã và phản hổi chậm.", "block-2"),
  ];

  const issues = analyzeWithHeuristics(blocks);
  const pairs = issues.map((issue) => `${issue.wrong}->${issue.suggestion}`);

  assert.ok(pairs.includes("hổ trợ->hỗ trợ"));
  assert.ok(pairs.includes("khách hang->khách hàng"));
  assert.ok(pairs.includes("xử lí->xử lý"));
  assert.ok(pairs.includes("dử liệu->dữ liệu"));
  assert.ok(pairs.includes("nhân viêng->nhân viên"));
  assert.ok(pairs.includes("sản phẫm->sản phẩm"));
  assert.ok(pairs.includes("chính tã->chính tả"));
  assert.ok(pairs.includes("phản hổi->phản hồi"));
});

test("analyzeWithHeuristics detects additional issues from the long sample doc", () => {
  const blocks = [
    createBlock("Dự án được xây dựng để hổ trợ kiểm tra chính tã trong tài liêu DOCX dài."),
    createBlock("Khi bấm issue, hệ thông phải focus đúng vị trí và giữ trãi nghiệm tốt.", "block-2"),
    createBlock("Xuất reviewed.docx và kiểm tra comment/highlight còn hoạt đông.", "block-3"),
    createBlock("Kiễm tra upload DOCX và mở bằng SuperDoc.", "block-4"),
  ];

  const issues = analyzeWithHeuristics(blocks);
  const pairs = issues.map((issue) => `${issue.wrong}->${issue.suggestion}`);

  assert.ok(pairs.includes("tài liêu->tài liệu"));
  assert.ok(pairs.includes("hệ thông->hệ thống"));
  assert.ok(pairs.includes("trãi nghiệm->trải nghiệm"));
  assert.ok(pairs.includes("hoạt đông->hoạt động"));
  assert.ok(pairs.includes("Kiễm tra->kiểm tra"));
});

test("analyzeWithHeuristics preserves custom dictionary terms", () => {
  const blocks = [createBlock("SuperDoc và 8AM Coffee được giữ nguyên trong tài liệu.")];

  const issues = analyzeWithHeuristics(blocks);

  assert.equal(issues.length, 0);
});

test("mergeIssues keeps LLM issues first and only adds missing heuristic issues", () => {
  const llmIssue: LlmIssue = {
    blockId: "block-1",
    wrong: "khách hang",
    suggestion: "khách hàng",
    reason: "Thiếu dấu",
    type: "accent",
    confidence: "high",
    shouldAutoApply: true,
  };

  const heuristicIssues: LlmIssue[] = [
    {
      blockId: "block-1",
      wrong: "khách hang",
      suggestion: "khách hàng",
      reason: "Heuristic",
      type: "accent",
      confidence: "high",
      shouldAutoApply: true,
    },
    {
      blockId: "block-1",
      wrong: "hổ trợ",
      suggestion: "hỗ trợ",
      reason: "Heuristic",
      type: "accent",
      confidence: "high",
      shouldAutoApply: true,
    },
  ];

  const merged = mergeIssues([llmIssue], heuristicIssues);

  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.reason, "Thiếu dấu");
  assert.equal(
    merged.find((issue) => issue.wrong === "hổ trợ")?.suggestion,
    "hỗ trợ"
  );
});

test("chunkBlocks splits long documents into bounded batches", () => {
  const blocks = Array.from({ length: 30 }, (_, index) =>
    createBlock(`Đây là đoạn ${index} `.repeat(20), `block-${index}`)
  );

  const chunks = chunkBlocks(blocks, 10, 1200);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 10));
});
