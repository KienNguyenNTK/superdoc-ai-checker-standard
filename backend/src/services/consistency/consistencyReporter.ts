import type { DocumentContextMemory, Issue } from "../../domain/types.js";

export function summarizeContextMemory(memory: DocumentContextMemory) {
  return {
    terms: memory.glossary.length,
    formatRules: memory.formatRules.length,
    toneRules: memory.toneRules.length,
    entities: memory.entityRules.length,
  };
}

export function summarizeIssues(issues: Issue[]) {
  return issues.reduce<Record<string, number>>((accumulator, issue) => {
    accumulator[issue.type] = (accumulator[issue.type] || 0) + 1;
    return accumulator;
  }, {});
}
