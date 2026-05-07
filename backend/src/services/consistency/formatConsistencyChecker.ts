import type { DocumentBlock, DocumentContextMemory, Issue } from "../../domain/types.js";
import { checkFormatRules } from "../rules/formatRules.js";

export async function runFormatConsistencyChecker(
  documentId: string,
  blocks: DocumentBlock[],
  contextMemory: DocumentContextMemory
): Promise<Issue[]> {
  return checkFormatRules(documentId, blocks, contextMemory);
}
