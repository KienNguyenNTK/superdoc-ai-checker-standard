import type { DocumentBlock, Issue } from "../../domain/types.js";

export function checkDateNumberConsistency(documentId: string, blocks: DocumentBlock[]): Issue[] {
  const issues: Issue[] = [];
  const percentBlocks = blocks.filter((block) => /\b\d+%\b/.test(block.text));
  const wordPercentBlocks = blocks.filter((block) => /\b\d+\s+phần trăm\b/i.test(block.text));

  if (percentBlocks.length > 0 && wordPercentBlocks.length > 0) {
    for (const [index, block] of wordPercentBlocks.entries()) {
      const matched = block.text.match(/\b\d+\s+phần trăm\b/i)?.[0];
      if (!matched) continue;
      const startOffset = block.text.indexOf(matched);

      issues.push({
        id: `date_number_${block.blockId}_${index}`,
        documentId,
        type: "date_number_consistency",
        wrong: matched,
        suggestion: matched.replace(/\s+phần trăm/i, "%"),
        reason: "Biểu diễn phần trăm không nhất quán với các phần khác của tài liệu.",
        confidence: "medium",
        severity: "info",
        source: "rule_engine",
        status: "pending",
        location: {
          blockId: block.blockId,
          blockType: block.type,
          path: block.path,
          startOffset,
          endOffset: startOffset + matched.length,
          searchText: matched,
          target: {
            kind: "selection",
            start: { kind: "text", blockId: block.blockId, offset: startOffset },
            end: {
              kind: "text",
              blockId: block.blockId,
              offset: startOffset + matched.length,
            },
          },
        },
      });
    }
  }

  return issues;
}
