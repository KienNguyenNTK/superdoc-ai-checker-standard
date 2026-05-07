import type { DocumentBlock, GlossaryEntry, Issue } from "../../domain/types.js";

export function checkTerminologyRules(
  documentId: string,
  blocks: DocumentBlock[],
  glossary: GlossaryEntry[]
): Issue[] {
  const issues: Issue[] = [];

  for (const entry of glossary) {
    if (!entry.preferredTranslation || entry.alternatives.length === 0) continue;

    for (const block of blocks) {
      for (const alternative of entry.alternatives) {
        const startOffset = block.text.toLowerCase().indexOf(alternative.toLowerCase());
        if (startOffset === -1) continue;

        issues.push({
          id: `term_${entry.term}_${block.blockId}_${startOffset}`,
          documentId,
          type: "terminology_consistency",
          wrong: alternative,
          suggestion: entry.preferredTranslation,
          reason: `Thuật ngữ nên thống nhất theo glossary cho "${entry.term}".`,
          confidence: "high",
          severity: "warning",
          source: "rule_engine",
          status: "pending",
          location: {
            blockId: block.blockId,
            blockType: block.type,
            path: block.path,
            startOffset,
            endOffset: startOffset + alternative.length,
            searchText: alternative,
            target: {
              kind: "selection",
              start: { kind: "text", blockId: block.blockId, offset: startOffset },
              end: {
                kind: "text",
                blockId: block.blockId,
                offset: startOffset + alternative.length,
              },
            },
          },
          evidence: [
            {
              blockId: entry.firstSeenBlockId,
              text: entry.term,
              note: "Thuật ngữ canonical trong context memory.",
            },
          ],
        });
      }
    }
  }

  return issues;
}
