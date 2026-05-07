import type { Issue } from "../../domain/types.js";

export function buildIssueDedupKey(issue: Issue) {
  return [
    issue.type,
    issue.location.blockId,
    issue.location.startOffset ?? "na",
    issue.location.endOffset ?? "na",
    issue.wrong.toLowerCase(),
    issue.suggestion.toLowerCase(),
  ].join("::");
}

export function mergeAndDeduplicateIssues(issues: Issue[]) {
  const deduped = new Map<string, Issue>();

  for (const issue of issues) {
    const key = buildIssueDedupKey(issue);

    if (!deduped.has(key)) {
      deduped.set(key, issue);
    }
  }

  return [...deduped.values()];
}
