import type {
  ApiHealth,
  FocusIssueResponse,
  ReviewMode,
  ReviewResponse,
  UploadedDocument,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8787";

function absolutize(url: string | null | undefined) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || error?.error || "Yêu cầu tới backend thất bại");
  }

  return response.json() as Promise<T>;
}

export function getExportUrl(documentId: string, type: string) {
  return `${API_BASE_URL}/api/documents/${documentId}/export?type=${encodeURIComponent(type)}`;
}

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return readJson<ApiHealth>(response);
}

export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    method: "POST",
    body: formData,
  });

  const data = await readJson<UploadedDocument>(response);
  return {
    ...data,
    originalFileUrl: absolutize(data.originalFileUrl) || "",
  };
}

export async function analyzeDocument(
  documentId: string,
  body: {
    mode: ReviewMode;
    highlightColor?: string;
    maxIssues?: number;
    applyHighConfidence?: boolean;
  }
): Promise<ReviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/analyze-spelling`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await readJson<ReviewResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}

export async function focusIssue(
  documentId: string,
  issueId: string
): Promise<FocusIssueResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${documentId}/issues/${issueId}/focus`
  );
  return readJson<FocusIssueResponse>(response);
}

export async function applyIssue(documentId: string, issueId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${documentId}/issues/${issueId}/apply`,
    { method: "POST" }
  );

  const data = await readJson<ReviewResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}

export async function ignoreIssue(documentId: string, issueId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${documentId}/issues/${issueId}/ignore`,
    { method: "POST" }
  );

  const data = await readJson<ReviewResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}

export async function applyHighConfidence(documentId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${documentId}/issues/apply-high-confidence`,
    { method: "POST" }
  );

  const data = await readJson<ReviewResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}

export async function runAiCommand(
  documentId: string,
  command: string,
  mode: ReviewMode
) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/ai-command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, mode }),
  });

  const data = await readJson<ReviewResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}

export async function runAgent(documentId: string, agentId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${documentId}/agents/${agentId}/run`,
    { method: "POST" }
  );

  const data = await readJson<ReviewResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}
