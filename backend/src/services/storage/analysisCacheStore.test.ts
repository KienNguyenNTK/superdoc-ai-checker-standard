import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { AnalysisCacheMetadata, Issue } from "../../domain/types.js";
import { FileAnalysisCacheStore } from "./analysisCacheStore.js";

function createIssue(index: number): Issue {
  return {
    id: `issue_${index + 1}`,
    documentId: "doc_source",
    type: "accent",
    wrong: `wrong_${index + 1}`,
    suggestion: `right_${index + 1}`,
    reason: "Cached issue",
    confidence: "high",
    severity: "error",
    source: "rule_engine",
    status: "pending",
    location: {
      blockId: `block_${index + 1}`,
      blockType: "paragraph",
      path: `body.paragraph[${index + 1}]`,
      searchText: `wrong_${index + 1}`,
    },
  };
}

test("FileAnalysisCacheStore saves and loads full cached issue lists", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-analysis-cache-"));

  try {
    const store = new FileAnalysisCacheStore(root);
    const metadata: AnalysisCacheMetadata = {
      cacheKey: "cache_full_issues",
      fileHash: "file_hash",
      originalFileName: "large.docx",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalIssues: 3520,
      checks: ["spelling"],
      mode: "comment_and_highlight",
      useLLM: false,
      useRuleEngine: true,
      checkConfigHash: "config_hash",
      dictionaryHash: "dictionary_hash",
      promptHash: "prompt_hash",
      analysisEngineVersion: "v1",
      sourceDocumentId: "doc_source",
    };

    await store.put({
      metadata,
      issues: Array.from({ length: 3520 }, (_, index) => createIssue(index)),
    });

    const loaded = await store.get(metadata.cacheKey);
    assert.equal(await store.has(metadata.cacheKey), true);
    assert.equal(loaded?.metadata.totalIssues, 3520);
    assert.equal(loaded?.issues.length, 3520);
    assert.equal(loaded?.issues[3519]?.id, "issue_3520");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FileAnalysisCacheStore saves chunk metadata and chunk results independently", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-analysis-chunk-cache-"));

  try {
    const store = new FileAnalysisCacheStore(root);
    const metadata = {
      documentId: "doc_chunked",
      fileHash: "file_hash_chunked",
      fileName: "large.docx",
      totalPages: 40,
      pageSize: 20,
      totalChunks: 2,
      completedChunks: 1,
      status: "partial" as const,
      totalIssues: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cacheKey: "chunk_cache_key",
      chunks: [
        { chunkIndex: 0, startPage: 1, endPage: 20, status: "completed" as const, issueCount: 1 },
        { chunkIndex: 1, startPage: 21, endPage: 40, status: "pending" as const, issueCount: 0 },
      ],
    };
    const chunk = {
      documentId: "doc_chunked",
      fileHash: "file_hash_chunked",
      fileName: "large.docx",
      chunkIndex: 0,
      startPage: 1,
      endPage: 20,
      analyzedAt: new Date().toISOString(),
      status: "completed" as const,
      issues: [createIssue(0)],
    };

    await store.saveChunkMetadata(metadata);
    await store.saveChunk(metadata.cacheKey, chunk);

    const loadedMetadata = await store.findChunkMetadataByFileHash(metadata.fileHash);
    const loadedChunk = await store.getChunk(metadata.cacheKey, 0);
    const allChunks = await store.getAllChunks(metadata.cacheKey);

    assert.equal(loadedMetadata?.cacheKey, metadata.cacheKey);
    assert.equal(loadedMetadata?.completedChunks, 1);
    assert.equal(loadedChunk?.issues.length, 1);
    assert.equal(allChunks.length, 1);
    assert.equal(allChunks[0]?.chunkIndex, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
