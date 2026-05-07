import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnalysisCacheMetadata,
  AnalysisTraceArtifact,
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
}
