import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentBlock } from "../../domain/types.js";
import { buildContextMemory } from "../consistency/contextMemoryBuilder.js";
import { checkFormatRules } from "./formatRules.js";

function createHeadingBlock(input: {
  blockId: string;
  text: string;
  fontSize: number;
  bold?: boolean;
  color?: string;
  highlightColor?: string;
  page?: number;
  headingLevel?: number;
}) {
  const {
    blockId,
    text,
    fontSize,
    bold = true,
    color,
    highlightColor,
    page = 1,
    headingLevel = 1,
  } = input;

  const runs = [
    {
      runId: `${blockId}_run_0`,
      text,
      startOffset: 0,
      endOffset: text.length,
      bold,
      italic: false,
      underline: false,
      fontSize,
      ...(color ? { color } : {}),
      ...(highlightColor ? { highlightColor } : {}),
      styleName: "Heading1",
    },
  ];

  return {
    blockId,
    type: "heading" as const,
    text,
    path: `body.heading[${blockId}]`,
    page,
    runs,
    metadata: {
      headingLevel,
      styleName: "Heading1",
    },
  } satisfies DocumentBlock;
}

test("heading consistency does not compare document title with numbered section headings", () => {
  const blocks: DocumentBlock[] = [
    createHeadingBlock({
      blockId: "title",
      text: "TÀI LIỆU TEST KIỂM TRA CHÍNH TẢ DOCX",
      fontSize: 24,
      bold: true,
      page: 1,
    }),
    createHeadingBlock({
      blockId: "section_1",
      text: "1. Giới thiệu",
      fontSize: 14,
      bold: true,
      color: "#3058B2",
      highlightColor: "#F7D6E6",
      page: 1,
    }),
    createHeadingBlock({
      blockId: "section_2",
      text: "2. Danh sách yêu cầu kiểm thử",
      fontSize: 14,
      bold: true,
      color: "#3058B2",
      highlightColor: "#F7D6E6",
      page: 1,
    }),
    createHeadingBlock({
      blockId: "section_3",
      text: "3. Bảng dữ liệu mẫu",
      fontSize: 14,
      bold: true,
      color: "#3058B2",
      highlightColor: "#F7D6E6",
      page: 2,
    }),
  ];

  const memory = buildContextMemory({
    documentId: "doc_heading",
    blocks,
  });

  const issues = checkFormatRules("doc_heading", blocks, memory).filter(
    (issue) => issue.type === "heading_consistency"
  );

  assert.deepEqual(issues, []);
});

test("heading consistency reports only the section heading that deviates from the dominant section pattern", () => {
  const blocks: DocumentBlock[] = [
    createHeadingBlock({
      blockId: "title",
      text: "TÀI LIỆU TEST KIỂM TRA CHÍNH TẢ DOCX",
      fontSize: 24,
      bold: true,
      page: 1,
    }),
    createHeadingBlock({
      blockId: "section_1",
      text: "1. Giới thiệu",
      fontSize: 14,
      bold: true,
      color: "#3058B2",
      highlightColor: "#F7D6E6",
      page: 1,
    }),
    createHeadingBlock({
      blockId: "section_2",
      text: "2. Danh sách yêu cầu kiểm thử",
      fontSize: 14,
      bold: true,
      color: "#3058B2",
      highlightColor: "#F7D6E6",
      page: 1,
    }),
    createHeadingBlock({
      blockId: "section_3",
      text: "3. Bảng dữ liệu mẫu",
      fontSize: 14,
      bold: false,
      color: "#000000",
      page: 2,
    }),
  ];

  const memory = buildContextMemory({
    documentId: "doc_heading",
    blocks,
  });

  const issues = checkFormatRules("doc_heading", blocks, memory).filter(
    (issue) => issue.type === "heading_consistency"
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.location.blockId, "section_3");
  assert.match(issues[0]?.reason ?? "", /section_heading_level_1/i);
  assert.equal(issues[0]?.evidence?.length, 2);
});
