import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import mammoth from "mammoth";
import { FileDocumentSessionStore } from "../storage/documentSessionStore.js";
import { DocumentReviewService } from "./documentReviewService.js";

test("applyIssue replaces commented text without leaving trailing characters", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-apply-issue-"));

  try {
    const documentId = "doc_apply_issue";
    const docDir = path.join(root, documentId);
    mkdirSync(docDir, { recursive: true });

    const originalPath = path.join(docDir, "original.docx");
    copyFileSync(
      path.resolve(process.cwd(), "../examples/sample-spelling-review.docx"),
      originalPath
    );

    const store = new FileDocumentSessionStore(root);
    await store.create({
      documentId,
      originalFileName: "sample-spelling-review.docx",
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
    const targetIssue = before.issues.find((issue) => issue.wrong === "hổ trợ");
    assert.ok(targetIssue, "expected spelling issue for 'hổ trợ'");

    await service.applyIssue(documentId, targetIssue.id);

    const after = await service.requireSession(documentId);
    const reviewedText = (await mammoth.extractRawText({ path: after.reviewedPath! })).value;

    assert.match(reviewedText, /hỗ trợ/);
    assert.doesNotMatch(reviewedText, /hỗ trợợ/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
