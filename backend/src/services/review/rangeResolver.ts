import type { DocumentBlock, ResolvedRange } from "../../domain/types.js";

type ResolveIssueRangeInput = {
  block: DocumentBlock;
  wrong: string;
  beforeContext?: string;
  afterContext?: string;
};

function findAllIndexes(text: string, pattern: string) {
  const indexes: number[] = [];
  let fromIndex = 0;

  while (fromIndex <= text.length) {
    const found = text.indexOf(pattern, fromIndex);
    if (found === -1) break;
    indexes.push(found);
    fromIndex = found + 1;
  }

  return indexes;
}

function scoreCandidate(
  sourceText: string,
  startOffset: number,
  wrong: string,
  beforeContext?: string,
  afterContext?: string
) {
  const before = beforeContext?.trim();
  const after = afterContext?.trim();
  const beforeWindow = sourceText.slice(
    Math.max(0, startOffset - (before?.length || 0) - 12),
    startOffset
  );
  const afterWindow = sourceText.slice(
    startOffset + wrong.length,
    startOffset + wrong.length + (after?.length || 0) + 12
  );

  let score = 0;
  if (before && beforeWindow.includes(before)) score += 2;
  if (after && afterWindow.includes(after)) score += 2;

  return score;
}

export function resolveIssueRange({
  block,
  wrong,
  beforeContext,
  afterContext,
}: ResolveIssueRangeInput): ResolvedRange {
  const indexes = findAllIndexes(block.text, wrong);

  if (indexes.length === 0) {
    return {
      blockId: block.blockId,
      path: block.path,
      beforeContext,
      afterContext,
      confidence: "not_found",
    };
  }

  if (indexes.length === 1) {
    const startOffset = indexes[0];
    const endOffset = startOffset + wrong.length;

    return {
      blockId: block.blockId,
      path: block.path,
      startOffset,
      endOffset,
      exactText: wrong,
      beforeContext,
      afterContext,
      confidence: "exact",
      target: {
        kind: "selection",
        start: { kind: "text", blockId: block.blockId, offset: startOffset },
        end: { kind: "text", blockId: block.blockId, offset: endOffset },
      },
    };
  }

  const ranked = indexes
    .map((startOffset) => ({
      startOffset,
      score: scoreCandidate(block.text, startOffset, wrong, beforeContext, afterContext),
    }))
    .sort((left, right) => right.score - left.score);

  if (ranked[0]?.score && ranked[0].score > (ranked[1]?.score ?? 0)) {
    const startOffset = ranked[0].startOffset;
    const endOffset = startOffset + wrong.length;

    return {
      blockId: block.blockId,
      path: block.path,
      startOffset,
      endOffset,
      exactText: wrong,
      beforeContext,
      afterContext,
      confidence: "fuzzy",
      target: {
        kind: "selection",
        start: { kind: "text", blockId: block.blockId, offset: startOffset },
        end: { kind: "text", blockId: block.blockId, offset: endOffset },
      },
    };
  }

  return {
    blockId: block.blockId,
    path: block.path,
    beforeContext,
    afterContext,
    confidence: "ambiguous",
  };
}
