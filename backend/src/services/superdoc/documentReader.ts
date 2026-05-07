import type { SuperDocDocument } from "@superdoc-dev/sdk";
import type { DocumentBlock, DocumentRun } from "../../domain/types.js";

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

type RawRunProps = {
  bold?: boolean;
  italic?: boolean;
  underline?: string | boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
  fontSize?: number;
  fontFamily?: string;
};

type RawInlineNode =
  | {
      kind: "run";
      run: {
        text?: string;
        props?: RawRunProps;
      };
    }
  | {
      kind: string;
      text?: string;
    };

export type SuperDocNode = {
  kind: string;
  paragraph?: {
    text?: string;
    styleId?: string;
    inlines?: RawInlineNode[];
  };
  heading?: {
    text?: string;
    level?: number;
    styleId?: string;
    inlines?: RawInlineNode[];
  };
};

type SuperDocNodeResult = {
  node?: SuperDocNode;
};

function inferBlockType(block: RawExtractBlock) {
  if (block.tableContext) return "tableCell" as const;
  if (block.type === "heading") return "heading" as const;
  if (block.type === "listItem") return "listItem" as const;
  return "paragraph" as const;
}

function inferBlockPath(block: RawExtractBlock, index: number, type: DocumentBlock["type"]) {
  if (block.tableContext) {
    const tableIndex = block.tableContext.tableOrdinal ?? 0;
    const rowIndex = block.tableContext.rowIndex ?? 0;
    const cellIndex = block.tableContext.columnIndex ?? 0;
    return `body.table[${tableIndex}].row[${rowIndex}].cell[${cellIndex}]`;
  }

  return `body.${type}[${index}]`;
}

function compactMetadata(metadata: DocumentBlock["metadata"]) {
  if (!metadata) return undefined;

  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as NonNullable<DocumentBlock["metadata"]>;
}

function mapRunProps(runId: string, text: string, startOffset: number, props?: RawRunProps, styleName?: string) {
  const result: DocumentRun = {
    runId,
    text,
    startOffset,
    endOffset: startOffset + text.length,
    italic: Boolean(props?.italic),
    underline: props?.underline === true || props?.underline === "single",
  };

  if (typeof props?.bold === "boolean") result.bold = props.bold;
  if (typeof props?.strike === "boolean") result.strike = props.strike;
  if (typeof props?.color === "string") result.color = props.color;
  if (typeof props?.highlight === "string") result.highlightColor = props.highlight;
  if (typeof props?.fontSize === "number") result.fontSize = props.fontSize;
  if (typeof props?.fontFamily === "string") result.fontFamily = props.fontFamily;
  if (styleName) result.styleName = styleName;

  return result;
}

export function buildRunsFromNode(node?: SuperDocNode): DocumentRun[] {
  const container = node?.paragraph ?? node?.heading;
  const styleName = container?.styleId;
  const inlineRuns = (container?.inlines || []).filter(
    (inline): inline is Extract<RawInlineNode, { kind: "run" }> => inline.kind === "run"
  );

  if (inlineRuns.length === 0) {
    const fallbackText = container?.text || "";
    if (!fallbackText) return [];
    return [mapRunProps("run_000", fallbackText, 0, undefined, styleName)];
  }

  let offset = 0;
  return inlineRuns
    .map((inline, index) => {
      const text = inline.run.text || "";
      const run = mapRunProps(
        `run_${String(index).padStart(3, "0")}`,
        text,
        offset,
        inline.run.props,
        styleName
      );
      offset = run.endOffset;
      return run;
    })
    .filter((run) => run.text.length > 0);
}

export function normaliseExtractedBlocks(rawBlocks: RawExtractBlock[]): DocumentBlock[] {
  return rawBlocks
    .filter((block): block is RawExtractBlock & { text: string } => typeof block.text === "string")
    .map((block, index) => {
      const type = inferBlockType(block);
      const path = inferBlockPath(block, index, type);

      const metadata = compactMetadata({
        tableIndex: block.tableContext?.tableOrdinal,
        rowIndex: block.tableContext?.rowIndex,
        cellIndex: block.tableContext?.columnIndex,
        headingLevel: typeof block.headingLevel === "number" ? block.headingLevel : undefined,
      });

      return {
        blockId: block.nodeId,
        type,
        path,
        text: block.text,
        runs: [
          {
            runId: "run_000",
            text: block.text,
            startOffset: 0,
            endOffset: block.text.length,
            italic: false,
            underline: false,
          },
        ],
        ...(metadata ? { metadata } : {}),
      };
    });
}

export async function extractStructure(doc: SuperDocDocument) {
  const extractResult = (await (doc as any).extract()) as {
    blocks?: RawExtractBlock[];
  };

  return normaliseExtractedBlocks(extractResult.blocks || []);
}

export async function hydrateBlockRuns(doc: SuperDocDocument, block: DocumentBlock): Promise<DocumentBlock> {
  try {
    const nodeResult = (await (doc as any).getNodeById({
      id: block.blockId,
    })) as SuperDocNodeResult;
    const runs = buildRunsFromNode(nodeResult.node);
    if (runs.length === 0) return block;

    return {
      ...block,
      text: runs.map((run) => run.text).join(""),
      runs,
      metadata: {
        ...block.metadata,
        styleName: runs.find((run) => run.styleName)?.styleName,
      },
    };
  } catch {
    return block;
  }
}

export async function readDocumentBlocks(doc: SuperDocDocument) {
  const blocks = await extractStructure(doc);
  return Promise.all(blocks.map((block) => hydrateBlockRuns(doc, block)));
}
