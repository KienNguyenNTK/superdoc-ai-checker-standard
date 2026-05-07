import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRunsFromNode,
  normaliseExtractedBlocks,
  type SuperDocNode,
} from "./documentReader.js";

test("normaliseExtractedBlocks maps table context and paragraph blocks to domain blocks", () => {
  const blocks = normaliseExtractedBlocks([
    {
      nodeId: "0001",
      type: "paragraph",
      text: "Doan van thong thuong",
    },
    {
      nodeId: "0002",
      type: "paragraph",
      text: "Noi dung o o bang",
      tableContext: {
        tableOrdinal: 1,
        rowIndex: 0,
        columnIndex: 2,
      },
    },
  ]);

  assert.deepEqual(blocks, [
    {
      blockId: "0001",
      type: "paragraph",
      path: "body.paragraph[0]",
      text: "Doan van thong thuong",
      runs: [
        {
          runId: "run_000",
          text: "Doan van thong thuong",
          startOffset: 0,
          endOffset: 21,
          italic: false,
          underline: false,
        },
      ],
    },
    {
      blockId: "0002",
      type: "tableCell",
      path: "body.table[1].row[0].cell[2]",
      text: "Noi dung o o bang",
      runs: [
        {
          runId: "run_000",
          text: "Noi dung o o bang",
          startOffset: 0,
          endOffset: 17,
          italic: false,
          underline: false,
        },
      ],
      metadata: {
        tableIndex: 1,
        rowIndex: 0,
        cellIndex: 2,
      },
    },
  ]);
});

test("buildRunsFromNode derives run offsets and formatting from SuperDoc paragraph node", () => {
  const node: SuperDocNode = {
    kind: "paragraph",
    paragraph: {
      styleId: "Heading1",
      inlines: [
        {
          kind: "run",
          run: {
            text: "SuperDoc",
            props: {
              bold: true,
              italic: true,
              underline: "single",
              color: "#112233",
              highlight: "#ffee00",
              fontSize: 28,
              fontFamily: "Aptos",
            },
          },
        },
        {
          kind: "run",
          run: {
            text: " là nền tảng kiểm tra DOCX",
            props: {
              bold: false,
            },
          },
        },
      ],
    },
  };

  const runs = buildRunsFromNode(node);

  assert.deepEqual(runs, [
    {
      runId: "run_000",
      text: "SuperDoc",
      startOffset: 0,
      endOffset: 8,
      bold: true,
      italic: true,
      underline: true,
      color: "#112233",
      highlightColor: "#ffee00",
      fontSize: 28,
      fontFamily: "Aptos",
      styleName: "Heading1",
    },
    {
      runId: "run_001",
      text: " là nền tảng kiểm tra DOCX",
      startOffset: 8,
      endOffset: 34,
      bold: false,
      italic: false,
      underline: false,
      styleName: "Heading1",
    },
  ]);
});

test("buildRunsFromNode falls back to a synthetic run when paragraph contains plain text only", () => {
  const node: SuperDocNode = {
    kind: "paragraph",
    paragraph: {
      inlines: [],
      text: "Không có inline runs",
    },
  };

  const runs = buildRunsFromNode(node);

  assert.deepEqual(runs, [
    {
      runId: "run_000",
      text: "Không có inline runs",
      startOffset: 0,
      endOffset: 20,
      italic: false,
      underline: false,
    },
  ]);
});
