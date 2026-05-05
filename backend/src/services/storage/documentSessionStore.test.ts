import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileDocumentSessionStore } from "./documentSessionStore.js";

test("FileDocumentSessionStore creates, reloads, and updates a session timeline", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-store-"));

  try {
    const store = new FileDocumentSessionStore(root);

    const created = await store.create({
      documentId: "doc_001",
      originalFileName: "sample.docx",
      originalPath: "C:/tmp/sample.docx",
    });

    assert.equal(created.documentId, "doc_001");
    assert.equal(created.history.length, 1);
    assert.match(created.history[0].message, /Imported DOCX/i);

    created.reviewedPath = "C:/tmp/reviewed.docx";
    created.history.push({
      id: "hist_2",
      type: "analyzed",
      message: "Ran spelling checker",
      createdAt: created.createdAt,
    });

    await store.save(created);

    const loaded = await store.get("doc_001");
    assert.ok(loaded);
    assert.equal(loaded?.reviewedPath, "C:/tmp/reviewed.docx");
    assert.equal(loaded?.history.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
