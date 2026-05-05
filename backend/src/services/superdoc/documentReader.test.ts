import test from "node:test";
import assert from "node:assert/strict";
import { normaliseExtractedBlocks } from "./documentReader.js";

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
      metadata: undefined,
    },
    {
      blockId: "0002",
      type: "tableCell",
      path: "body.table[1].row[0].cell[2]",
      text: "Noi dung o o bang",
      metadata: {
        tableIndex: 1,
        rowIndex: 0,
        cellIndex: 2,
      },
    },
  ]);
});
