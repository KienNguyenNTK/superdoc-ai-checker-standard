import type { IssueLocation, SelectionTarget } from "../../domain/types.js";

function buildSelectionTarget(blockId: string, startOffset: number, endOffset: number): SelectionTarget {
  return {
    kind: "selection",
    start: { kind: "text", blockId, offset: startOffset },
    end: { kind: "text", blockId, offset: endOffset },
  };
}

export function buildAppliedIssueLocation(
  location: IssueLocation,
  replacementText: string
): IssueLocation {
  const startOffset =
    location.target?.kind === "selection"
      ? location.target.start.offset
      : location.startOffset;

  if (typeof startOffset !== "number") {
    return {
      ...location,
      searchText: replacementText,
    };
  }

  const endOffset = startOffset + replacementText.length;

  return {
    ...location,
    searchText: replacementText,
    startOffset,
    endOffset,
    target: buildSelectionTarget(location.blockId, startOffset, endOffset),
  };
}
