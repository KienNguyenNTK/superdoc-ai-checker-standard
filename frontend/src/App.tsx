import { startTransition, useMemo, useRef, useState } from "react";
import {
  analyzeDocument,
  analyzeDocumentChunk,
  annotateIssueBatch,
  annotateIssues,
  applyHighConfidence,
  applyIssue,
  buildContext,
  createAnalysisSession,
  focusIssue,
  getAnalysisTrace,
  getApiHealth,
  getContext,
  getExportUrl,
  getPrompt,
  ignoreIssue,
  listPrompts,
  openIssueWindow,
  resetPrompt,
  runAgent,
  runAiCommand,
  savePrompt,
  testPrompt,
  updateGlossary,
  uploadDocument,
} from "./lib/api";
import type { ChunkAnalyzeBody } from "./lib/api";
import type {
  AnalysisSummary,
  AnalysisCacheInfo,
  AnalysisProgress,
  AnalysisSessionResponse,
  AnalysisTraceArtifact,
  AnalysisTraceSummary,
  AgentOption,
  CachedChunkAnalysis,
  CachedDocumentAnalysisMetadata,
  ChangeRecord,
  ClientTraceEvent,
  CommentRecord,
  DocumentContextMemory,
  DocumentMode,
  HistoryRecord,
  Issue,
  IssueAnnotationWindow,
  IssueLocation,
  IssueFilter,
  PageChunk,
  PromptTemplate,
  ReviewMode,
  ReviewResponse,
  ReviewTab,
  UploadedDocument,
} from "./types";
import { useEffect } from "react";
import { AppTopBar } from "./components/layout/AppTopBar";
import { DocumentToolbar } from "./components/document/DocumentToolbar";
import {
  SuperDocWorkspace,
  type SuperDocWorkspaceHandle,
} from "./components/document/SuperDocWorkspace";
import { ReviewSidebar } from "./components/review/ReviewSidebar";
import { AiCommandBar } from "./components/ai/AiCommandBar";
import { vi } from "./i18n";
import pkg from "../package.json";
import { ContextMemoryPanel } from "./components/review/ContextMemoryPanel";
import { PromptSettingsPanel } from "./components/review/PromptSettingsPanel";
import { TraceDebugPanel } from "./components/review/TraceDebugPanel";

const TOOLBAR_ID = "superdoc-toolbar-surface";
const COMMENTS_ID = "superdoc-comments-surface";
const ISSUE_RAIL_BATCH_SIZE = 500;
const ANALYSIS_PAGE_SIZE = 20;

const AGENTS: AgentOption[] = [
  {
    id: "vietnamese-spelling-checker",
    ...vi.agents.byId["vietnamese-spelling-checker"],
    defaultMode: "comment_and_highlight",
    checks: ["spelling"],
  },
  {
    id: "format-consistency-checker",
    ...vi.agents.byId["format-consistency-checker"],
    defaultMode: "comment_and_highlight",
    checks: ["format"],
  },
  {
    id: "terminology-consistency-checker",
    ...vi.agents.byId["terminology-consistency-checker"],
    defaultMode: "comment_and_highlight",
    checks: ["terminology"],
  },
  {
    id: "translation-consistency-checker",
    ...vi.agents.byId["translation-consistency-checker"],
    defaultMode: "comment_and_highlight",
    checks: ["translation"],
  },
  {
    id: "tone-consistency-checker",
    ...vi.agents.byId["tone-consistency-checker"],
    defaultMode: "comment_only",
    checks: ["tone"],
  },
  {
    id: "entity-name-consistency-checker",
    ...vi.agents.byId["entity-name-consistency-checker"],
    defaultMode: "comment_and_highlight",
    checks: ["entity"],
  },
  {
    id: "full-document-consistency-checker",
    ...vi.agents.byId["full-document-consistency-checker"],
    defaultMode: "comment_and_highlight",
    checks: ["spelling", "format", "terminology", "translation", "tone", "entity", "date_number"],
  },
];

function buildChunkRequest(
  mode: ReviewMode,
  traceEnabled: boolean,
  options: { forceReanalyze?: boolean; useCache?: boolean; chunkIndex?: number; retry?: boolean } = {}
): ChunkAnalyzeBody {
  return {
    mode,
    checks: ["spelling", "format", "terminology", "translation", "tone", "entity", "date_number"],
    debugTrace: traceEnabled,
    useCache: options.useCache ?? true,
    forceReanalyze: Boolean(options.forceReanalyze),
    pageSize: ANALYSIS_PAGE_SIZE,
    chunkIndex: options.chunkIndex,
    retry: options.retry,
    maxIssues: 5000,
    maxAnnotatedIssues: 5000,
    maxReturnedIssues: Number.MAX_SAFE_INTEGER,
  };
}

