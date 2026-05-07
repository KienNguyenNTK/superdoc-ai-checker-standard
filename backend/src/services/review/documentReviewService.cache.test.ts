import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { Document, Packer, Paragraph, TextRun } from "docx";
import type { AnalysisCacheMetadata, AnalyzeConsistencyRequest, Issue } from "../../domain/types.js";
import { hashFileBuffer } from "../hash/fileHash.js";
import { FileAnalysisCacheStore } from "../storage/analysisCacheStore.js";
import { FileDocumentSessionStore } from "../storage/documentSessionStore.js";
import { DocumentReviewService } from "./documentReviewService.js";

function createCachedIssue(index: number, documentId = "doc_source"): Issue {
  const text = `cache_wrong_${index + 1}`;
  return {
    id: `issue_${index + 1}`,
    documentId,
    type: "spelling",
    wrong: text,
    suggestion: `cache_right_${index + 1}`,
    reason: "Cached issue for regression test",
    confidence: "high",
    severity: "error",
    source: "rule_engine",
    status: "pending",
    location: {
      blockId: `p_${index + 1}`,
      blockType: "paragraph",
      path: `body.paragraph[${index + 1}]`,
      searchText: text,
    },
  };
}

async function createDocxWithCachedIssueText(count: number) {
  const doc = new Document({
    sections: [
      {
        children: Array.from(
          { length: count },
          (_, index) => new Paragraph({ children: [new TextRun(`Đoạn có cache_wrong_${index + 1}.`)] })
        ),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

test("runConsistencyAnalysis reuses cached issues for a matching file/config and can force reanalyze", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-cache-hit-"));

  try {
    const documentId = "doc_cache_hit";
    const cacheRoot = path.join(root, "analysis-cache");
    const docDir = path.join(root, "documents", documentId);
    mkdirSync(docDir, { recursive: true });

    const buffer = await createDocxWithCachedIssueText(12);
    const originalPath = path.join(docDir, "original.docx");
    writeFileSync(originalPath, buffer);

    const store = new FileDocumentSessionStore(path.join(root, "documents"));
    const cacheStore = new FileAnalysisCacheStore(cacheRoot);
    const session = await store.create({
      documentId,
      originalFileName: "cache.docx",
      originalPath,
      fileHash: hashFileBuffer(buffer),
    });
    const service = new DocumentReviewService(store, cacheStore);
    const request: AnalyzeConsistencyRequest = {
      checks: ["format"],
      mode: "comment_and_highlight",
      useLLM: false,
      useRuleEngine: false,
      maxIssues: 5,
      maxAnnotatedIssues: 5,
      maxReturnedIssues: Number.MAX_SAFE_INTEGER,
      debugTrace: true,
      useCache: true,
      forceReanalyze: false,
      annotateFromCache: true,
    };
    const descriptor = await service.buildCacheDescriptor(session, request);
    const changedDescriptor = await service.buildCacheDescriptor(session, {
      ...request,
      checks: ["spelling"],
    });
    assert.notEqual(changedDescriptor.cacheKey, descriptor.cacheKey);
    const metadata: AnalysisCacheMetadata = {
      cacheKey: descriptor.cacheKey,
      fileHash: descriptor.fileHash,
      originalFileName: "cache.docx",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalIssues: 12,
      checks: request.checks,
      mode: request.mode,
      useLLM: request.useLLM,
      useRuleEngine: request.useRuleEngine,
      checkConfigHash: descriptor.checkConfigHash,
      dictionaryHash: descriptor.dictionaryHash,
      promptHash: descriptor.promptHash,
      analysisEngineVersion: descriptor.analysisEngineVersion,
      sourceDocumentId: "doc_source",
    };
    await cacheStore.put({
      metadata,
      issues: Array.from({ length: 12 }, (_, index) => createCachedIssue(index)),
    });

    const cachedResult = await service.runConsistencyAnalysis({ documentId, request });
    assert.equal(cachedResult.cacheInfo?.cacheHit, true);
    assert.equal(cachedResult.cacheInfo?.skippedAnalysisBecauseCacheHit, true);
    assert.equal(cachedResult.session.issues.length, 12);
    assert.equal(cachedResult.session.annotatedIssueIds?.length, 5);
    assert.ok(cachedResult.session.issues.every((issue) => issue.documentId === documentId));
    assert.equal(cachedResult.trace?.cache?.cacheHit, true);

    const forcedResult = await service.runConsistencyAnalysis({
      documentId,
      request: {
        ...request,
        forceReanalyze: true,
        useCache: true,
      },
    });
    assert.equal(forcedResult.cacheInfo?.cacheHit, false);
    assert.equal(forcedResult.cacheInfo?.skippedAnalysisBecauseCacheHit, false);
    assert.equal(forcedResult.session.issues.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
