import type { DocumentBlock, DocumentContextMemory, Issue } from "../../domain/types.js";
import { checkTerminologyRules } from "../rules/terminologyRules.js";

export async function runTerminologyConsistencyChecker(
  documentId: string,
  blocks: DocumentBlock[],
  contextMemory: DocumentContextMemory
): Promise<Issue[]> {
  return checkTerminologyRules(documentId, blocks, contextMemory.glossary);
}