function mergeResponse(
  previous: {
    comments: CommentRecord[];
    changes: ChangeRecord[];
    history: HistoryRecord[];
    issues: Issue[];
    annotatedIssues?: Issue[];
    summary?: AnalysisSummary | null;
    traceEnabled?: boolean;
    traceSummary?: AnalysisTraceSummary | null;
    traceFileUrl?: string | null;
    cacheInfo?: AnalysisCacheInfo | null;
    activeIssueWindow?: IssueAnnotationWindow | null;
  },
  next: ReviewResponse
) {
  const nextTraceEnabled = next.traceEnabled ?? previous.traceEnabled ?? false;
  return {
    issues: next.issues || previous.issues,
    annotatedIssues: next.annotatedIssues || previous.annotatedIssues || [],
    comments: next.comments || previous.comments,
    changes: next.changes || previous.changes,
    history: next.history || previous.history,
    reviewedFileUrl: next.reviewedFileUrl || null,
    context: next.context || null,
    summary: next.summary || previous.summary || null,
    traceEnabled: nextTraceEnabled,
    traceSummary: nextTraceEnabled ? next.traceSummary || previous.traceSummary || null : null,
    traceFileUrl: nextTraceEnabled ? next.traceFileUrl || previous.traceFileUrl || null : null,
    cacheInfo: next.cacheInfo || previous.cacheInfo || null,
    activeIssueWindow: Object.prototype.hasOwnProperty.call(next, "activeIssueWindow")
      ? next.activeIssueWindow ?? null
      : previous.activeIssueWindow || null,
  };
}

function buildTraceInsightLabel(
  traceSummary: AnalysisTraceSummary | null,
  clientEvents: ClientTraceEvent[],
  activeIssueWindow?: IssueAnnotationWindow | null
) {
  if (!traceSummary) return null;
  if (activeIssueWindow) {
    return `Trace: batch ${(activeIssueWindow.startIndex + 1).toLocaleString("vi-VN")}-${activeIssueWindow.endIndex.toLocaleString("vi-VN")} đã nạp vào DOCX / ${activeIssueWindow.totalIssues.toLocaleString("vi-VN")}`;
  }
  const focusFailures = clientEvents.filter((event) => event.decision === "focus_display_failed").length;
  if (
    traceSummary.returnedToUi > 0 &&
    traceSummary.annotatedInDocx === 0 &&
    traceSummary.droppedByBudget >= traceSummary.returnedToUi
  ) {
    return `Trace: ${traceSummary.returnedToUi.toLocaleString("vi-VN")} issue sẵn sàng, chưa mở batch DOCX`;
  }
  if (traceSummary.droppedByBudget > 0) {
    return `Trace: ${traceSummary.droppedByBudget.toLocaleString("vi-VN")} issue chưa nạp vào batch DOCX`;
  }
  if (traceSummary.rangeNotFound > 0) {
    return `Trace: ${traceSummary.rangeNotFound.toLocaleString("vi-VN")} lỗi không map được vị trí`;
  }
  if (traceSummary.skippedAnnotation > 0) {
    return `Trace: ${traceSummary.skippedAnnotation.toLocaleString("vi-VN")} lỗi không annotate được`;
  }
  if (focusFailures > 0) {
    return `Trace: ${focusFailures.toLocaleString("vi-VN")} lần focus/display lỗi`;
  }
  return `Trace: detector ${traceSummary.detectedByDetector.toLocaleString("vi-VN")} -> UI ${traceSummary.returnedToUi.toLocaleString("vi-VN")}`;
}

