import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentBlock } from "../../domain/types.js";
import { resolveIssueRange } from "./rangeResolver.js";

const block: DocumentBlock = {
  blockId: "p_001",
  type: "paragraph",
  path: "body.paragraph[1]",
  text: "Chung toi luon ho tro khach hang trong qua trinh xu ly du lieu.",
  runs: [
    {
      runId: "run_000",
      text: "Chung toi luon ho tro khach hang trong qua trinh xu ly du lieu.",
      startOffset: 0,
      endOffset: 62,
      italic: false,
      underline: false,
    },
  ],
};

test("resolveIssueRange returns exact offsets for a single match", () => {
  const result = resolveIssueRange({
    block,
    wrong: "khach hang",
    beforeContext: "luon ho tro ",
    afterContext: " trong qua",
  });

  assert.equal(result.confidence, "exact");
  assert.equal(result.startOffset, 22);
  assert.equal(result.endOffset, 32);
  assert.deepEqual(result.target, {
    kind: "selection",
    start: { kind: "text", blockId: "p_001", offset: 22 },
    end: { kind: "text", blockId: "p_001", offset: 32 },
  });
});

test("resolveIssueRange marks ambiguous when multiple matches have no useful context", () => {
  const repeatedBlock: DocumentBlock = {
    blockId: "p_002",
    type: "paragraph",
    path: "body.paragraph[2]",
    text: "khach hang can gap khach hang ngay hom nay",
    runs: [
      {
        runId: "run_000",
        text: "khach hang can gap khach hang ngay hom nay",
        startOffset: 0,
        endOffset: 42,
        italic: false,
        underline: false,
      },
    ],
  };

  const result = resolveIssueRange({
    block: repeatedBlock,
    wrong: "khach hang",
  });

  assert.equal(result.confidence, "ambiguous");
  assert.equal(result.startOffset, undefined);
  assert.equal(result.target, undefined);
});

test("resolveIssueRange uses surrounding context to disambiguate repeated matches", () => {
  const repeatedBlock: DocumentBlock = {
    blockId: "p_003",
    type: "paragraph",
    path: "body.paragraph[3]",
    text: "khach hang can gap khach hang ngay hom nay",
    runs: [
      {
        runId: "run_000",
        text: "khach hang can gap khach hang ngay hom nay",
        startOffset: 0,
        endOffset: 42,
        italic: false,
        underline: false,
      },
    ],
  };

  const result = resolveIssueRange({
    block: repeatedBlock,
    wrong: "khach hang",
    beforeContext: "gap ",
    afterContext: " ngay",
  });

  assert.equal(result.confidence, "fuzzy");
  assert.equal(result.startOffset, 19);
  assert.equal(result.endOffset, 29);
});

test("resolveIssueRange returns not_found when the text does not exist in block", () => {
  const result = resolveIssueRange({
    block,
    wrong: "khong ton tai",
  });

  assert.equal(result.confidence, "not_found");
  assert.equal(result.startOffset, undefined);
  assert.equal(result.target, undefined);
});
