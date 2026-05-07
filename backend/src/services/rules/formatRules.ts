import type { DocumentBlock, DocumentContextMemory, Issue, RunFormatSnapshot } from "../../domain/types.js";
import { checkHeadingFormatRules } from "../consistency/headingConsistencyChecker.js";

function sameFormat(left: RunFormatSnapshot | undefined, right: RunFormatSnapshot | undefined) {
  if (!left || !right) return false;
  return (
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline &&
    left.color === right.color &&
    left.highlightColor === right.highlightColor &&
    left.fontFamily === right.fontFamily &&
    left.fontSize === right.fontSize
  );
}

function findRunIssue(block: DocumentBlock, target: string) {
  const run = block.runs.find((candidate) => candidate.text.trim() === target);
  if (!run) return null;
  return {
    run,
    startOffset: run.startOffset,
    endOffset: run.endOffset,
  };
}

export function checkFormatRules(
  documentId: string,
  blocks: DocumentBlock[],
  contextMemory: DocumentContextMemory
): Issue[] {
  const issues: Issue[] = [];

  for (const rule of contextMemory.formatRules) {
    if (rule.ruleType === "heading_format") {
      issues.push(...checkHeadingFormatRules(documentId, blocks, [rule]));
      continue;
    }

    for (const block of blocks) {
      const found = findRunIssue(block, rule.target);
      if (!found || sameFormat(found.run, rule.expectedFormat)) continue;
      issues.push({
        id: `format_${rule.target}_${block.blockId}_${found.startOffset}`,
        documentId,
        type: "format_consistency",
        wrong: rule.target,
        suggestion: `Chuẩn hóa format cho ${rule.target}`,
        reason: "Thuật ngữ/nhãn đang khác định dạng đã dùng trước đó trong tài liệu.",
        confidence: "high",
        severity: "warning",
        source: "rule_engine",
        status: "pending",
        location: {
          blockId: block.blockId,
          blockType: block.type,
          path: block.path,
          startOffset: found.startOffset,
          endOffset: found.endOffset,
          runIds: [found.run.runId],
          searchText: rule.target,
          target: {
            kind: "selection",
            start: { kind: "text", blockId: block.blockId, offset: found.startOffset },
            end: { kind: "text", blockId: block.blockId, offset: found.endOffset },
          },
        },
        evidence: rule.examples.map((example) => ({
          blockId: example.blockId,
          text: example.text,
          note: "Ví dụ định dạng chuẩn trong tài liệu.",
        })),
        suggestedFormat: rule.expectedFormat,
      });
    }
  }

  return issues;
}
