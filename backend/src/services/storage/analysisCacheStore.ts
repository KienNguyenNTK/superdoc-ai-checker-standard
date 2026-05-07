import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnalysisCacheMetadata,
  AnalysisTraceArtifact,
  CachedChunkAnalysis,
  CachedDocumentAnalysisMetadata,
  DocumentContextMemory,
  Issue,
} from "../../domain/types.js";

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

export type AnalysisCacheEntry = {
  metadata: AnalysisCacheMetadata;
  issues: Issue[];
  trace?: AnalysisTraceArtifact | null;
  contextMemory?: DocumentContextMemory | null;
};

export class FileAnalysisCacheStore {
  constructor(private readonly rootDir: string) {}

  getCacheDir(cacheKey: string) {
    return path.join(this.rootDir, cacheKey);
  }

  getMetadataPath(cacheKey: string) {
    return path.join(this.getCacheDir(cacheKey), "metadata.json");
  }

  async has(cacheKey: string) {
    const metadata = await readJsonFile<AnalysisCacheMetadata | null>(
      this.getMetadataPath(cacheKey),
      null
    );
    return Boolean(metadata);
  }

  async get(cacheKey: string): Promise<AnalysisCacheEntry | null> {
    const cacheDir = this.getCacheDir(cacheKey);
    const metadata = await readJsonFile<AnalysisCacheMetadata | null>(
      path.join(cacheDir, "metadata.json"),
      null
    );
    if (!metadata) return null;

    return {
      metadata,
      issues: await readJsonFile<Issue[]>(path.join(cacheDir, "issues.json"), []),
      trace: await readJsonFile<AnalysisTraceArtifact | null>(
        path.join(cacheDir, "analysis-trace.json"),
        null
      ),
      contextMemory: await readJsonFile<DocumentContextMemory | null>(
        path.join(cacheDir, "context-memory.json"),
        null
      ),
    };
  }

  async findByFileHash(
    fileHash: string,
    predicate?: (metadata: AnalysisCacheMetadata) => boolean
  ): Promise<AnalysisCacheEntry | null> {
    try {
      const entries = await readdir(this.rootDir, { withFileTypes: true });
      const candidates: AnalysisCacheMetadata[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const metadata = await readJsonFile<AnalysisCacheMetadata | null>(
          path.join(this.rootDir, entry.name, "metadata.json"),
          null
        );
        if (!metadata || metadata.fileHash !== fileHash) continue;
        if (predicate && !predicate(metadata)) continue;
        candidates.push(metadata);
      }

      const newest = candidates.sort((left, right) =>
        String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt))
      )[0];
      return newest ? this.get(newest.cacheKey) : null;
    } catch {
      return null;
    }
  }

  async put(entry: AnalysisCacheEntry) {
    const cacheDir = this.getCacheDir(entry.metadata.cacheKey);
    const updatedAt = new Date().toISOString();
    const metadata = {
      ...entry.metadata,
      updatedAt,
    };

    await mkdir(cacheDir, { recursive: true });
    await writeJsonFile(path.join(cacheDir, "issues.json"), entry.issues);
    await writeJsonFile(path.join(cacheDir, "metadata.json"), metadata);
    if (entry.trace) {
      await writeJsonFile(path.join(cacheDir, "analysis-trace.json"), entry.trace);
    }
    if (entry.contextMemory) {
      await writeJsonFile(path.join(cacheDir, "context-memory.json"), entry.contextMemory);
      await writeJsonFile(path.join(cacheDir, "glossary.json"), entry.contextMemory.glossary);
      await writeJsonFile(path.join(cacheDir, "format-rules.json"), entry.contextMemory.formatRules);
    }
  }

  getChunkMetadataPath(cacheKey: string) {
    return path.join(this.getCacheDir(cacheKey), "chunk-metadata.json");
  }

  getChunkPath(cacheKey: string, chunkIndex: number) {
    return path.join(this.getCacheDir(cacheKey), "chunks", `chunk-${chunkIndex}.json`);
  }

  async getChunkMetadata(cacheKey: string) {
    return readJsonFile<CachedDocumentAnalysisMetadata | null>(
      this.getChunkMetadataPath(cacheKey),
      null
    );
  }

  async saveChunkMetadata(metadata: CachedDocumentAnalysisMetadata) {
    const cacheKey = metadata.cacheKey || metadata.fileHash;
    await writeJsonFile(this.getChunkMetadataPath(cacheKey), {
      ...metadata,
      cacheKey,
      updatedAt: new Date().toISOString(),
    });
  }

  async findChunkMetadataByFileHash(
    fileHash: string,
    predicate?: (metadata: CachedDocumentAnalysisMetadata) => boolean
  ) {
    try {
      const entries = await readdir(this.rootDir, { withFileTypes: true });
      const candidates: CachedDocumentAnalysisMetadata[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const metadata = await readJsonFile<CachedDocumentAnalysisMetadata | null>(
          path.join(this.rootDir, entry.name, "chunk-metadata.json"),
          null
        );
        if (!metadata || metadata.fileHash !== fileHash) continue;
        if (predicate && !predicate(metadata)) continue;
        candidates.push({ ...metadata, cacheKey: metadata.cacheKey || entry.name });
      }

      return candidates.sort((left, right) =>
        String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt))
      )[0] ?? null;
    } catch {
      return null;
    }
  }

  async getChunk(cacheKey: string, chunkIndex: number) {
    return readJsonFile<CachedChunkAnalysis | null>(
      this.getChunkPath(cacheKey, chunkIndex),
      null
    );
  }

  async saveChunk(cacheKey: string, chunk: CachedChunkAnalysis) {
    await writeJsonFile(this.getChunkPath(cacheKey, chunk.chunkIndex), chunk);
  }

  async getAllChunks(cacheKey: string) {
    const chunksDir = path.join(this.getCacheDir(cacheKey), "chunks");
    try {
      const entries = await readdir(chunksDir, { withFileTypes: true });
      const chunks = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map((entry) =>
            readJsonFile<CachedChunkAnalysis | null>(path.join(chunksDir, entry.name), null)
          )
      );
      return chunks
        .filter((chunk): chunk is CachedChunkAnalysis => Boolean(chunk))
        .sort((left, right) => left.chunkIndex - right.chunkIndex);
    } catch {
      return [];
    }
  }

  async clearChunkAnalysis(cacheKey: string) {
    await rm(path.join(this.getCacheDir(cacheKey), "chunks"), {
      recursive: true,
      force: true,
    });
    await rm(this.getChunkMetadataPath(cacheKey), { force: true });
  }
}
