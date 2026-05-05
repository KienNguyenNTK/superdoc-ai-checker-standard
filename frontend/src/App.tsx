import { startTransition, useMemo, useRef, useState } from "react";
import {
  analyzeDocument,
  applyHighConfidence,
  applyIssue,
  focusIssue,
  getApiHealth,
  getExportUrl,
  ignoreIssue,
  runAgent,
  runAiCommand,
  uploadDocument,
} from "./lib/api";
import type {
  AgentOption,
  CommentRecord,
  DocumentMode,
  HistoryRecord,
  ReviewMode,
  ReviewResponse,
  ReviewTab,
  SpellingIssue,
  UploadedDocument,
  ChangeRecord,
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

const TOOLBAR_ID = "superdoc-toolbar-surface";
const COMMENTS_ID = "superdoc-comments-surface";

const AGENTS: AgentOption[] = [
  {
    id: "vietnamese-spelling-checker",
    ...vi.agents.byId["vietnamese-spelling-checker"],
    defaultMode: "comment_and_highlight",
  },
  {
    id: "grammar-reviewer",
    ...vi.agents.byId["grammar-reviewer"],
    defaultMode: "comment_only",
  },
  {
    id: "style-reviewer",
    ...vi.agents.byId["style-reviewer"],
    defaultMode: "comment_only",
  },
  {
    id: "format-cleaner",
    ...vi.agents.byId["format-cleaner"],
    defaultMode: "track_changes",
  },
];

function mergeResponse(
  previous: {
    comments: CommentRecord[];
    changes: ChangeRecord[];
    history: HistoryRecord[];
    issues: SpellingIssue[];
  },
  next: ReviewResponse
) {
  return {
    issues: next.issues || previous.issues,
    comments: next.comments || previous.comments,
    changes: next.changes || previous.changes,
    history: next.history || previous.history,
    reviewedFileUrl: next.reviewedFileUrl || null,
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
  const [issues, setIssues] = useState<SpellingIssue[]>([]);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewTab>("issues");
  const [chatVisible, setChatVisible] = useState(false);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [command, setCommand] = useState<string>(vi.app.defaultAiCommand);
  const [reviewMode, setReviewMode] =
    useState<ReviewMode>("comment_and_highlight");
  const [currentAgentId, setCurrentAgentId] = useState(AGENTS[0].id);
  const [todoNotes, setTodoNotes] = useState<string[]>([]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    getApiHealth()
      .then((health) => {
        setApiStatus("online");
        setModelName(health.llm.model);
      })
      .catch(() => setApiStatus("offline"));
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
        setTodoNotes([]);
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
      if (merged.reviewedFileUrl) {
        setDocumentUrl(`${merged.reviewedFileUrl}?v=${Date.now()}`);
        setDocumentVersion((value) => value + 1);
      }
    });
  }

  async function handleAnalyze() {
    if (!currentDocument) return;
    setLoading(true);
    try {
      const response = await analyzeDocument(currentDocument.documentId, {
        mode: reviewMode,
        highlightColor: "yellow",
        maxIssues: 200,
      });
      applyReviewState(response);
      const count = response.issues?.length ?? 0;
      if (count > 0) {
        setReviewPanelOpen(true);
      }
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
      if ((response.issues?.length ?? 0) > 0) {
        setReviewPanelOpen(true);
      }
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
      setActiveTab("issues");
      if ((response.issues?.length ?? 0) > 0) {
        setReviewPanelOpen(true);
      }
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
      if ((response.issues?.length ?? 0) > 0) {
        setReviewPanelOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleFocusIssue(issue: SpellingIssue) {
    if (!currentDocument) return;
    const focusData = await focusIssue(currentDocument.documentId, issue.id);
    await workspaceRef.current?.focusIssue(focusData.location);
  }

  async function handleApplyIssue(issue: SpellingIssue) {
    if (!currentDocument) return;
    const response = await applyIssue(currentDocument.documentId, issue.id);
    applyReviewState(response);
  }

  async function handleIgnoreIssue(issue: SpellingIssue) {
    if (!currentDocument) return;
    const response = await ignoreIssue(currentDocument.documentId, issue.id);
    applyReviewState(response);
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
        mode={mode}
        apiStatus={apiStatus}
        modelName={modelName}
        theme={theme}
        chatVisible={chatVisible}
        issueCount={issues.length}
        reviewPanelOpen={reviewPanelOpen}
        agentOptions={AGENTS}
        currentAgentId={currentAgentId}
        appVersionLabel={appVersionLabel}
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
        <ReviewSidebar
          activeTab={activeTab}
          issues={issues}
          comments={comments}
          changes={changes}
          history={history}
          onTabChange={setActiveTab}
          onFocusIssue={handleFocusIssue}
          onApplyIssue={handleApplyIssue}
          onIgnoreIssue={handleIgnoreIssue}
          onClose={() => setReviewPanelOpen(false)}
        />
      </div>
    </div>
  );
}
