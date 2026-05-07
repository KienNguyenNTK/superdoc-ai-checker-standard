import type {
  ApiHealth,
  AnalysisSessionResponse,
  AnalysisTraceArtifact,
  AnalyzeChunkResponse,
  CachedChunkAnalysis,
  CachedDocumentAnalysisMetadata,
  DocumentContextMemory,
  FocusIssueResponse,
  GlossaryEntry,
  IssueListResponse,
  PromptTemplate,
  PromptTestResult,
  ReviewMode,
  ReviewResponse,
  TraceResponse,
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
    checks?: Array<
      "spelling" | "format" | "terminology" | "translation" | "tone" | "entity" | "date_number"
    >;
    highlightColor?: string;
    maxIssues?: number;
    maxAnnotatedIssues?: number;
    maxReturnedIssues?: number;
    applyHighConfidence?: boolean;
    useLLM?: boolean;
    useRuleEngine?: boolean;
    debugTrace?: boolean;
    useCache?: boolean;
    forceReanalyze?: boolean;
    annotateFromCache?: boolean;
  }
): Promise<ReviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/analyze-consistency`, {
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

export type ChunkAnalyzeBody = {
  mode: ReviewMode;
  checks?: Array<
    "spelling" | "format" | "terminology" | "translation" | "tone" | "entity" | "date_number"
  >;
  maxIssues?: number;
  maxAnnotatedIssues?: number;
  maxReturnedIssues?: number;
  useLLM?: boolean;
  useRuleEngine?: boolean;
  debugTrace?: boolean;
  useCache?: boolean;
  forceReanalyze?: boolean;
  pageSize?: number;
  chunkIndex?: number;
  retry?: boolean;
};

export async function createAnalysisSession(
  documentId: string,
  body: ChunkAnalyzeBody
): Promise<AnalysisSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/analysis-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<AnalysisSessionResponse>(response);
}

export async function analyzeDocumentChunk(
  documentId: string,
  body: ChunkAnalyzeBody
): Promise<AnalyzeChunkResponse> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/analyze-chunk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<AnalyzeChunkResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}

export async function getAnalysisMetadataByHash(fileHash: string) {
  const response = await fetch(`${API_BASE_URL}/api/documents/by-hash/${fileHash}/analysis-metadata`);
  return readJson<CachedDocumentAnalysisMetadata>(response);
}

export async function getAnalysisChunksByHash(fileHash: string) {
  const response = await fetch(`${API_BASE_URL}/api/documents/by-hash/${fileHash}/chunks`);
  return readJson<{ chunks: CachedChunkAnalysis[] }>(response);
}

export async function getAnalysisChunkByHash(fileHash: string, chunkIndex: number) {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/by-hash/${fileHash}/chunks/${chunkIndex}`
  );
  return readJson<CachedChunkAnalysis>(response);
}

export async function buildContext(documentId: string) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/build-context`, {
    method: "POST",
  });
  return readJson<{
    documentId: string;
    status: string;
    summary: Record<string, number>;
    contextMemoryUrl: string;
  }>(response);
}

export async function getContext(documentId: string) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/context`);
  return readJson<{ context: DocumentContextMemory | null }>(response);
}

export async function getAnalysisTrace(documentId: string): Promise<TraceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/trace`);
  const data = await readJson<TraceResponse>(response);
  return {
    ...data,
    traceFileUrl: absolutize(data.traceFileUrl),
    trace: (data.trace ?? null) as AnalysisTraceArtifact | null,
  };
}

export async function listIssues(
  documentId: string,
  query: {
    page?: number;
    pageSize?: number;
    annotated?: "true" | "false";
    status?: string;
    source?: string;
    type?: string;
  } = {}
) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.annotated) params.set("annotated", query.annotated);
  if (query.status) params.set("status", query.status);
  if (query.source) params.set("source", query.source);
  if (query.type) params.set("type", query.type);
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/issues?${params.toString()}`);
  return readJson<IssueListResponse>(response);
}

export async function updateGlossary(documentId: string, glossary: GlossaryEntry[]) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/glossary`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ glossary }),
  });
  return readJson<{ glossary: GlossaryEntry[] }>(response);
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

export async function annotateIssues(
  documentId: string,
  body: { mode: ReviewMode; count?: number; all?: boolean; issueIds?: string[] }
) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/issues/annotate`, {
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

export async function annotateIssueBatch(
  documentId: string,
  body: { mode: ReviewMode; startIndex?: number; count?: number }
) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/issues/annotation-batch`, {
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

export async function openIssueWindow(
  documentId: string,
  issueId: string,
  body: { mode: ReviewMode; count?: number }
) {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${documentId}/issues/${issueId}/open-window`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
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
  mode: ReviewMode,
  debugTrace?: boolean
) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/ai-command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, mode, debugTrace }),
  });

  const data = await readJson<ReviewResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}

export async function runAgent(documentId: string, agentId: string, debugTrace?: boolean) {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${documentId}/agents/${agentId}/run`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debugTrace }),
    }
  );

  const data = await readJson<ReviewResponse>(response);
  return {
    ...data,
    reviewedFileUrl: absolutize(data.reviewedFileUrl),
  };
}

export async function listPrompts() {
  const response = await fetch(`${API_BASE_URL}/api/prompts`);
  return readJson<{ prompts: PromptTemplate[] }>(response);
}

export async function getPrompt(promptId: string) {
  const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}`);
  return readJson<{ prompt: PromptTemplate }>(response);
}

export async function savePrompt(promptId: string, prompt: Partial<PromptTemplate>) {
  const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prompt),
  });
  return readJson<{ prompt: PromptTemplate }>(response);
}

export async function resetPrompt(promptId: string) {
  const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}/reset`, {
    method: "POST",
  });
  return readJson<{ prompt: PromptTemplate }>(response);
}

export async function testPrompt(
  promptId: string,
  variables: Record<string, string>,
  sampleOutput: string
) {
  const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variables, sampleOutput }),
  });
  return readJson<{ result: PromptTestResult }>(response);
}
