import type { DocumentBlock, FormatRule } from "../../domain/types.js";
import { buildHeadingFormatRules } from "./headingConsistencyChecker.js";

export function deriveHeadingRules(blocks: DocumentBlock[]): FormatRule[] {
  return buildHeadingFormatRules(blocks);
}

export function deriveTermFormatRules(blocks: DocumentBlock[], entityNames: string[]): FormatRule[] {
  const rules = new Map<string, FormatRule>();

  for (const block of blocks) {
    for (const run of block.runs) {
      const token = run.text.trim();
      if (!entityNames.includes(token) || !run.bold) continue;

      if (!rules.has(token)) {
        rules.set(token, {
          target: token,
          ruleType: "term_format",
          expectedFormat: {
            bold: run.bold,
            italic: run.italic,
            underline: run.underline,
            color: run.color,
            highlightColor: run.highlightColor,
            fontFamily: run.fontFamily,
            fontSize: run.fontSize,
            styleName: run.styleName,
          },
          examples: [{ blockId: block.blockId, text: block.text }],
          confidence: "high",
        });
      }
    }
  }

  return [...rules.values()];
}
