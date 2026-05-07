import { startTransition, useMemo, useRef, useState } from "react";
import {
  analyzeDocument,
  applyHighConfidence,
  applyIssue,
  buildContext,
  focusIssue,
  getApiHealth,
  getContext,
  getExportUrl,
  getPrompt,
  ignoreIssue,
  listPrompts,
  resetPrompt,
  runAgent,
  runAiCommand,
  savePrompt,
  testPrompt,
  updateGlossary,
  uploadDocument,
} from "./lib/api";
import type {
  AgentOption,
  ChangeRecord,
  CommentRecord,
  DocumentContextMemory,
  DocumentMode,
  HistoryRecord,
  Issue,
  IssueLocation,
  IssueFilter,
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

const TOOLBAR_ID = "superdoc-toolbar-surface";
const COMMENTS_ID = "superdoc-comments-surface";

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

function mergeResponse(
  previous: {
    comments: CommentRecord[];
    changes: ChangeRecord[];
    history: HistoryRecord[];
    issues: Issue[];
  },
  next: ReviewResponse
) {
  return {
    issues: next.issues || previous.issues,
    comments: next.comments || previous.comments,
    changes: next.changes || previous.changes,
    history: next.history || previous.history,
    reviewedFileUrl: next.reviewedFileUrl || null,
    context: next.context || null,
  };
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
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [hasReviewResult, setHasReviewResult] = useState(false);
  const [applyingIssueId, setApplyingIssueId] = useState<string | null>(null);
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
  const [rightPanel, setRightPanel] = useState<"review" | "context" | "prompts">("review");

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
        setHasReviewResult(false);
        setTodoNotes([]);
        setContextMemory(null);
        setDocumentVersion((value) => value + 1);
      });
    } finally {
      setLoading(false);
    }
  }

  function applyReviewState(next: ReviewResponse) {
    startTransition(() => {
      const merged = mergeResponse({ issues, comments, changes, history }, next);
      setIssues(merged.issues);
      setComments(merged.comments);
      setChanges(merged.changes);
      setHistory(merged.history);
      setTodoNotes(next.todos || []);
      if (merged.context) setContextMemory(merged.context);
      if (merged.reviewedFileUrl) {
        setDocumentUrl(`${merged.reviewedFileUrl}?v=${Date.now()}`);
        setDocumentVersion((value) => value + 1);
      }
    });
  }

  async function handleAnalyze() {
    if (!currentDocument) return;
    setLoading(true);
    const startedAt = Date.now();
    setIsAnalyzing(true);
    setAnalysisStartedAt(startedAt);
    setAnalysisElapsedMs(0);
    setLastAnalysisDurationMs(null);
    try {
      const response = await analyzeDocument(currentDocument.documentId, {
        mode: reviewMode,
        checks: ["spelling", "format", "terminology", "translation", "tone", "entity", "date_number"],
        highlightColor: "yellow",
      });
      applyReviewState(response);
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

  async function handleRunAgent() {
    if (!currentDocument) return;
    setLoading(true);
    try {
      const response = await runAgent(currentDocument.documentId, currentAgentId);
      applyReviewState(response);
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
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
        reviewMode
      );
      applyReviewState(response);
      setHasReviewResult(true);
      setActiveTab("issues");
      setRightPanel("review");
    } finally {
      setLoading(false);
    }
  }

  async function handleFocusIssue(issue: Issue) {
    if (!currentDocument) return;
    const focusData = await focusIssue(currentDocument.documentId, issue.id);
    await workspaceRef.current?.focusIssue(focusData.location);
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
        issueCount={issues.length}
        reviewPanelOpen={reviewPanelOpen}
        analysisDurationLabel={analysisDurationLabel}
        agentOptions={AGENTS}
        currentAgentId={currentAgentId}
        appVersionLabel={appVersionLabel}
        onBuildContext={handleBuildContext}
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
        onAnalyze={handleAnalyze}
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
                  issues={issues}
                  onFocusIssue={handleFocusIssue}
                  onApplyIssue={handleApplyIssue}
                  onIgnoreIssue={handleIgnoreIssue}
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
            issues={issues}
            comments={comments}
            changes={changes}
            history={history}
            onTabChange={setActiveTab}
            onFilterChange={setActiveFilter}
            onFocusIssue={handleFocusIssue}
            onApplyIssue={handleApplyIssue}
            onIgnoreIssue={handleIgnoreIssue}
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
