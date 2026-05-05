import type { SpellingIssue } from "../../domain/types.js";

function escapeCsv(value: string | number | undefined) {
  const safe = String(value ?? "");
  if (!/[",\n]/.test(safe)) return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportIssuesCsv(issues: SpellingIssue[]) {
  const header = [
    "issueId",
    "documentId",
    "wrong",
    "suggestion",
    "reason",
    "confidence",
    "status",
    "blockId",
    "path",
    "startOffset",
    "endOffset",
  ];

  const rows = issues.map((issue) =>
    [
      issue.id,
      issue.documentId,
      issue.wrong,
      issue.suggestion,
      issue.reason,
      issue.confidence,
      issue.status,
      issue.location.blockId,
      issue.location.path,
      issue.location.startOffset,
      issue.location.endOffset,
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
}
