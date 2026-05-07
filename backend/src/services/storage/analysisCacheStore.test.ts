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
