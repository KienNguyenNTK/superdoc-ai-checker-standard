import type { AnalyzeResult, ApiHealth } from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8787";

export async function getApiHealth(): Promise<ApiHealth> {
  const res = await fetch(`${API_BASE_URL}/api/health`);

  if (!res.ok) {
    throw new Error("Backend chưa chạy hoặc không kết nối được");
  }

  return res.json();
}

export async function analyzeDocumentWithBackend(file: File): Promise<AnalyzeResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/documents/analyze-spelling`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail || error?.error || "Không phân tích được DOCX");
  }

  return res.json();
}
