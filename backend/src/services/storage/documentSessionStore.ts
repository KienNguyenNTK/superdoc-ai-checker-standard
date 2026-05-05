import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentSession, HistoryRecord } from "../../domain/types.js";

type CreateDocumentSessionInput = {
  documentId: string;
  originalFileName: string;
  originalPath: string;
};

function nowIso() {
  return new Date().toISOString();
}

function createHistoryRecord(message: string): HistoryRecord {
  return {
    id: `hist_${Date.now()}`,
    type: "imported",
    message,
    createdAt: nowIso(),
  };
}

export class FileDocumentSessionStore {
  constructor(private readonly rootDir: string) {}

  async create(input: CreateDocumentSessionInput): Promise<DocumentSession> {
    await mkdir(this.rootDir, { recursive: true });

    const session: DocumentSession = {
      documentId: input.documentId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      originalFileName: input.originalFileName,
      originalPath: input.originalPath,
      issues: [],
      comments: [],
      changes: [],
      history: [createHistoryRecord(`Imported DOCX ${input.originalFileName}`)],
    };

    await this.save(session);
    return session;
  }

  async get(documentId: string): Promise<DocumentSession | null> {
    try {
      const raw = await readFile(this.getMetaPath(documentId), "utf8");
      return JSON.parse(raw) as DocumentSession;
    } catch {
      return null;
    }
  }

  async save(session: DocumentSession) {
    const dirPath = this.getDocumentDir(session.documentId);
    await mkdir(dirPath, { recursive: true });

    session.updatedAt = nowIso();
    await writeFile(this.getMetaPath(session.documentId), JSON.stringify(session, null, 2));
  }

  getDocumentDir(documentId: string) {
    return path.join(this.rootDir, documentId);
  }

  getMetaPath(documentId: string) {
    return path.join(this.getDocumentDir(documentId), "session.json");
  }
}
