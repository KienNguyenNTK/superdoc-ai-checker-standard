import type { DocumentBlock, DocumentContextMemory, Issue } from "../../domain/types.js";

export async function runTranslationConsistencyChecker(
  documentId: string,
  blocks: DocumentBlock[],
  contextMemory: DocumentContextMemory
): Promise<Issue[]> {
  const issues: Issue[] = [];

  for (const entry of contextMemory.glossary) {
    if (!entry.preferredTranslation) continue;

    for (const block of blocks) {
      const wrongMatch = entry.alternatives.find((alternative) =>
        block.text.toLowerCase().includes(alternative.toLowerCase())
      );
      if (!wrongMatch) continue;

      const startOffset = block.text.toLowerCase().indexOf(wrongMatch.toLowerCase());
      issues.push({
        id: `translation_${entry.term}_${block.blockId}_${startOffset}`,
        documentId,
        type: "translation_consistency",
        wrong: wrongMatch,
        suggestion: entry.preferredTranslation,
        reason: `Bản dịch cho "${entry.term}" lệch khỏi glossary ưu tiên.`,
        confidence: "medium",
        severity: "warning",
        source: "llm",
        status: "pending",
        location: {
          blockId: block.blockId,
          blockType: block.type,
          path: block.path,
          startOffset,
          endOffset: startOffset + wrongMatch.length,
          searchText: wrongMatch,
          target: {
            kind: "selection",
            start: { kind: "text", blockId: block.blockId, offset: startOffset },
            end: {
              kind: "text",
              blockId: block.blockId,
              offset: startOffset + wrongMatch.length,
            },
          },
        },
        evidence: [
          {
            blockId: entry.firstSeenBlockId,
            text: entry.preferredTranslation,
            note: "Bản dịch ưu tiên trong glossary.",
          },
        ],
      });
    }
  }

  return issues;
}
