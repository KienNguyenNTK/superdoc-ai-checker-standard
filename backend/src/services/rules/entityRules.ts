import type { DocumentBlock, Issue } from "../../domain/types.js";

function createIssueId(prefix: string, blockId: string, index: number) {
  return `${prefix}_${blockId}_${String(index).padStart(3, "0")}`;
}

export function checkEntityConsistency(documentId: string, blocks: DocumentBlock[]): Issue[] {
  const issues: Issue[] = [];
  const canonical = new Map<string, string>();

  for (const block of blocks) {
    const matches = block.text.match(/\b(?:Open ?AI|Super ?Doc|8 ?AM(?: Coffee)?)\b/gi) || [];

    matches.forEach((matched, index) => {
      const normalized = matched.replace(/\s+/g, "").toLowerCase();
      const expected = normalized === "openai" ? "OpenAI" : normalized === "superdoc" ? "SuperDoc" : "8AM Coffee";
      canonical.set(normalized, expected);

      if (matched === expected) return;

      const startOffset = block.text.indexOf(matched);
      issues.push({
        id: createIssueId("entity", block.blockId, index),
        documentId,
        type: "name_consistency",
        wrong: matched,
        suggestion: expected,
        reason: "Tên riêng đang khác với dạng canonical trong tài liệu.",
        confidence: "high",
        severity: "warning",
        source: "rule_engine",
        status: "pending",
        location: {
          blockId: block.blockId,
          blockType: block.type,
          path: block.path,
          startOffset,
          endOffset: startOffset >= 0 ? startOffset + matched.length : undefined,
          searchText: matched,
          beforeContext: block.text.slice(Math.max(0, startOffset - 20), Math.max(0, startOffset)),
          afterContext:
            startOffset >= 0
              ? block.text.slice(startOffset + matched.length, startOffset + matched.length + 20)
              : undefined,
          target:
            startOffset >= 0
              ? {
                  kind: "selection",
                  start: { kind: "text", blockId: block.blockId, offset: startOffset },
                  end: {
                    kind: "text",
                    blockId: block.blockId,
                    offset: startOffset + matched.length,
                  },
                }
              : undefined,
        },
      });
    });
  }

  return issues;
}
