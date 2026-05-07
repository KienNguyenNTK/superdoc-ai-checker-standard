import type { DocumentBlock, DocumentContextMemory, Issue } from "../../domain/types.js";

const TONE_VARIANTS = [
  {
    wrong: "bọn mình",
    suggestion: "chúng tôi",
  },
  {
    wrong: "bạn",
    suggestion: "người dùng",
  },
];

export async function runToneConsistencyChecker(
  documentId: string,
  blocks: DocumentBlock[],
  contextMemory: DocumentContextMemory
): Promise<Issue[]> {
  const issues: Issue[] = [];
  if (contextMemory.toneRules.length === 0) return issues;

  for (const block of blocks) {
    for (const variant of TONE_VARIANTS) {
      const startOffset = block.text.toLowerCase().indexOf(variant.wrong.toLowerCase());
      if (startOffset === -1) continue;

      issues.push({
        id: `tone_${block.blockId}_${variant.wrong}_${startOffset}`,
        documentId,
        type: "tone_consistency",
        wrong: block.text.slice(startOffset, startOffset + variant.wrong.length),
        suggestion: variant.suggestion,
        reason: "Xưng hô/văn phong lệch khỏi tone rule của tài liệu.",
        confidence: "medium",
        severity: "info",
        source: "llm",
        status: "needs_review",
        location: {
          blockId: block.blockId,
          blockType: block.type,
          path: block.path,
          startOffset,
          endOffset: startOffset + variant.wrong.length,
          searchText: variant.wrong,
          target: {
            kind: "selection",
            start: { kind: "text", blockId: block.blockId, offset: startOffset },
            end: {
              kind: "text",
              blockId: block.blockId,
              offset: startOffset + variant.wrong.length,
            },
          },
        },
      });
    }
  }

  return issues;
}
