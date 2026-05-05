import type { SuperDocDocument } from "@superdoc-dev/sdk";
import type { DocumentBlock } from "../../domain/types.js";

type RawExtractBlock = {
  nodeId: string;
  type: string;
  text?: string | null;
  headingLevel?: number;
  tableContext?: {
    tableOrdinal?: number;
    rowIndex?: number;
    columnIndex?: number;
  };
};

export function normaliseExtractedBlocks(rawBlocks: RawExtractBlock[]): DocumentBlock[] {
  return rawBlocks
    .filter((block): block is RawExtractBlock & { text: string } => typeof block.text === "string")
    .map((block, index) => {
      if (block.tableContext) {
        const tableIndex = block.tableContext.tableOrdinal ?? 0;
        const rowIndex = block.tableContext.rowIndex ?? 0;
        const cellIndex = block.tableContext.columnIndex ?? 0;

        return {
          blockId: block.nodeId,
          type: "tableCell",
          path: `body.table[${tableIndex}].row[${rowIndex}].cell[${cellIndex}]`,
          text: block.text,
          metadata: {
            tableIndex,
            rowIndex,
            cellIndex,
          },
        };
      }

      const type = block.type === "heading" ? "heading" : "paragraph";
      return {
        blockId: block.nodeId,
        type,
        path: `body.${type}[${index}]`,
        text: block.text,
        metadata:
          block.type === "heading" && typeof block.headingLevel === "number"
            ? { headingLevel: block.headingLevel }
            : undefined,
      };
    });
}

export async function readDocumentBlocks(doc: SuperDocDocument) {
  const extractResult = (await doc.extract()) as {
    blocks?: RawExtractBlock[];
  };

  return normaliseExtractedBlocks(extractResult.blocks || []);
}
