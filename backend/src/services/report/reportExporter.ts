import type { Issue } from "../../domain/types.js";

function escapeCsv(value: string | number | undefined) {
  const safe = String(value ?? "");
  if (!/[",\n]/.test(safe)) return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportIssuesCsv(issues: Issue[]) {
  const header = [
    "issueId",
    "documentId",
    "type",
    "wrong",
    "suggestion",
    "reason",
    "confidence",
    "severity",
    "source",
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
      issue.type,
      issue.wrong,
      issue.suggestion,
      issue.reason,
      issue.confidence,
      issue.severity,
      issue.source,
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
