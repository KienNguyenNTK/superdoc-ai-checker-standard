import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { BASE_URL, CUSTOM_DICTIONARY, FILES_ROOT, FRONTEND_ORIGIN, MODEL } from "./config.js";
import type { ReviewMode } from "./domain/types.js";
import { FileDocumentSessionStore } from "./services/storage/documentSessionStore.js";
import { DocumentReviewService } from "./services/review/documentReviewService.js";
import { exportIssuesCsv } from "./services/report/reportExporter.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});

const sessionStore = new FileDocumentSessionStore(FILES_ROOT);
const reviewService = new DocumentReviewService(sessionStore);

async function ensureDocFile(documentId: string, filename: string, buffer: Buffer) {
  const documentDir = sessionStore.getDocumentDir(documentId);
  await mkdir(documentDir, { recursive: true });
  const targetPath = path.join(documentDir, filename);
  await writeFile(targetPath, buffer);
  return targetPath;
}

function getFileUrl(documentId: string, fileName: string) {
  return `/files/documents/${documentId}/${fileName}`;
}

function jsonModeFromInput(value: unknown): ReviewMode {
  const raw = typeof value === "string" ? value : "comment_and_highlight";
  const allowed = new Set<ReviewMode>([
    "comment_only",
    "highlight_only",
    "track_changes",
    "comment_and_highlight",
    "track_changes_and_comment",
  ]);

  return allowed.has(raw as ReviewMode)
    ? (raw as ReviewMode)
    : "comment_and_highlight";
}

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: FRONTEND_ORIGIN,
    })
  );
  app.use(express.json());
  app.use("/files", express.static(path.resolve(FILES_ROOT, "..")));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      superdoc: "ready",
      llm: {
        baseURL: BASE_URL,
        model: MODEL,
      },
      dictionarySize: CUSTOM_DICTIONARY.length,
    });
  });

  app.post("/api/documents", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Thiếu file DOCX" });
      }

      if (!req.file.originalname.toLowerCase().endsWith(".docx")) {
        return res.status(400).json({ error: "Chỉ hỗ trợ file .docx" });
      }

      const documentId = `doc_${randomUUID().slice(0, 8)}`;
      const tempPath = await ensureDocFile(documentId, "upload.tmp", req.file.buffer);
      const originalPath = path.join(sessionStore.getDocumentDir(documentId), "original.docx");
      await rename(tempPath, originalPath);

      await sessionStore.create({
        documentId,
        originalFileName: req.file.originalname,
        originalPath,
      });

      return res.json({
        documentId,
        originalFileUrl: getFileUrl(documentId, "original.docx"),
        status: "uploaded",
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không upload được DOCX",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/analyze-spelling", async (req, res) => {
    try {
      const session = await reviewService.runReview({
        documentId: req.params.documentId,
        mode: jsonModeFromInput(req.body?.mode),
        highlightColor:
          typeof req.body?.highlightColor === "string" ? req.body.highlightColor : "yellow",
        maxIssues: Number(req.body?.maxIssues || 200),
        applyHighConfidence: Boolean(req.body?.applyHighConfidence),
      });

      return res.json({
        documentId: session.documentId,
        status: "reviewed",
        issues: session.issues,
        comments: session.comments,
        changes: session.changes,
        history: session.history,
        reviewedFileUrl: session.reviewedPath
          ? getFileUrl(session.documentId, path.basename(session.reviewedPath))
          : null,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Lỗi khi phân tích DOCX",
        detail: error?.message || String(error),
      });
    }
  });

  app.get("/api/documents/:documentId/issues/:issueId/focus", async (req, res) => {
    try {
      const session = await reviewService.requireSession(req.params.documentId);
      const issue = session.issues.find((candidate) => candidate.id === req.params.issueId);
      if (!issue) return res.status(404).json({ error: "Không tìm thấy issue" });
      return res.json({ issueId: issue.id, location: issue.location });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không lấy được focus data",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/issues/:issueId/apply", async (req, res) => {
    try {
      const session = await reviewService.applyIssue(req.params.documentId, req.params.issueId);
      return res.json({
        ok: true,
        issues: session.issues,
        changes: session.changes,
        reviewedFileUrl: session.reviewedPath
          ? getFileUrl(session.documentId, path.basename(session.reviewedPath))
          : null,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không apply được issue",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/issues/:issueId/ignore", async (req, res) => {
    try {
      const result = await reviewService.ignoreIssue(req.params.documentId, req.params.issueId);
      return res.json({
        ok: true,
        issues: result.session.issues,
        changes: result.session.changes,
        todos: result.todos,
        reviewedFileUrl: result.session.reviewedPath
          ? getFileUrl(result.session.documentId, path.basename(result.session.reviewedPath))
          : null,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không ignore được issue",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/issues/apply-high-confidence", async (req, res) => {
    try {
      const session = await reviewService.applyHighConfidence(req.params.documentId);
      return res.json({
        ok: true,
        issues: session.issues,
        changes: session.changes,
        reviewedFileUrl: session.reviewedPath
          ? getFileUrl(session.documentId, path.basename(session.reviewedPath))
          : null,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không apply được các issue confidence cao",
        detail: error?.message || String(error),
      });
    }
  });

  app.get("/api/documents/:documentId/comments", async (req, res) => {
    const session = await reviewService.requireSession(req.params.documentId);
    res.json({ comments: session.comments });
  });

  app.get("/api/documents/:documentId/changes", async (req, res) => {
    const session = await reviewService.requireSession(req.params.documentId);
    res.json({ changes: session.changes });
  });

  app.get("/api/documents/:documentId/history", async (req, res) => {
    const session = await reviewService.requireSession(req.params.documentId);
    res.json({ history: session.history });
  });

  app.get("/api/documents/:documentId/export", async (req, res) => {
    try {
      const session = await reviewService.requireSession(req.params.documentId);
      const type = String(req.query.type || "reviewed");

      if (type === "report-json") {
        return res.json({
          documentId: session.documentId,
          issues: session.issues,
          comments: session.comments,
          changes: session.changes,
        });
      }

      if (type === "report-csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(exportIssuesCsv(session.issues));
      }

      const fileMap = {
        original: session.originalPath,
        reviewed: session.reviewedPath || session.originalPath,
        final: session.finalPath || session.reviewedPath || session.originalPath,
      } as const;

      const filePath = fileMap[type as keyof typeof fileMap];
      if (!filePath) {
        return res.status(400).json({ error: "Export type không hợp lệ" });
      }

      session.history.push({
        id: `hist_${Date.now()}`,
        type: "exported",
        message: `Exported ${type}.docx`,
        createdAt: new Date().toISOString(),
      });
      await sessionStore.save(session);

      return res.download(filePath, `${type}.docx`);
    } catch (error: any) {
      return res.status(500).json({
        error: "Không export được file",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/ai-command", async (req, res) => {
    try {
      const session = await reviewService.runReview({
        documentId: req.params.documentId,
        mode: jsonModeFromInput(req.body?.mode),
        highlightColor:
          typeof req.body?.highlightColor === "string" ? req.body.highlightColor : "yellow",
      });

      return res.json({
        message: `Đã cập nhật ${session.issues.length} lỗi theo AI command.`,
        issues: session.issues,
        comments: session.comments,
        changes: session.changes,
        reviewedFileUrl: session.reviewedPath
          ? getFileUrl(session.documentId, path.basename(session.reviewedPath))
          : null,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "AI command thất bại",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/agents/:agentId/run", async (req, res) => {
    const agentModeMap: Record<string, string> = {
      "vietnamese-spelling-checker": "comment_and_highlight",
      "grammar-reviewer": "comment_only",
      "style-reviewer": "comment_only",
      "legal-reviewer": "comment_only",
      "contract-risk-reviewer": "comment_only",
      "format-cleaner": "track_changes",
      "table-formatter": "comment_only",
      "summary-agent": "comment_only",
    };

    try {
      const session = await reviewService.runReview({
        documentId: req.params.documentId,
        mode: jsonModeFromInput(agentModeMap[req.params.agentId]),
        highlightColor: "yellow",
      });

      return res.json({
        agentId: req.params.agentId,
        issues: session.issues,
        comments: session.comments,
        changes: session.changes,
        reviewedFileUrl: session.reviewedPath
          ? getFileUrl(session.documentId, path.basename(session.reviewedPath))
          : null,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Agent run thất bại",
        detail: error?.message || String(error),
      });
    }
  });

  return app;
}
