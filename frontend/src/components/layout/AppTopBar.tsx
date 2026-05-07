import {
  Download,
  FileUp,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  PanelRight,
  Play,
  Share2,
  Sun,
} from "lucide-react";
import { vi } from "../../i18n";
import type { AgentOption, AnalysisCacheInfo, AnalysisTraceSummary, DocumentMode, UploadedDocument } from "../../types";
import { AgentsDropdown } from "../agents/AgentsDropdown";

type Props = {
  currentDocument: UploadedDocument | null;
  loading: boolean;
  isAnalyzing: boolean;
  mode: DocumentMode;
  apiStatus: "checking" | "online" | "offline";
  modelName: string;
  theme: "light" | "dark";
  chatVisible: boolean;
  issueCount: number;
  reviewPanelOpen: boolean;
  analysisDurationLabel?: string | null;
  traceSummary?: AnalysisTraceSummary | null;
  traceInsightLabel?: string | null;
  cacheInfo?: AnalysisCacheInfo | null;
  agentOptions: AgentOption[];
  currentAgentId: string;
  debugTraceEnabled: boolean;
  traceAvailable: boolean;
  onBuildContext: () => void;
  onOpenTracePanel: () => void;
  onToggleDebugTrace: () => void;
  onOpenContextPanel: () => void;
  onOpenPromptPanel: () => void;
  onModeChange: (mode: DocumentMode) => void;
  onUpload: (file: File) => void;
  onAnalyze: () => void;
  onAnalyzeWithCache: () => void;
  onForceReanalyze: () => void;
  onApplyHighConfidence: () => void;
  onCopyShareLink: () => void;
  onToggleTheme: () => void;
  onToggleChat: () => void;
  onToggleReviewPanel: () => void;
  onAgentChange: (agentId: string) => void;
  onRunAgent: () => void;
  exportActions: Array<{ key: string; label: string; href?: string; onClick?: () => void }>;
  appVersionLabel?: string;
};

