import test from "node:test";
import assert from "node:assert/strict";
import { buildAppliedIssueLocation } from "./issueLocation.js";

test("buildAppliedIssueLocation updates the selection to the applied replacement text", () => {
  const next = buildAppliedIssueLocation(
    {
      blockId: "00000004",
      blockType: "paragraph",
      path: "body.paragraph[3]",
      startOffset: 102,
      endOffset: 108,
      searchText: "hổ trợ",
      target: {
        kind: "selection",
        start: { kind: "text", blockId: "00000004", offset: 102 },
        end: { kind: "text", blockId: "00000004", offset: 108 },
      },
    },
    "hỗ trợ"
  );

  assert.equal(next.searchText, "hỗ trợ");
  assert.equal(next.startOffset, 102);
  assert.equal(next.endOffset, 108);
  assert.deepEqual(next.target, {
    kind: "selection",
    start: { kind: "text", blockId: "00000004", offset: 102 },
    end: { kind: "text", blockId: "00000004", offset: 108 },
  });
});

test("buildAppliedIssueLocation recalculates the end offset when replacement length changes", () => {
  const next = buildAppliedIssueLocation(
    {
      blockId: "00000005",
      blockType: "paragraph",
      path: "body.paragraph[4]",
      startOffset: 32,
      endOffset: 42,
      searchText: "nhân viêng",
      target: {
        kind: "selection",
        start: { kind: "text", blockId: "00000005", offset: 32 },
        end: { kind: "text", blockId: "00000005", offset: 42 },
      },
    },
    "nhân viên chuẩn"
  );

  assert.equal(next.searchText, "nhân viên chuẩn");
  assert.equal(next.startOffset, 32);
  assert.equal(next.endOffset, 47);
  assert.deepEqual(next.target, {
    kind: "selection",
    start: { kind: "text", blockId: "00000005", offset: 32 },
    end: { kind: "text", blockId: "00000005", offset: 47 },
  });
});
