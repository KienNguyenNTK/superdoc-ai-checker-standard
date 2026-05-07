import type { DocumentBlock, DocumentContextMemory, Issue } from "../../domain/types.js";
import { checkEntityConsistency } from "../rules/entityRules.js";

export async function runEntityConsistencyChecker(
  documentId: string,
  blocks: DocumentBlock[],
  _contextMemory: DocumentContextMemory
): Promise<Issue[]> {
  return checkEntityConsistency(documentId, blocks);
}
