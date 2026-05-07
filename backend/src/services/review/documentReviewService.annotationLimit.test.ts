import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { FileDocumentSessionStore } from "../storage/documentSessionStore.js";
import { DocumentReviewService } from "./documentReviewService.js";

test("runConsistencyAnalysis keeps all detected issues but only annotates the configured maxAnnotatedIssues", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-annotate-limit-"));

  try {
    const documentId = "doc_annotate_limit";
    const docDir = path.join(root, documentId);
    mkdirSync(docDir, { recursive: true });

    const repeatedText =
      "Chúng tôi luôn hổ trợ khách hang trong quá trình xử lí dử liệu và cập nhập hệ thông.";
    const originalPath = path.join(docDir, "original.docx");
    const doc = new Document({
      sections: [
        {
          children: Array.from({ length: 220 }, () =>
            new Paragraph({
              children: [new TextRun(repeatedText)],
            })
          ),
        },
      ],
    });

    writeFileSync(originalPath, await Packer.toBuffer(doc));

    const store = new FileDocumentSessionStore(root);
    await store.create({
      documentId,
      originalFileName: "many-issues.docx",
      originalPath,
    });

    const service = new DocumentReviewService(store);
    const result = await service.runConsistencyAnalysis({
      documentId,
      request: {
        checks: ["spelling"],
        mode: "comment_and_highlight",
        useLLM: false,
        useRuleEngine: false,
        maxIssues: 1000,
        maxAnnotatedIssues: 1000,
        maxReturnedIssues: Number.MAX_SAFE_INTEGER,
        debugTrace: true,
        annotateFromCache: true,
      },
    });

    assert.ok(result.session.issues.length > 1000);
    assert.equal(result.session.annotatedIssueIds?.length, 1000);
    assert.equal(result.summary?.annotatedIssues, 1000);
    assert.equal(result.summary?.returnedIssues, result.session.issues.length);
    assert.equal(result.trace?.summary.annotatedInDocx, 1000);
    assert.equal(result.trace?.summary.returnedToUi, result.session.issues.length);

    const batch = await service.annotateIssueWindow({
      documentId,
      mode: "comment_and_highlight",
      startIndex: 500,
      count: 500,
    });
    assert.equal(batch.session.issues.length, result.session.issues.length);
    assert.equal(batch.activeIssueWindow.startIndex, 500);
    assert.equal(batch.activeIssueWindow.count, 500);
    assert.equal(batch.session.annotatedIssueIds?.length, 500);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
