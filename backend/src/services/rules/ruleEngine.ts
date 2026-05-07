import type { DocumentBlock, DocumentContextMemory, Issue } from "../../domain/types.js";
import { checkDateNumberConsistency } from "./dateNumberRules.js";
import { checkEntityConsistency } from "./entityRules.js";
import { checkFormatRules } from "./formatRules.js";
import { checkTerminologyRules } from "./terminologyRules.js";
import { mergeAndDeduplicateIssues } from "./customRules.js";

export function runRuleEngine(
  documentId: string,
  blocks: DocumentBlock[],
  contextMemory: DocumentContextMemory
): Issue[] {
  return mergeAndDeduplicateIssues([
    ...checkFormatRules(documentId, blocks, contextMemory),
    ...checkTerminologyRules(documentId, blocks, contextMemory.glossary),
    ...checkEntityConsistency(documentId, blocks),
    ...checkDateNumberConsistency(documentId, blocks),
  ]);
}
