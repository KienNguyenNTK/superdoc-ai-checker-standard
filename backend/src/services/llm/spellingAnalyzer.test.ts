import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentBlock } from "../../domain/types.js";
import {
  applySuggestionCasing,
  analyzeDictionarySuspicionIssues,
  analyzeWithHeuristics,
  buildBlockTemplateGroups,
  chunkBlocks,
  expandTemplateIssues,
  mergeIssues,
} from "./spellingAnalyzer.js";
import type { LlmIssue } from "./issueSchemas.js";

function createBlock(text: string, blockId = "block-1"): DocumentBlock {
  return {
    blockId,
    type: "paragraph",
    path: `body.paragraph[${blockId}]`,
    text,
    runs: [
      {
        runId: "run_000",
        text,
        startOffset: 0,
        endOffset: text.length,
        italic: false,
        underline: false,
      },
    ],
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
  assert.ok(pairs.includes("Kiễm tra->Kiểm tra"));
});

test("analyzeWithHeuristics catches intentional mistakes that previously slipped through", () => {
  const blocks = [
    createBlock("Hệ thông phải giử đúng ngử cảnh và đưa ra gơi ý rõ rang."),
    createBlock("Công cụ chỉ nên sữa lỗi khi có bằng chứng rõ ràng.", "block-2"),
  ];

  const issues = analyzeWithHeuristics(blocks);
  const pairs = issues.map((issue) => `${issue.wrong}->${issue.suggestion}`);

  assert.ok(pairs.includes("Hệ thông->Hệ thống"));
  assert.ok(pairs.includes("giử->giữ"));
  assert.ok(pairs.includes("ngử cảnh->ngữ cảnh"));
  assert.ok(pairs.includes("gơi ý->gợi ý"));
  assert.ok(pairs.includes("rõ rang->rõ ràng"));
  assert.ok(pairs.includes("sữa->sửa"));
});

test("analyzeWithHeuristics preserves custom dictionary terms", () => {
  const blocks = [createBlock("SuperDoc và 8AM Coffee được giữ nguyên trong tài liệu.")];

  const issues = analyzeWithHeuristics(blocks);

  assert.equal(issues.length, 0);
});

test("analyzeDictionarySuspicionIssues flags unknown tokens as needs_review", async () => {
  const blocks = [createBlock("Từ giử này cần được kiểm tra lại.")];

  const issues = await analyzeDictionarySuspicionIssues(blocks);

  assert.ok(issues.some((issue) => issue.wrong === "giử" && issue.status === "needs_review"));
});

test("analyzeDictionarySuspicionIssues preserves technical tokens and custom dictionary entries", async () => {
  const blocks = [createBlock("OpenAI, TypeScript, Node.js, SuperDoc và DOCX phải được giữ nguyên.")];

  const issues = await analyzeDictionarySuspicionIssues(blocks);

  assert.equal(issues.length, 0);
});

test("analyzeDictionarySuspicionIssues skips ascii product words and valid multi-word phrases", async () => {
  const blocks = [createBlock("Frontend cần hiển thị trạng thái rõ ràng trong sidebar.")];

  const issues = await analyzeDictionarySuspicionIssues(blocks);

  assert.equal(issues.some((issue) => issue.wrong === "Frontend"), false);
  assert.equal(issues.some((issue) => issue.wrong === "hiển"), false);
});

test("applySuggestionCasing preserves uppercase pattern from the original text", () => {
  assert.equal(applySuggestionCasing("khách hang", "khách hàng"), "khách hàng");
  assert.equal(applySuggestionCasing("Khách hang", "khách hàng"), "Khách hàng");
  assert.equal(applySuggestionCasing("Nhân viêng", "nhân viên"), "Nhân viên");
  assert.equal(applySuggestionCasing("KIỄM TRA", "kiểm tra"), "KIỂM TRA");
});

test("analyzeWithHeuristics keeps the original capitalization in suggestions", () => {
  const blocks = [createBlock("Khách hang và Nhân viêng cần được sửa ngay.")];

  const issues = analyzeWithHeuristics(blocks);
  const pairs = issues.map((issue) => `${issue.wrong}->${issue.suggestion}`);

  assert.ok(pairs.includes("Khách hang->Khách hàng"));
  assert.ok(pairs.includes("Nhân viêng->Nhân viên"));
});

test("mergeIssues keeps LLM issues first and only adds missing heuristic issues", () => {
  const llmIssue: LlmIssue = {
    blockId: "block-1",
    wrong: "khách hang",
    suggestion: "khách hàng",
    reason: "Thiếu dấu",
    type: "accent",
    confidence: "high",
    severity: "error",
    source: "llm",
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
      severity: "error",
      source: "rule_engine",
      shouldAutoApply: true,
    },
    {
      blockId: "block-1",
      wrong: "hổ trợ",
      suggestion: "hỗ trợ",
      reason: "Heuristic",
      type: "accent",
      confidence: "high",
      severity: "error",
      source: "rule_engine",
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

test("buildBlockTemplateGroups collapses repeated block text into a single representative", () => {
  const blocks = [
    createBlock("Lỗi lặp lại nhiều lần.", "block-1"),
    createBlock("Lỗi lặp lại nhiều lần.", "block-2"),
    createBlock("Đoạn khác.", "block-3"),
  ];

  const groups = buildBlockTemplateGroups(blocks);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.representative.blockId, "block-1");
  assert.equal(groups[0]?.blocks.length, 2);
});

test("expandTemplateIssues projects representative issues back to every repeated block", () => {
  const blocks = [
    createBlock("khách hang", "block-1"),
    createBlock("khách hang", "block-2"),
  ];
  const groups = buildBlockTemplateGroups(blocks);
  const templateIssues: LlmIssue[] = [
    {
      blockId: "block-1",
      wrong: "khách hang",
      suggestion: "khách hàng",
      reason: "Thiếu dấu",
      type: "accent",
      confidence: "high",
      severity: "error",
      source: "rule_engine",
      startOffset: 0,
      endOffset: 10,
      shouldAutoApply: true,
    },
  ];

  const expanded = expandTemplateIssues(templateIssues, groups);

  assert.deepEqual(
    expanded.map((issue) => issue.blockId),
    ["block-1", "block-2"]
  );
});
