import test from "node:test";
import assert from "node:assert/strict";
import { createPageChunks } from "./pageChunker.js";

test("createPageChunks creates one chunk for a document under the page size", () => {
  assert.deepEqual(createPageChunks(12, 20), [
    {
      chunkIndex: 0,
      startPage: 1,
      endPage: 12,
      status: "pending",
      issueCount: 0,
    },
  ]);
});

test("createPageChunks creates exact chunks for page-size multiples", () => {
  assert.deepEqual(createPageChunks(40, 20), [
    {
      chunkIndex: 0,
      startPage: 1,
      endPage: 20,
      status: "pending",
      issueCount: 0,
    },
    {
      chunkIndex: 1,
      startPage: 21,
      endPage: 40,
      status: "pending",
      issueCount: 0,
    },
  ]);
});

test("createPageChunks creates eleven chunks for a 220-page document", () => {
  const chunks = createPageChunks(220, 20);
  assert.equal(chunks.length, 11);
  assert.deepEqual(chunks[10], {
    chunkIndex: 10,
    startPage: 201,
    endPage: 220,
    status: "pending",
    issueCount: 0,
  });
});