export default function App() {
  const workspaceRef = useRef<SuperDocWorkspaceHandle>(null);
  const [currentDocument, setCurrentDocument] = useState<UploadedDocument | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [mode, setMode] = useState<DocumentMode>("suggesting");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [modelName, setModelName] = useState("gpt-4o-mini");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [annotatedIssues, setAnnotatedIssues] = useState<Issue[]>([]);
  const [issueRailStartIndex, setIssueRailStartIndex] = useState(0);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [traceEnabled, setTraceEnabled] = useState(true);
  const [traceSummary, setTraceSummary] = useState<AnalysisTraceSummary | null>(null);
  const [traceFileUrl, setTraceFileUrl] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<AnalysisCacheInfo | null>(null);
  const [analysisMetadata, setAnalysisMetadata] = useState<CachedDocumentAnalysisMetadata | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [pageChunks, setPageChunks] = useState<PageChunk[]>([]);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number | null>(null);
  const [issuesByChunk, setIssuesByChunk] = useState<Record<number, Issue[]>>({});
  const [activeIssueWindow, setActiveIssueWindow] = useState<IssueAnnotationWindow | null>(null);
  const [traceData, setTraceData] = useState<AnalysisTraceArtifact | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [clientTraceEvents, setClientTraceEvents] = useState<ClientTraceEvent[]>([]);
  const [hasReviewResult, setHasReviewResult] = useState(false);
  const [applyingIssueId, setApplyingIssueId] = useState<string | null>(null);
  const [loadingIssueBatch, setLoadingIssueBatch] = useState(false);
  const [pendingFocusLocation, setPendingFocusLocation] = useState<IssueLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [analysisElapsedMs, setAnalysisElapsedMs] = useState(0);
  const [lastAnalysisDurationMs, setLastAnalysisDurationMs] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ReviewTab>("issues");
  const [activeFilter, setActiveFilter] = useState<IssueFilter>("all");
  const [chatVisible, setChatVisible] = useState(false);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [command, setCommand] = useState<string>(vi.app.defaultAiCommand);
  const [reviewMode, setReviewMode] =
    useState<ReviewMode>("comment_and_highlight");
  const [currentAgentId, setCurrentAgentId] = useState(AGENTS[0].id);
  const [todoNotes, setTodoNotes] = useState<string[]>([]);
  const [contextMemory, setContextMemory] = useState<DocumentContextMemory | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [rightPanel, setRightPanel] = useState<"review" | "context" | "prompts" | "trace">("review");

  function pushClientTraceEvent(event: Omit<ClientTraceEvent, "id" | "createdAt">) {
    setClientTraceEvents((current) => [
      ...current.slice(-59),
      {
        id: `client_trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        ...event,
      },
    ]);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!isAnalyzing || !analysisStartedAt) return;

    setAnalysisElapsedMs(Date.now() - analysisStartedAt);
    const timer = window.setInterval(() => {
      setAnalysisElapsedMs(Date.now() - analysisStartedAt);
    }, 100);

    return () => window.clearInterval(timer);
  }, [isAnalyzing, analysisStartedAt]);

  useEffect(() => {
    if (!pendingFocusLocation || !documentUrl) return;

    let cancelled = false;
    const delays = [120, 260, 520, 900, 1400, 2100, 3200, 4600];
    const timers: number[] = [];

    delays.forEach((ms) => {
      timers.push(
        window.setTimeout(async () => {
          if (cancelled) return;
          const ok = (await workspaceRef.current?.focusIssue(pendingFocusLocation)) ?? false;
          if (ok && !cancelled) setPendingFocusLocation(null);
        }, ms)
      );
    });

    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id));
    };
  }, [pendingFocusLocation, documentUrl, documentVersion]);

  useEffect(() => {
    getApiHealth()
      .then((health) => {
        setApiStatus("online");
        setModelName(health.llm.model);
      })
      .catch(() => setApiStatus("offline"));

    void listPrompts()
      .then((response) => setPrompts(response.prompts))
      .catch(() => undefined);
  }, []);

  const exportActions = useMemo(() => {
    if (!currentDocument) return [];
    return [
      { key: "original", label: vi.export.original, href: getExportUrl(currentDocument.documentId, "original") },
      { key: "reviewed", label: vi.export.reviewed, href: getExportUrl(currentDocument.documentId, "reviewed") },
      { key: "final", label: vi.export.final, href: getExportUrl(currentDocument.documentId, "final") },
      { key: "report-json", label: vi.export.reportJson, href: getExportUrl(currentDocument.documentId, "report-json") },
      { key: "report-csv", label: vi.export.reportCsv, href: getExportUrl(currentDocument.documentId, "report-csv") },
      { key: "client-export", label: vi.export.clientSnapshot, onClick: () => workspaceRef.current?.exportDocument() },
    ];
  }, [currentDocument]);

  const analysisDurationLabel = useMemo(() => {
    const durationMs = isAnalyzing ? analysisElapsedMs : lastAnalysisDurationMs;
    if (!durationMs || durationMs < 0) return null;

    const totalSeconds = durationMs / 1000;
    return totalSeconds >= 10
      ? `${totalSeconds.toFixed(1)} giây`
      : `${totalSeconds.toFixed(2)} giây`;
  }, [analysisElapsedMs, isAnalyzing, lastAnalysisDurationMs]);
  const traceInsightLabel = useMemo(
    () => buildTraceInsightLabel(traceSummary, clientTraceEvents, activeIssueWindow),
    [activeIssueWindow, clientTraceEvents, traceSummary]
  );

  async function refreshContext(documentId: string) {
    const loaded = await getContext(documentId);
    setContextMemory(loaded.context);
  }

  async function handleUpload(file: File) {
    setLoading(true);
    try {
      const uploaded = await uploadDocument(file);
      startTransition(() => {
        setCurrentDocument(uploaded);
        setDocumentUrl(uploaded.originalFileUrl);
        setIssues([]);
        setComments([]);
        setChanges([]);
        setHistory([]);
        setAnnotatedIssues([]);
        setIssueRailStartIndex(0);
        setAnalysisSummary(null);
        setHasReviewResult(false);
        setTodoNotes([]);
        setContextMemory(null);
        setTraceSummary(null);
        setTraceFileUrl(null);
        setTraceData(null);
        setCacheInfo(null);
        setAnalysisMetadata(null);
        setAnalysisProgress(null);
        setPageChunks([]);
        setActiveChunkIndex(null);
        setIssuesByChunk({});
        setActiveIssueWindow(null);
        setClientTraceEvents([]);
        setTraceEnabled(true);
        setDocumentVersion((value) => value + 1);
      });
      const session = await createAnalysisSession(
        uploaded.documentId,
        buildChunkRequest(reviewMode, traceEnabled, { useCache: true })
      );
      applyAnalysisSessionState(session);
      const completedChunk = session.chunks.find((chunk) => chunk.status === "completed");
      if (completedChunk) {
        const response = await analyzeDocumentChunk(
          uploaded.documentId,
          buildChunkRequest(reviewMode, traceEnabled, {
            useCache: true,
            chunkIndex: completedChunk.chunkIndex,
          })
        );
        applyChunkState(response);
        setRightPanel("review");
        setReviewPanelOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function applyReviewState(next: ReviewResponse) {
    startTransition(() => {
      const merged = mergeResponse({
        issues,
        annotatedIssues,
        comments,
        changes,
        history,
        summary: analysisSummary,
        traceEnabled,
        traceSummary,
        traceFileUrl,
        cacheInfo,
        activeIssueWindow,
      }, next);
      setIssues(merged.issues);
      setAnnotatedIssues(merged.annotatedIssues);
      setComments(merged.comments);
      setChanges(merged.changes);
      setHistory(merged.history);
      setAnalysisSummary(merged.summary);
      setTraceEnabled(merged.traceEnabled);
      setTraceSummary(merged.traceSummary);
      setTraceFileUrl(merged.traceFileUrl);
      setCacheInfo(merged.cacheInfo);
      setActiveIssueWindow(merged.activeIssueWindow);
      if (merged.activeIssueWindow) {
        setIssueRailStartIndex(merged.activeIssueWindow.startIndex);
      }
      if (!merged.traceEnabled) {
        setTraceData(null);
      }
      setTodoNotes(next.todos || []);
      if (merged.context) setContextMemory(merged.context);
      if (merged.reviewedFileUrl) {
        setDocumentUrl(`${merged.reviewedFileUrl}?v=${Date.now()}`);
        setDocumentVersion((value) => value + 1);
      }
    });
    pushClientTraceEvent({
      stage: "client",
      decision: "apply_review_state",
      detail: `response issues=${next.issues?.length ?? 0}, summary selected=${next.summary?.selectedIssues ?? "n/a"}, traceEnabled=${String(next.traceEnabled ?? false)}`,
    });
  }

  function applyAnalysisSessionState(session: AnalysisSessionResponse) {
    startTransition(() => {
      setAnalysisMetadata(session.metadata);
      setAnalysisProgress(session.progress);
      setPageChunks(session.chunks);
      setCacheInfo((current) => current || null);
    });
  }

  function applyChunkState(response: {
    metadata: CachedDocumentAnalysisMetadata;
    chunk: CachedChunkAnalysis | null;
    progress: AnalysisProgress;
    reviewedFileUrl?: string | null;
    activeIssueWindow?: IssueAnnotationWindow | null;
    issues: Issue[];
    annotatedIssues?: Issue[];
  }) {
    startTransition(() => {
      setAnalysisMetadata(response.metadata);
      setAnalysisProgress(response.progress);
      setPageChunks(response.metadata.chunks || []);
      if (response.chunk) {
        setActiveChunkIndex(response.chunk.chunkIndex);
        setIssues(response.chunk.issues);
        setAnnotatedIssues(response.annotatedIssues || response.chunk.issues);
        setIssuesByChunk((current) => ({
          ...current,
          [response.chunk!.chunkIndex]: response.chunk!.issues,
        }));
        setHasReviewResult(true);
        setActiveIssueWindow(response.activeIssueWindow ?? {
          startIndex: response.chunk.chunkIndex,
          count: 1,
          endIndex: response.chunk.chunkIndex + 1,
          totalIssues: response.chunk.issues.length,
          issueIds: response.chunk.issues.map((issue) => issue.id),
          reviewedFileName: response.reviewedFileUrl || undefined,
          createdAt: new Date().toISOString(),
        });
      }
      if (response.reviewedFileUrl) {
        setDocumentUrl(`${response.reviewedFileUrl}?v=${Date.now()}`);
        setDocumentVersion((value) => value + 1);
      }
    });
  }

  async function refreshTrace(documentId: string) {
    setTraceLoading(true);
    try {
      const response = await getAnalysisTrace(documentId);
      setTraceEnabled(response.traceEnabled);
      setTraceSummary(response.traceSummary ?? null);
      setTraceFileUrl(response.traceFileUrl ?? null);
      setTraceData(response.trace ?? null);
      pushClientTraceEvent({
        stage: "client",
        decision: "trace_refreshed",
        detail: `traceEnabled=${String(response.traceEnabled)}, issues=${response.trace?.issues.length ?? 0}`,
      });
    } catch (error: any) {
      pushClientTraceEvent({
        stage: "client",
        decision: "trace_refresh_failed",
        detail: error?.message || String(error),
      });
      throw error;
    } finally {
      setTraceLoading(false);
    }
  }

  async function handleAnalyze(options: { forceReanalyze?: boolean; useCache?: boolean } = {}) {
    if (!currentDocument) return;
    setLoading(true);
    const startedAt = Date.now();
    setIsAnalyzing(true);
    setAnalysisStartedAt(startedAt);
    setAnalysisElapsedMs(0);
    setLastAnalysisDurationMs(null);
    try {
      const session = await createAnalysisSession(
        currentDocument.documentId,
        buildChunkRequest(reviewMode, traceEnabled, options)
      );
      applyAnalysisSessionState(session);
      setRightPanel("review");
      setReviewPanelOpen(true);

      const chunksToAnalyze = session.chunks.filter((chunk) =>
        options.forceReanalyze ? true : chunk.status !== "completed"
      );
      const queue = chunksToAnalyze.length > 0 ? chunksToAnalyze : session.chunks;

      for (const chunk of queue) {
        const response = await analyzeDocumentChunk(
          currentDocument.documentId,
          buildChunkRequest(reviewMode, traceEnabled, {
            ...options,
            chunkIndex: chunk.chunkIndex,
            retry: chunk.status === "failed",
          })
        );
        applyChunkState(response);
      }
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
    } finally {
      const finishedAt = Date.now();
      setIsAnalyzing(false);
      setAnalysisStartedAt(null);
      setAnalysisElapsedMs(0);
      setLastAnalysisDurationMs(finishedAt - startedAt);
      setLoading(false);
    }
  }

  async function handleBuildContext() {
    if (!currentDocument) return;
    setLoading(true);
    try {
      await buildContext(currentDocument.documentId);
      await refreshContext(currentDocument.documentId);
      setRightPanel("context");
      setReviewPanelOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyHighConfidence() {
    if (!currentDocument) return;
    setLoading(true);
    try {
      const response = await applyHighConfidence(currentDocument.documentId);
      applyReviewState(response);
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnnotateMore(count: number) {
    if (!currentDocument) return;
    setLoading(true);
    try {
      const response = await annotateIssues(currentDocument.documentId, {
        mode: reviewMode,
        count,
      });
      applyReviewState(response);
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
    } finally {
      setLoading(false);
    }
  }

  async function openIssueBatchAt(startIndex: number, count = ISSUE_RAIL_BATCH_SIZE) {
    if (!currentDocument) throw new Error("No document is loaded");
    setLoadingIssueBatch(true);
    try {
      const response = await annotateIssueBatch(currentDocument.documentId, {
        mode: reviewMode,
        startIndex,
        count,
      });
      pushClientTraceEvent({
        stage: "client",
        decision: "opened_issue_batch",
        detail: `startIndex=${startIndex}, count=${count}, annotated=${response.annotatedIssues?.length ?? 0}`,
      });
      return response;
    } finally {
      setLoadingIssueBatch(false);
    }
  }

  async function handleOpenIssueBatch(startIndex: number, count = ISSUE_RAIL_BATCH_SIZE) {
    if (!currentDocument) return;
    setLoading(true);
    try {
      const response = await openIssueBatchAt(startIndex, count);
      applyReviewState(response);
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenChunk(chunkIndex: number, retry = false) {
    if (!currentDocument) return;
    setLoadingIssueBatch(true);
    try {
      const response = await analyzeDocumentChunk(
        currentDocument.documentId,
        buildChunkRequest(reviewMode, traceEnabled, {
          useCache: true,
          chunkIndex,
          retry,
        })
      );
      applyChunkState(response);
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
      setReviewPanelOpen(true);
    } finally {
      setLoadingIssueBatch(false);
    }
  }

  async function handleAnnotateAll() {
    if (!currentDocument) return;
    setLoading(true);
    try {
      const response = await annotateIssues(currentDocument.documentId, {
        mode: reviewMode,
        all: true,
      });
      applyReviewState(response);
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnnotateIssue(issue: Issue) {
    if (!currentDocument) return;
    setApplyingIssueId(issue.id);
    try {
      const response = await annotateIssues(currentDocument.documentId, {
        mode: reviewMode,
        issueIds: [issue.id],
        count: 1,
      });
      applyReviewState(response);
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
    } finally {
      setApplyingIssueId(null);
    }
  }

  async function handleRunAgent() {
    if (!currentDocument) return;
    setLoading(true);
    try {
      const response = await runAgent(currentDocument.documentId, currentAgentId, traceEnabled);
      applyReviewState(response);
      if (response.traceEnabled) {
        await refreshTrace(currentDocument.documentId).catch(() => undefined);
        setRightPanel("trace");
        setReviewPanelOpen(true);
      }
      setHasReviewResult(true);
      setActiveTab("issues");
    } finally {
      setLoading(false);
    }
  }

  async function handleAiCommand() {
    if (!currentDocument || !command.trim()) return;
    setLoading(true);
    try {
      const response = await runAiCommand(
        currentDocument.documentId,
        command,
        reviewMode,
        traceEnabled
      );
      applyReviewState(response);
      if (response.traceEnabled) {
        await refreshTrace(currentDocument.documentId).catch(() => undefined);
        setRightPanel("trace");
        setReviewPanelOpen(true);
      }
      setHasReviewResult(true);
      setActiveTab("issues");
    } finally {
      setLoading(false);
    }
  }

  async function handleFocusIssue(issue: Issue) {
    if (!currentDocument) return;
    const isInActiveWindow = Boolean(activeIssueWindow?.issueIds.includes(issue.id));
    if (!isInActiveWindow && issues.length > 0) {
      setApplyingIssueId(issue.id);
      try {
        const response = await openIssueWindow(currentDocument.documentId, issue.id, {
          mode: reviewMode,
          count: 500,
        });
        const annotatedIssue = response.annotatedIssues?.find((candidate) => candidate.id === issue.id);
        const fullIssue = response.issues.find((candidate) => candidate.id === issue.id);
        const focusLocation = response.focusIssueLocation || annotatedIssue?.location || fullIssue?.location || issue.location;
        setPendingFocusLocation(focusLocation);
        applyReviewState(response);
        setHasReviewResult(true);
        setActiveTab("issues");
        setRightPanel("review");
        pushClientTraceEvent({
          stage: "client",
          decision: "opened_issue_batch_for_focus",
          detail: `issueId=${issue.id}`,
          issueId: issue.id,
        });
        return;
      } finally {
        setApplyingIssueId(null);
      }
    }
    const focusData = await focusIssue(currentDocument.documentId, issue.id);
    const ok = await workspaceRef.current?.focusIssue(focusData.location);
    pushClientTraceEvent({
      stage: "client",
      decision: ok ? "focus_display_success" : "focus_display_failed",
      detail: `issueId=${issue.id}, blockId=${focusData.location.blockId}`,
      issueId: issue.id,
    });
  }

  async function handleApplyIssue(issue: Issue) {
    if (!currentDocument) return;
    setApplyingIssueId(issue.id);
    try {
      const response = await applyIssue(currentDocument.documentId, issue.id);
      setPendingFocusLocation(response.appliedIssueLocation || issue.location);
      applyReviewState(response);
      setActiveTab("issues");
      setRightPanel("review");
    } finally {
      setApplyingIssueId(null);
    }
  }

  async function handleIgnoreIssue(issue: Issue) {
    if (!currentDocument) return;
    const response = await ignoreIssue(currentDocument.documentId, issue.id);
    applyReviewState(response);
  }

  async function handleSaveGlossary(glossary: any) {
    if (!currentDocument) return;
    await updateGlossary(currentDocument.documentId, glossary);
    await refreshContext(currentDocument.documentId);
  }

  function handleCopyShareLink() {
    if (!currentDocument) return;
    const url = new URL(window.location.href);
    url.searchParams.set("documentId", currentDocument.documentId);
    navigator.clipboard.writeText(url.toString()).catch(() => undefined);
  }

  const traceAvailable = Boolean(traceSummary || traceFileUrl || traceData);
  const issueRailIssues = useMemo(() => {
    if (activeChunkIndex !== null) return issuesByChunk[activeChunkIndex] || issues;
    if (activeIssueWindow && annotatedIssues.length > 0) return annotatedIssues;
    return [];
  }, [activeChunkIndex, activeIssueWindow, annotatedIssues, issues, issuesByChunk]);

  const appVersionLabel = pkg.version ? `v${pkg.version}` : undefined;

  return (
    <div className="appShell">
      <AppTopBar
        currentDocument={currentDocument}
        loading={loading}
        isAnalyzing={isAnalyzing}
        mode={mode}
        apiStatus={apiStatus}
        modelName={modelName}
        theme={theme}
        chatVisible={chatVisible}
        issueCount={analysisSummary?.detectedIssues ?? issues.length}
        reviewPanelOpen={reviewPanelOpen}
        analysisDurationLabel={analysisDurationLabel}
        traceSummary={traceSummary}
        traceInsightLabel={traceInsightLabel}
        cacheInfo={cacheInfo}
        agentOptions={AGENTS}
        currentAgentId={currentAgentId}
        debugTraceEnabled={traceEnabled}
        traceAvailable={traceAvailable}
        appVersionLabel={appVersionLabel}
        onBuildContext={handleBuildContext}
        onOpenTracePanel={() => {
          if (currentDocument) {
            void refreshTrace(currentDocument.documentId);
          }
          setRightPanel("trace");
          setReviewPanelOpen(true);
        }}
        onToggleDebugTrace={() => {
          setTraceEnabled(true);
          pushClientTraceEvent({
            stage: "client",
            decision: "debug_trace_forced_on",
            detail: "trace mặc định luôn bật cho mọi lần phân tích",
          });
        }}
        onOpenContextPanel={() => {
          setRightPanel("context");
          setReviewPanelOpen(true);
        }}
        onOpenPromptPanel={() => {
          setRightPanel("prompts");
          setReviewPanelOpen(true);
        }}
        onModeChange={setMode}
        onUpload={handleUpload}
        onAnalyze={() => void handleAnalyze({ useCache: true })}
        onAnalyzeWithCache={() => void handleAnalyze({ useCache: true })}
        onForceReanalyze={() => void handleAnalyze({ useCache: false, forceReanalyze: true })}
        onApplyHighConfidence={handleApplyHighConfidence}
        onCopyShareLink={handleCopyShareLink}
        onToggleTheme={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
        onToggleChat={() => setChatVisible((value) => !value)}
        onToggleReviewPanel={() => setReviewPanelOpen((value) => !value)}
        onAgentChange={setCurrentAgentId}
        onRunAgent={handleRunAgent}
        exportActions={exportActions}
      />

      <div className="workspaceShell">
        <div className="editorSurface">
          <DocumentToolbar toolbarId={TOOLBAR_ID} />

          {currentDocument && analysisMetadata ? (
            <section className="chunkAnalysisPanel">
              <div className="chunkAnalysisSummary">
                <div>
                  <strong>{analysisMetadata.fileName}</strong>
                  <span>
                    {analysisMetadata.totalPages.toLocaleString("vi-VN")} trang • {analysisMetadata.totalChunks.toLocaleString("vi-VN")} phần • mỗi phần {analysisMetadata.pageSize} trang
                  </span>
                </div>
                <div>
                  <strong>
                    {analysisProgress?.completedChunks ?? analysisMetadata.completedChunks}/{analysisMetadata.totalChunks} phần
                  </strong>
                  <span>
                    {analysisProgress?.status === "completed"
                      ? "Đã phân tích xong toàn bộ tài liệu"
                      : isAnalyzing
                        ? `Đang phân tích${analysisProgress?.currentChunkIndex !== null && analysisProgress?.currentChunkIndex !== undefined ? `: phần ${analysisProgress.currentChunkIndex + 1}` : ""}`
                        : analysisMetadata.completedChunks > 0
                          ? "Có thể xem kết quả đã phân tích hoặc tiếp tục"
                          : "Sẵn sàng phân tích theo từng phần"}
                  </span>
                </div>
              </div>
              <div className="chunkProgressTrack" aria-label="Tiến độ phân tích theo phần">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((analysisProgress?.completedChunks ?? analysisMetadata.completedChunks) / Math.max(1, analysisMetadata.totalChunks)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <div className="chunkNavigation" aria-label="Chọn phần tài liệu">
                {pageChunks.map((chunk) => {
                  const isActive = activeChunkIndex === chunk.chunkIndex;
                  const disabled = chunk.status === "pending" || chunk.status === "analyzing";
                  return (
                    <button
                      type="button"
                      key={chunk.chunkIndex}
                      className={`chunkButton chunkButton-${chunk.status} ${isActive ? "active" : ""}`}
                      disabled={disabled || loadingIssueBatch}
                      onClick={() => void handleOpenChunk(chunk.chunkIndex, chunk.status === "failed")}
                      title={chunk.errorMessage}
                    >
                      <span>Trang {chunk.startPage}-{chunk.endPage}</span>
                      <strong>
                        {chunk.status === "completed"
                          ? `${(chunk.issueCount || 0).toLocaleString("vi-VN")} lỗi`
                          : chunk.status === "failed"
                            ? "Thử lại"
                            : chunk.status === "analyzing"
                              ? "Đang phân tích"
                              : "Chờ"}
                      </strong>
                    </button>
                  );
                })}
              </div>
              {activeChunkIndex !== null ? (
                <div className="currentChunkSummary">
                  Đang xem trang {pageChunks[activeChunkIndex]?.startPage}-{pageChunks[activeChunkIndex]?.endPage}: {(issuesByChunk[activeChunkIndex]?.length ?? issues.length).toLocaleString("vi-VN")} lỗi trong phần này.
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="workspaceMain">
            <section className="editorColumn">
              <div className="editorStack">
                <SuperDocWorkspace
                  ref={workspaceRef}
                  documentUrl={documentUrl}
                  mode={mode}
                  toolbarId={TOOLBAR_ID}
                  commentsElementId={COMMENTS_ID}
                  documentVersion={documentVersion}
                  applyingIssueId={applyingIssueId}
                  issues={issueRailIssues}
                  totalIssueCount={issues.length}
                  chunkMode={activeChunkIndex !== null}
                  issueRailStartIndex={issueRailStartIndex}
                  issueRailBatchSize={ISSUE_RAIL_BATCH_SIZE}
                  activeIssueWindow={activeIssueWindow}
                  issueBatchLoading={loadingIssueBatch}
                  onFocusIssue={handleFocusIssue}
                  onApplyIssue={handleApplyIssue}
                  onIgnoreIssue={handleIgnoreIssue}
                  onOpenIssueBatch={(startIndex, count) => void handleOpenIssueBatch(startIndex, count)}
                  onRailWindowChange={(startIndex) => {
                    setActiveIssueWindow(null);
                    setAnnotatedIssues([]);
                    setIssueRailStartIndex(startIndex);
                    setDocumentUrl(currentDocument?.originalFileUrl ?? documentUrl);
                    setDocumentVersion((value) => value + 1);
                  }}
                  onOpenAllIssues={() => {
                    setRightPanel("review");
                    setActiveTab("issues");
                    setActiveFilter("all");
                    setReviewPanelOpen(true);
                  }}
                />

                <AiCommandBar
                  command={command}
                  mode={reviewMode}
                  visible={chatVisible}
                  disabled={!currentDocument || loading}
                  modelLabel={modelName}
                  onCommandChange={setCommand}
                  onModeChange={setReviewMode}
                  onSubmit={handleAiCommand}
                />
              </div>

              {todoNotes.length > 0 ? (
                <div className="todoRibbon">
                  {todoNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      <div
        className={`reviewDrawerScrim ${reviewPanelOpen ? "visible" : ""}`}
        onClick={() => setReviewPanelOpen(false)}
        aria-hidden={!reviewPanelOpen}
      />

      <div className={`reviewDrawerPanel ${reviewPanelOpen ? "open" : ""}`}>
        {rightPanel === "review" ? (
          <ReviewSidebar
            activeTab={activeTab}
            activeFilter={activeFilter}
            hasReviewResult={hasReviewResult}
            applyingIssueId={applyingIssueId}
            analysisSummary={analysisSummary}
            cacheInfo={cacheInfo}
            issues={issues}
            annotatedIssues={annotatedIssues}
            activeIssueWindow={activeIssueWindow}
            comments={comments}
            changes={changes}
            history={history}
            onTabChange={setActiveTab}
            onFilterChange={setActiveFilter}
            onFocusIssue={handleFocusIssue}
            onApplyIssue={handleApplyIssue}
            onIgnoreIssue={handleIgnoreIssue}
            onAnnotateIssue={handleAnnotateIssue}
            onOpenIssueBatch={(startIndex, count) => void handleOpenIssueBatch(startIndex, count)}
            onAnnotateMore={() => void handleOpenIssueBatch(activeIssueWindow?.endIndex ?? 0, 500)}
            onAnnotateAll={activeChunkIndex === null ? () => void handleAnnotateAll() : undefined}
            onExportAllIssues={() => {
              if (!currentDocument) return;
              window.open(getExportUrl(currentDocument.documentId, "report-json"), "_blank");
            }}
            onClose={() => setReviewPanelOpen(false)}
          />
        ) : rightPanel === "context" ? (
          <ContextMemoryPanel
            context={contextMemory}
            onSaveGlossary={handleSaveGlossary}
            onRefreshContext={async () => {
              if (!currentDocument) return;
              await handleBuildContext();
            }}
          />
        ) : rightPanel === "trace" ? (
          <TraceDebugPanel
            traceEnabled={traceEnabled}
            traceSummary={traceSummary}
            traceFileUrl={traceFileUrl}
            trace={traceData}
            clientEvents={clientTraceEvents}
            loading={traceLoading}
            onRefresh={async () => {
              if (!currentDocument) return;
              await refreshTrace(currentDocument.documentId);
            }}
            onClose={() => setReviewPanelOpen(false)}
          />
        ) : (
          <PromptSettingsPanel
            prompts={prompts}
            onLoadPrompt={async (promptId) => (await getPrompt(promptId)).prompt}
            onSavePrompt={async (promptId, prompt) => {
              const saved = await savePrompt(promptId, prompt);
              setPrompts((current) =>
                current.map((item) => (item.id === promptId ? saved.prompt : item))
              );
              return saved.prompt;
            }}
            onResetPrompt={async (promptId) => {
              const reset = await resetPrompt(promptId);
              setPrompts((current) =>
                current.map((item) => (item.id === promptId ? reset.prompt : item))
              );
              return reset.prompt;
            }}
            onTestPrompt={async (promptId, variables, sampleOutput) =>
              (await testPrompt(promptId, variables, sampleOutput)).result
            }
          />
        )}
      </div>
    </div>
  );
}
