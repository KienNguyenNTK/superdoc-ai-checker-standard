import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { Document, Packer, PageBreak, Paragraph, TextRun } from "docx";
import type { DocumentBlock } from "../../domain/types.js";
import { applyPageMapToBlocks, buildDocxPageMap } from "./docxPageMap.js";

function createBlock(index: number): DocumentBlock {
  return {
    blockId: `block_${index}`,
    type: "paragraph",
    text: `Trang ${index}`,
    path: `body.paragraph[${index}]`,
    runs: [
      {
        runId: "run_000",
        text: `Trang ${index}`,
        startOffset: 0,
        endOffset: `Trang ${index}`.length,
        italic: false,
        underline: false,
      },
    ],
  };
}

test("buildDocxPageMap reads explicit page breaks from DOCX", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "superdoc-page-map-"));

  try {
    const docxPath = path.join(root, "paged.docx");
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph("Trang 1"),
            new Paragraph({ children: [new PageBreak()] }),
            new Paragraph("Trang 2"),
            new Paragraph({ children: [new PageBreak()] }),
            new Paragraph("Trang 3"),
          ],
        },
      ],
    });
    writeFileSync(docxPath, await Packer.toBuffer(doc));

    const blocks = [createBlock(1), createBlock(2), createBlock(3), createBlock(4), createBlock(5)];
    const pageMap = await buildDocxPageMap(docxPath, blocks);
    const pagedBlocks = applyPageMapToBlocks(blocks, pageMap);

    assert.equal(pageMap.totalPages, 3);
    assert.equal(pageMap.source, "explicit_page_breaks");
    assert.deepEqual(pagedBlocks.map((block) => block.page), [1, 1, 2, 2, 3]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
