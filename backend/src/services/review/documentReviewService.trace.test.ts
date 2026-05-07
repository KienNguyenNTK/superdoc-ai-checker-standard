import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { FileDocumentSessionStore } from "../storage/documentSessionStore.js";
import { DocumentReviewService } from "./documentReviewService.js";

test("runConsistencyAnalysis writes analysis-trace.json and exposes matching summary counts", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-trace-"));

  try {
    const documentId = "doc_trace_analysis";
    const docDir = path.join(root, documentId);
    mkdirSync(docDir, { recursive: true });

    const originalPath = path.join(docDir, "original.docx");
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun("Đoạn này có khách hang, dử liệu và hệ thông để kiểm tra trace."),
              ],
            }),
          ],
        },
      ],
    });

    writeFileSync(originalPath, await Packer.toBuffer(doc));

    const store = new FileDocumentSessionStore(root);
    await store.create({
      documentId,
      originalFileName: "trace.docx",
      originalPath,
    });

    const service = new DocumentReviewService(store);
    const result = await service.runConsistencyAnalysis({
      documentId,
      request: {
        checks: ["spelling"],
        mode: "comment_and_highlight",
        useLLM: false,
        useRuleEngine: true,
        maxIssues: 20,
        debugTrace: true,
      },
    });

    const trace = await service.getTrace(documentId);

    assert.equal(result.traceEnabled, true);
    assert.ok(trace);
    assert.equal(trace?.summary.returnedToUi, result.session.issues.length);
    assert.ok((trace?.summary.annotatedInDocx ?? 0) <= result.session.issues.length);
    assert.equal(trace?.issues.length ? true : false, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
