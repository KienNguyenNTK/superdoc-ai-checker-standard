import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { FileDocumentSessionStore } from "../storage/documentSessionStore.js";
import { DocumentReviewService } from "./documentReviewService.js";

test("applyIssue handles typo corrections when the wrong text is isolated in its own run", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-apply-isolated-run-"));

  try {
    const documentId = "doc_apply_isolated_run";
    const docDir = path.join(root, documentId);
    mkdirSync(docDir, { recursive: true });

    const originalPath = path.join(docDir, "original.docx");
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun("Đoạn này có một số lỗi rõ ràng: "),
                new TextRun("nhân viêng"),
                new TextRun(", dử liệu, và khách hang cần được sửa đúng vị trí."),
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
      originalFileName: "isolated-run.docx",
      originalPath,
    });

    const service = new DocumentReviewService(store);

    await service.runConsistencyAnalysis({
      documentId,
      request: {
        checks: ["spelling"],
        mode: "comment_and_highlight",
        useLLM: false,
        useRuleEngine: true,
        maxIssues: 20,
      },
    });

    const before = await service.requireSession(documentId);
    const targetIssue = before.issues.find((issue) => issue.wrong === "nhân viêng");
    assert.ok(targetIssue, "expected issue for isolated run typo");

    await service.applyIssue(documentId, targetIssue.id);

    const after = await service.requireSession(documentId);
    const reviewedText = (await mammoth.extractRawText({ path: after.reviewedPath! })).value;

    assert.match(reviewedText, /nhân viên/);
    assert.doesNotMatch(reviewedText, /nhân viêng/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