export function AppTopBar({
  currentDocument,
  loading,
  isAnalyzing,
  mode,
  apiStatus,
  modelName,
  theme,
  chatVisible,
  issueCount,
  reviewPanelOpen,
  analysisDurationLabel,
  traceSummary,
  traceInsightLabel,
  cacheInfo,
  agentOptions,
  currentAgentId,
  debugTraceEnabled,
  traceAvailable,
  onBuildContext,
  onOpenTracePanel,
  onToggleDebugTrace,
  onOpenContextPanel,
  onOpenPromptPanel,
  onModeChange,
  onUpload,
  onAnalyze,
  onAnalyzeWithCache,
  onForceReanalyze,
  onApplyHighConfidence,
  onCopyShareLink,
  onToggleTheme,
  onToggleChat,
  onToggleReviewPanel,
  onAgentChange,
  onRunAgent,
  exportActions,
  appVersionLabel,
}: Props) {
  const docHint = currentDocument?.documentId ?? null;

  return (
    <header className="appTopBar">
      <div className="topBarLeft">
        <label className="primaryBtn topBarImport">
          <FileUp size={16} aria-hidden />
          {vi.common.importDocx}
          <input
            hidden
            type="file"
            accept=".docx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div className="topBarMeta">
          {appVersionLabel ? <span className="topBarVersion">{appVersionLabel}</span> : null}
          {docHint ? (
            <span className="topBarDocId" title={docHint}>
              {docHint}
            </span>
          ) : (
            <span className="topBarDocId muted">{vi.common.noDocument}</span>
          )}
        </div>
      </div>

      <div className="topBarCenter">
        <div className="topBarAnalyzeGroup">
          <button
            className="primaryBtn spellCheckBtn"
            type="button"
            disabled={!currentDocument || loading}
            onClick={onAnalyze}
          >
            <Play size={16} aria-hidden />
            {isAnalyzing ? vi.common.analyzing : vi.common.analyzeConsistency}
          </button>
          {analysisDurationLabel ? (
            <span
              className={`analysisDurationPill ${isAnalyzing ? "running" : ""}`}
              aria-live="polite"
            >
              {isAnalyzing ? vi.common.analysisRunningTime(analysisDurationLabel) : vi.common.analysisLastTime(analysisDurationLabel)}
            </span>
          ) : null}
          {!isAnalyzing && traceSummary ? (
            <button
              type="button"
              className={`analysisTracePill ${traceInsightLabel?.includes("không") || traceInsightLabel?.includes("lỗi") ? "warning" : ""}`}
              onClick={onOpenTracePanel}
              disabled={!traceAvailable}
            >
              {traceInsightLabel ?? `Trace: detector ${traceSummary.detectedByDetector}, UI ${traceSummary.returnedToUi}`}
            </button>
          ) : null}
          {!isAnalyzing && cacheInfo?.cacheHit ? (
            <span className="analysisCachePill" title={cacheInfo.cacheKey}>
              Cache HIT
            </span>
          ) : null}
        </div>
      </div>

      <div className="topBarControls">
        <button
          type="button"
          className={`iconGhostBtn ${reviewPanelOpen ? "active" : ""}`}
          onClick={onToggleReviewPanel}
          title={vi.common.reviewPanelTitle}
          aria-expanded={reviewPanelOpen}
          aria-label={vi.common.reviewPanelAriaLabel(issueCount)}
        >
          <PanelRight size={18} aria-hidden />
          {issueCount > 0 ? <span className="iconBtnBadge">{issueCount}</span> : null}
        </button>

        <button
          type="button"
          className="iconGhostBtn"
          onClick={onCopyShareLink}
          disabled={!currentDocument}
          title={vi.common.shareLinkTitle}
          aria-label={vi.common.shareLinkAria}
        >
          <Share2 size={18} aria-hidden />
        </button>

        <button
          type="button"
          className="iconGhostBtn"
          onClick={onToggleTheme}
          title={theme === "light" ? vi.common.themeDarkTitle : vi.common.themeLightTitle}
          aria-label={theme === "light" ? vi.common.themeDarkAria : vi.common.themeLightAria}
        >
          {theme === "light" ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
        </button>

        <details className="exportMenu">
          <summary className="iconGhostBtn" title={vi.common.exportTitle} aria-label={vi.common.exportAria}>
            <Download size={18} aria-hidden />
          </summary>
          <div className="exportPanel">
            {exportActions.length === 0 ? (
              <span className="exportEmpty">{vi.common.exportEmpty}</span>
            ) : (
              exportActions.map((action) =>
                action.href ? (
                  <a key={action.key} href={action.href} className="exportItem">
                    {action.label}
                  </a>
                ) : (
                  <button key={action.key} type="button" className="exportItem" onClick={action.onClick}>
                    {action.label}
                  </button>
                )
              )
            )}
          </div>
        </details>

        <details className="moreMenu">
          <summary className="iconGhostBtn" title={vi.common.moreTitle} aria-label={vi.common.moreAria}>
            <MoreHorizontal size={18} aria-hidden />
          </summary>
          <div className="moreMenuPanel">
            <div className="moreMenuSection">
              <span className="moreMenuLabel">{vi.common.documentModeLabel}</span>
              <select
                className="topSelect moreMenuFullWidth"
                value={mode}
                onChange={(event) => onModeChange(event.target.value as DocumentMode)}
                disabled={!currentDocument}
              >
                <option value="suggesting">{vi.common.modeSuggesting}</option>
                <option value="editing">{vi.common.modeEditing}</option>
                <option value="viewing">{vi.common.modeViewing}</option>
              </select>
            </div>

            <button
              type="button"
              className="ghostBtn moreMenuFullWidth"
              disabled={!currentDocument || loading}
              onClick={onAnalyzeWithCache}
            >
              Dùng cache
            </button>

            <button
              type="button"
              className="ghostBtn moreMenuFullWidth"
              disabled={!currentDocument || loading}
              onClick={onForceReanalyze}
            >
              Phân tích lại từ đầu
            </button>

            <button
              type="button"
              className="ghostBtn moreMenuFullWidth"
              disabled={!currentDocument || loading}
              onClick={onApplyHighConfidence}
            >
              {vi.common.applyHighConfidence}
            </button>

            <button
              type="button"
              className="ghostBtn moreMenuFullWidth"
              disabled={!currentDocument || loading}
              onClick={onBuildContext}
            >
              {vi.common.buildContext}
            </button>

            <button type="button" className="ghostBtn moreMenuFullWidth" onClick={onToggleDebugTrace}>
              {debugTraceEnabled ? vi.common.debugTraceOn : vi.common.debugTraceOff}
            </button>

            <button
              type="button"
              className="ghostBtn moreMenuFullWidth"
              disabled={!traceAvailable}
              onClick={onOpenTracePanel}
            >
              {vi.common.openDebugTrace}
            </button>

            <div className="moreMenuSection">
              <span className="moreMenuLabel">{vi.common.agentsSection}</span>
              <AgentsDropdown
                agents={agentOptions}
                currentAgentId={currentAgentId}
                disabled={!currentDocument || loading}
                layout="stack"
                onAgentChange={onAgentChange}
                onRunAgent={onRunAgent}
              />
            </div>

            <button type="button" className="ghostBtn moreMenuFullWidth" onClick={onToggleChat}>
              <MessageSquareText size={16} aria-hidden />
              {chatVisible ? vi.common.hideChatAi : vi.common.showChatAi}
            </button>

            <button type="button" className="ghostBtn moreMenuFullWidth" onClick={onOpenContextPanel}>
              {vi.common.contextMemory}
            </button>

            <button type="button" className="ghostBtn moreMenuFullWidth" onClick={onOpenPromptPanel}>
              {vi.common.promptSettings}
            </button>

            <div className="moreMenuSection moreMenuApiRow">
              <span className={`statusDot status-${apiStatus}`} title={vi.common.apiStatusTitle} />
              <span className="moreMenuApiText">
                {apiStatus === "online"
                  ? vi.common.apiOnline
                  : apiStatus === "offline"
                    ? vi.common.apiOffline
                    : vi.common.apiChecking}
              </span>
              <span className="moreMenuModel mutedText">{modelName}</span>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
