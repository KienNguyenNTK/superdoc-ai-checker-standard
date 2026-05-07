import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { Issue } from "../../domain/types.js";
import { FileDocumentSessionStore } from "../storage/documentSessionStore.js";
import { DocumentReviewService } from "./documentReviewService.js";

function createIssue(index: number): Issue {
  return {
    id: `issue_${index + 1}`,
    documentId: "doc_paged",
    type: index % 2 === 0 ? "accent" : "spelling",
    wrong: `wrong_${index + 1}`,
    suggestion: `suggestion_${index + 1}`,
    reason: "Fake paged issue",
    confidence: "high",
    severity: "error",
    source: index % 3 === 0 ? "hybrid" : "rule_engine",
    status: index % 5 === 0 ? "commented" : index % 7 === 0 ? "needs_review" : "pending",
    location: {
      blockId: `block_${index + 1}`,
      blockType: "paragraph",
      path: `body.paragraph[${index + 1}]`,
      searchText: `wrong_${index + 1}`,
      commentId: index % 5 === 0 ? `comment_${index + 1}` : undefined,
    },
  };
}

test("session store keeps full issue list and listIssues paginates without truncating", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "superdoc-paged-"));

  try {
    const documentId = "doc_paged";
    const originalPath = path.join(root, documentId, "original.docx");
    mkdirSync(path.dirname(originalPath), { recursive: true });
    writeFileSync(originalPath, Buffer.from("fake-docx"));

    const store = new FileDocumentSessionStore(root);
    const session = await store.create({
      documentId,
      originalFileName: "fake.docx",
      originalPath,
    });

    session.issues = Array.from({ length: 3520 }, (_, index) => createIssue(index));
    session.annotatedIssueIds = session.issues
      .filter((issue) => issue.location.commentId)
      .map((issue) => issue.id);
    await store.save(session);

    const reloaded = await store.get(documentId);
    assert.equal(reloaded?.issues.length, 3520);

    const service = new DocumentReviewService(store);
    const pageTwo = await service.listIssues(documentId, { page: 2, pageSize: 500 });
    const annotatedOnly = await service.listIssues(documentId, {
      page: 1,
      pageSize: 200,
      annotated: "true",
    });

    assert.equal(pageTwo.total, 3520);
    assert.equal(pageTwo.issues.length, 500);
    assert.equal(pageTwo.issues[0]?.id, "issue_501");
    assert.equal(pageTwo.hasMore, true);
    assert.ok(annotatedOnly.total > 0);
    assert.ok(annotatedOnly.issues.every((issue) => Boolean(issue.location.commentId)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
