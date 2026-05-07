import type { PageChunk } from "../../domain/types.js";

export function createPageChunks(totalPages: number, pageSize = 20): PageChunk[] {
  const safeTotalPages = Math.max(1, Math.floor(totalPages || 1));
  const safePageSize = Math.max(1, Math.floor(pageSize || 20));
  const chunks: PageChunk[] = [];

  for (let startPage = 1; startPage <= safeTotalPages; startPage += safePageSize) {
    const endPage = Math.min(startPage + safePageSize - 1, safeTotalPages);
    chunks.push({
      chunkIndex: chunks.length,
      startPage,
      endPage,
      status: "pending",
      issueCount: 0,
    });
  }

  return chunks;
}
