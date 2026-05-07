import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";
import {
  BASE_URL,
  CUSTOM_DICTIONARY,
  DEFAULT_MAX_ISSUES,
  FILES_ROOT,
  FRONTEND_ORIGIN,
  MODEL,
  PROMPTS_DIR,
} from "./config.js";
import type { AnalyzeConsistencyRequest, ReviewMode } from "./domain/types.js";
import { FileDocumentSessionStore } from "./services/storage/documentSessionStore.js";
import { DocumentReviewService } from "./services/review/documentReviewService.js";
import { exportIssuesCsv } from "./services/report/reportExporter.js";
import { PromptTemplateService } from "./prompts/promptTemplateService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});

const sessionStore = new FileDocumentSessionStore(FILES_ROOT);
const reviewService = new DocumentReviewService(sessionStore);
const promptService = new PromptTemplateService(PROMPTS_DIR);

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

function normalizeAnalyzeRequest(body: any): AnalyzeConsistencyRequest {
  return {
    checks: Array.isArray(body?.checks) && body.checks.length > 0
      ? body.checks
      : ["spelling", "format", "terminology", "translation", "tone", "entity", "date_number"],
    mode: jsonModeFromInput(body?.mode),
    useLLM: body?.useLLM !== false,
    useRuleEngine: body?.useRuleEngine !== false,
    maxIssues: Number(body?.maxIssues || DEFAULT_MAX_ISSUES),
  };
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

  app.post("/api/documents/:documentId/build-context", async (req, res) => {
    try {
      const memory = await reviewService.buildContext(req.params.documentId);
      return res.json({
        documentId: req.params.documentId,
        status: "context_built",
        summary: {
          terms: memory.glossary.length,
          formatRules: memory.formatRules.length,
          toneRules: memory.toneRules.length,
          entities: memory.entityRules.length,
        },
        contextMemoryUrl: getFileUrl(req.params.documentId, "context-memory.json"),
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không build được context memory",
        detail: error?.message || String(error),
      });
    }
  });

  app.get("/api/documents/:documentId/context", async (req, res) => {
    try {
      const context = await reviewService.getContext(req.params.documentId);
      return res.json({ context });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không lấy được context memory",
        detail: error?.message || String(error),
      });
    }
  });

  app.put("/api/documents/:documentId/glossary", async (req, res) => {
    try {
      const glossary = await reviewService.updateGlossary(req.params.documentId, req.body?.glossary || []);
      return res.json({ glossary });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không cập nhật được glossary",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/analyze-spelling", async (req, res) => {
    try {
      const result = await reviewService.runReview({
        documentId: req.params.documentId,
        mode: jsonModeFromInput(req.body?.mode),
        highlightColor:
          typeof req.body?.highlightColor === "string" ? req.body.highlightColor : "yellow",
        maxIssues: Number(req.body?.maxIssues || 200),
        applyHighConfidence: Boolean(req.body?.applyHighConfidence),
      });

      return res.json({
        documentId: result.session.documentId,
        status: "reviewed",
        issues: result.session.issues,
        comments: result.session.comments,
        changes: result.session.changes,
        history: result.session.history,
        todos: result.todos,
        reviewedFileUrl: result.session.reviewedPath
          ? getFileUrl(result.session.documentId, path.basename(result.session.reviewedPath))
          : null,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Lỗi khi phân tích DOCX",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/analyze-consistency", async (req, res) => {
    try {
      const result = await reviewService.runConsistencyAnalysis({
        documentId: req.params.documentId,
        request: normalizeAnalyzeRequest(req.body),
      });

      return res.json({
        documentId: result.session.documentId,
        status: "reviewed",
        issues: result.session.issues,
        comments: result.session.comments,
        changes: result.session.changes,
        history: result.session.history,
        todos: result.todos,
        context: result.contextMemory,
        reviewedFileUrl: result.session.reviewedPath
          ? getFileUrl(result.session.documentId, path.basename(result.session.reviewedPath))
          : null,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Lỗi khi kiểm tra consistency",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/documents/:documentId/analyze-selection", async (req, res) => {
    try {
      const issues = await reviewService.analyzeSelection(
        req.params.documentId,
        req.body?.selection,
        req.body?.checks || ["spelling", "format"]
      );
      return res.json({ issues });
    } catch (error: any) {
      return res.status(500).json({
        error: "Không analyze được selection",
        detail: error?.message || String(error),
      });
    }
  });

  app.get("/api/prompts", async (_req, res) => {
    try {
      res.json({ prompts: await promptService.listPrompts() });
    } catch (error: any) {
      res.status(500).json({
        error: "Không lấy được danh sách prompts",
        detail: error?.message || String(error),
      });
    }
  });

  app.get("/api/prompts/:promptId", async (req, res) => {
    try {
      res.json({ prompt: await promptService.getPrompt(req.params.promptId) });
    } catch (error: any) {
      res.status(404).json({
        error: "Không tìm thấy prompt",
        detail: error?.message || String(error),
      });
    }
  });

  app.put("/api/prompts/:promptId", async (req, res) => {
    try {
      res.json({
        prompt: await promptService.saveOverride(req.params.promptId, {
          system: req.body?.system,
          userTemplate: req.body?.userTemplate,
          defaultModelOptions: req.body?.defaultModelOptions,
        }),
      });
    } catch (error: any) {
      res.status(500).json({
        error: "Không lưu được prompt override",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/prompts/:promptId/test", async (req, res) => {
    try {
      res.json({
        result: await promptService.testPrompt(req.params.promptId, req.body?.variables || {}, {
          sampleOutput: req.body?.sampleOutput,
          runModel: Boolean(req.body?.runModel),
        }),
      });
    } catch (error: any) {
      res.status(500).json({
        error: "Không test được prompt",
        detail: error?.message || String(error),
      });
    }
  });

  app.post("/api/prompts/:promptId/reset", async (req, res) => {
    try {
      res.json({ prompt: await promptService.resetOverride(req.params.promptId) });
    } catch (error: any) {
      res.status(500).json({
        error: "Không reset được prompt",
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
      const result = await reviewService.applyIssue(req.params.documentId, req.params.issueId);
      return res.json({
        ok: true,
        issues: result.session.issues,
        changes: result.session.changes,
        todos: result.todos,
        appliedIssueId: req.params.issueId,
        appliedIssueLocation: result.session.issues.find((candidate) => candidate.id === req.params.issueId)?.location,
        reviewedFileUrl: result.session.reviewedPath
          ? getFileUrl(result.session.documentId, path.basename(result.session.reviewedPath))
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
      const result = await reviewService.runConsistencyAnalysis({
        documentId: req.params.documentId,
        request: normalizeAnalyzeRequest({
          ...req.body,
          checks: ["spelling", "format", "terminology", "translation", "tone", "entity"],
        }),
      });

      return res.json({
        message: `Đã cập nhật ${result.session.issues.length} lỗi theo AI command.`,
        issues: result.session.issues,
        comments: result.session.comments,
        changes: result.session.changes,
        todos: result.todos,
        reviewedFileUrl: result.session.reviewedPath
          ? getFileUrl(result.session.documentId, path.basename(result.session.reviewedPath))
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
    const agentChecksMap: Record<string, AnalyzeConsistencyRequest["checks"]> = {
      "vietnamese-spelling-checker": ["spelling"],
      "format-consistency-checker": ["format"],
      "terminology-consistency-checker": ["terminology"],
      "translation-consistency-checker": ["translation"],
      "tone-consistency-checker": ["tone"],
      "entity-name-consistency-checker": ["entity"],
      "full-document-consistency-checker": ["spelling", "format", "terminology", "translation", "tone", "entity", "date_number"],
      "grammar-reviewer": ["spelling"],
      "style-reviewer": ["tone"],
      "format-cleaner": ["format"],
    };

    try {
      const result = await reviewService.runConsistencyAnalysis({
        documentId: req.params.documentId,
        request: normalizeAnalyzeRequest({
          mode: req.params.agentId === "format-cleaner" ? "track_changes" : "comment_and_highlight",
          checks: agentChecksMap[req.params.agentId] || ["spelling"],
        }),
      });

      return res.json({
        agentId: req.params.agentId,
        issues: result.session.issues,
        comments: result.session.comments,
        changes: result.session.changes,
        todos: result.todos,
        reviewedFileUrl: result.session.reviewedPath
          ? getFileUrl(result.session.documentId, path.basename(result.session.reviewedPath))
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
