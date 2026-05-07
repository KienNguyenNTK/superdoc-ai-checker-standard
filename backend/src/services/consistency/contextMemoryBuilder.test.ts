import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentBlock } from "../../domain/types.js";
import { buildContextMemory } from "./contextMemoryBuilder.js";

const blocks: DocumentBlock[] = [
  {
    blockId: "p_001",
    type: "heading",
    path: "body.heading[0]",
    text: "Giới thiệu SuperDoc",
    runs: [
      {
        runId: "run_000",
        text: "Giới thiệu ",
        startOffset: 0,
        endOffset: 11,
        italic: false,
        underline: false,
      },
      {
        runId: "run_001",
        text: "SuperDoc",
        startOffset: 11,
        endOffset: 19,
        bold: true,
        italic: false,
        underline: false,
      },
    ],
    metadata: {
      headingLevel: 1,
      styleName: "Heading1",
    },
  },
  {
    blockId: "p_002",
    type: "paragraph",
    path: "body.paragraph[1]",
    text: "SuperDoc là document engine phục vụ người dùng doanh nghiệp.",
    runs: [
      {
        runId: "run_000",
        text: "SuperDoc",
        startOffset: 0,
        endOffset: 8,
        bold: true,
        italic: false,
        underline: false,
      },
      {
        runId: "run_001",
        text: " là document engine phục vụ người dùng doanh nghiệp.",
        startOffset: 8,
        endOffset: 61,
        italic: false,
        underline: false,
      },
    ],
  },
  {
    blockId: "p_003",
    type: "paragraph",
    path: "body.paragraph[2]",
    text: "Ở chương sau, SuperDoc đôi lúc bị bỏ in đậm.",
    runs: [
      {
        runId: "run_000",
        text: "Ở chương sau, ",
        startOffset: 0,
        endOffset: 13,
        italic: false,
        underline: false,
      },
      {
        runId: "run_001",
        text: "SuperDoc",
        startOffset: 13,
        endOffset: 21,
        bold: false,
        italic: false,
        underline: false,
      },
      {
        runId: "run_002",
        text: " đôi lúc bị bỏ in đậm.",
        startOffset: 21,
        endOffset: 43,
        italic: false,
        underline: false,
      },
    ],
  },
];

test("buildContextMemory collects glossary candidates, entity rules, and term format rules", () => {
  const memory = buildContextMemory({
    documentId: "doc_123",
    blocks,
    globalGlossary: [{ term: "document engine", preferredTranslation: "bộ máy tài liệu" }],
    documentGlossary: [{ term: "người dùng", preferredTranslation: "user" }],
  });

  assert.equal(memory.documentId, "doc_123");
  assert.ok(memory.glossary.some((entry) => entry.term === "document engine"));
  assert.ok(memory.glossary.some((entry) => entry.term === "người dùng"));
  assert.ok(memory.entityRules.some((rule) => rule.canonicalName === "SuperDoc"));
  assert.ok(
    memory.formatRules.some(
      (rule) => rule.target === "SuperDoc" && rule.expectedFormat.bold === true
    )
  );
  assert.ok(
    memory.toneRules.some((rule) =>
      rule.examples.some((example) => example.includes("người dùng"))
    )
  );
});
