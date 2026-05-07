import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { SuperDocEditor, type SuperDocRef } from "@superdoc-dev/react";
import { SuperDocUIProvider, useSetSuperDoc, useSuperDocUI } from "superdoc/ui/react";
import { labelIssueConfidence, labelIssueStatus, labelIssueType, vi } from "../../i18n";
import type { DocumentMode, Issue, IssueAnnotationWindow, IssueLocation } from "../../types";

export type SuperDocWorkspaceHandle = {
  reloadDocument: () => void;
  focusIssue: (location: IssueLocation) => Promise<boolean>;
  exportDocument: () => Promise<void>;
};

type Props = {
  documentUrl: string | null;
  mode: DocumentMode;
  toolbarId: string;
  commentsElementId: string;
  documentVersion: number;
  applyingIssueId?: string | null;
  issues?: Issue[];
  totalIssueCount?: number;
  chunkMode?: boolean;
  issueRailStartIndex?: number;
  issueRailBatchSize?: number;
  activeIssueWindow?: IssueAnnotationWindow | null;
  issueBatchLoading?: boolean;
  onFocusIssue?: (issue: Issue) => void | Promise<void>;
  onApplyIssue?: (issue: Issue) => void | Promise<void>;
  onIgnoreIssue?: (issue: Issue) => void | Promise<void>;
  onOpenAllIssues?: () => void;
  onOpenIssueBatch?: (startIndex: number, count?: number) => void | Promise<void>;
  onRailWindowChange?: (startIndex: number) => void;
};

function resolveRole(mode: DocumentMode) {
  if (mode === "viewing") return "viewer";
  if (mode === "suggesting") return "suggester";
  return "editor";
}

export const SuperDocWorkspace = forwardRef<SuperDocWorkspaceHandle, Props>(
  function SuperDocWorkspace(
    {
      documentUrl,
      mode,
      toolbarId,
      commentsElementId,
      documentVersion,
      applyingIssueId,
      issues = [],
      totalIssueCount,
      issueRailStartIndex,
      issueRailBatchSize,
      chunkMode,
      activeIssueWindow,
      issueBatchLoading,
      onFocusIssue,
      onApplyIssue,
      onIgnoreIssue,
      onOpenAllIssues,
      onOpenIssueBatch,
      onRailWindowChange,
    },
    ref
  ) {
    return (
      <SuperDocUIProvider>
        <WorkspaceInner
          ref={ref}
          documentUrl={documentUrl}
          mode={mode}
          toolbarId={toolbarId}
          commentsElementId={commentsElementId}
          documentVersion={documentVersion}
          applyingIssueId={applyingIssueId}
          issues={issues}
          totalIssueCount={totalIssueCount}
          issueRailStartIndex={issueRailStartIndex}
          issueRailBatchSize={issueRailBatchSize}
          chunkMode={chunkMode}
          activeIssueWindow={activeIssueWindow}
          issueBatchLoading={issueBatchLoading}
          onFocusIssue={onFocusIssue}
          onApplyIssue={onApplyIssue}
          onIgnoreIssue={onIgnoreIssue}
          onOpenAllIssues={onOpenAllIssues}
          onOpenIssueBatch={onOpenIssueBatch}
          onRailWindowChange={onRailWindowChange}
        />
      </SuperDocUIProvider>
    );
  }
);

const WorkspaceInner = forwardRef<SuperDocWorkspaceHandle, Props>(function WorkspaceInner(
  {
    documentUrl,
    mode,
    toolbarId,
    commentsElementId,
    documentVersion,
    applyingIssueId,
    issues = [],
    totalIssueCount,
    issueRailStartIndex = 0,
    issueRailBatchSize = 500,
    chunkMode = false,
    activeIssueWindow,
    issueBatchLoading = false,
    onFocusIssue,
    onApplyIssue,
    onIgnoreIssue,
    onOpenAllIssues,
    onOpenIssueBatch,
    onRailWindowChange,
  },
  ref
) {
    const editorRef = useRef<SuperDocRef>(null);
    const useAppIssuesRail = issues.length > 0 || (totalIssueCount ?? 0) > 0;
    const railStart = activeIssueWindow?.startIndex ?? issueRailStartIndex;
    const railEnd = activeIssueWindow?.endIndex ??
      Math.min(railStart + (issues.length > 0 ? issues.length : issueRailBatchSize), totalIssueCount ?? issues.length);
    const canGoPreviousRail = railStart > 0;
    const canGoNextRail = typeof totalIssueCount === "number" && railEnd < totalIssueCount;
    const railIsAnnotatedBatch = Boolean(activeIssueWindow);
    const setSuperDoc = useSetSuperDoc();
    const ui = useSuperDocUI();
    const uiRef = useRef<typeof ui>(null);

    useEffect(() => {
      uiRef.current = ui;
    }, [ui]);

    const attachCommentsList = useCallback(() => {
      if (issues.length > 0) return;
      const instance = editorRef.current?.getInstance() as any;
      if (!instance || !commentsElementId) return;
      try {
        instance.removeCommentsList?.();
        instance.addCommentsList?.(`#${commentsElementId}`);
      } catch {
        // SuperDoc may attach via modules.comments.element only; ignore errors.
      }
    }, [commentsElementId, issues.length]);

    const detachCommentsList = useCallback(() => {
      const instance = editorRef.current?.getInstance() as any;
      if (!instance) return;
      try {
        instance.removeCommentsList?.();
      } catch {
        // ignore
      }
    }, []);

    const handleEditorReady = useCallback(() => {
      requestAnimationFrame(() => {
        if (issues.length > 0) {
          detachCommentsList();
        } else {
          attachCommentsList();
        }
        requestAnimationFrame(() => {
          if (issues.length > 0) {
            detachCommentsList();
          } else {
            attachCommentsList();
          }
        });
      });
    }, [attachCommentsList, detachCommentsList, issues.length]);

    const handleSuperDocReady = useCallback(
      (event: any) => {
        try {
          if (event?.superdoc) setSuperDoc(event.superdoc);
        } finally {
          handleEditorReady();
        }
      },
      [handleEditorReady, setSuperDoc]
    );

    const modules = useMemo(() => {
      const toolbar = {
        selector: `#${toolbarId}`,
        groups: {
          left: ["undo", "redo", "zoom"],
          center: [
            "fontFamily",
            "fontSize",
            "bold",
            "italic",
            "underline",
            "strikethrough",
            "color",
            "highlight",
            "clearFormatting",
          ],
          right: [
            "link",
            "image",
            "table",
            "alignLeft",
            "alignCenter",
            "alignRight",
            "justify",
            "list",
            "numberedlist",
            "indentleft",
            "indentright",
            "documentMode",
            "export",
          ],
        },
        responsiveToContainer: true,
      };
      const trackChanges = {
        visible: true,
        replacements: "independent" as const,
      };
      if (issues.length > 0) {
        return { toolbar, trackChanges, comments: false };
      }
      return {
        toolbar,
        trackChanges,
        comments: {
          allowResolve: true,
          showResolved: true,
          element: `#${commentsElementId}`,
        },
      };
    }, [commentsElementId, toolbarId, issues.length]);

    useImperativeHandle(ref, () => ({
      reloadDocument() {
        const instance = editorRef.current?.getInstance();
        instance?.focus?.();
      },
      async focusIssue(location) {
        const instance = editorRef.current?.getInstance() as any;
        if (!instance) return false;

        instance.focus?.();

        const uiCurrent: any = uiRef.current;

        if (location.commentId) {
          try {
            uiCurrent?.comments?.scrollTo?.(location.commentId);
            if (instance.activeEditor?.commands?.setActiveComment) {
              instance.activeEditor.commands.setActiveComment({ commentId: location.commentId });
            }
            return true;
          } catch {
            // Fallback to selection/target-based focus below.
          }
        }

        if (location.changeId) {
          try {
            uiCurrent?.trackChanges?.scrollTo?.(location.changeId);
            return true;
          } catch {
            // Fallback to selection/target-based focus below.
          }
        }

        const selectionTarget =
          location.target ||
          (typeof location.startOffset === "number" &&
          typeof location.endOffset === "number" &&
          location.blockId
            ? {
                kind: "selection",
                start: { kind: "text", blockId: location.blockId, offset: location.startOffset },
                end: { kind: "text", blockId: location.blockId, offset: location.endOffset },
              }
            : null);

        const textTarget = selectionTarget
          ? {
              kind: "text",
              blockId: selectionTarget.start.blockId,
              range: { start: selectionTarget.start.offset, end: selectionTarget.end.offset },
            }
          : null;

        if (textTarget) {
          try {
            const receipt = await uiCurrent?.viewport?.scrollIntoView?.({
              target: textTarget,
              block: "center",
              behavior: "smooth",
            });
            if (receipt?.success !== false) return true;
          } catch {
            // Fallback to search-based focus below.
          }
        }

        const results =
          instance.search?.(location.searchText) ||
          instance.activeEditor?.commands?.search?.(location.searchText, {
            highlight: true,
          }) ||
          [];

        const match =
          results.find(
            (item: any) =>
              item.text === location.searchText ||
              (typeof item?.text === "string" &&
                item.text.toLowerCase() === location.searchText.toLowerCase())
          ) || results[0];

        if (match) {
          if (instance.goToSearchResult) {
            instance.goToSearchResult(match);
          } else if (instance.activeEditor?.commands?.goToSearchResult) {
            instance.activeEditor.commands.goToSearchResult(match);
          }

          return true;
        }

        return false;
      },
      async exportDocument() {
        const instance = editorRef.current?.getInstance();
        await instance?.export?.({
          triggerDownload: true,
        });
      },
    }));

    useEffect(() => {
      if (!documentUrl) return;
      const delays = [0, 80, 250, 700];
      const timers = delays.map((ms) =>
        window.setTimeout(() => {
          if (issues.length > 0) {
            detachCommentsList();
          } else {
            attachCommentsList();
          }
        }, ms)
      );
      return () => timers.forEach((id) => clearTimeout(id));
    }, [documentUrl, documentVersion, attachCommentsList, detachCommentsList, issues.length]);

    if (!documentUrl) {
      return (
        <div className="workspaceEmpty">
          <div className="workspaceCard">
            <span className="eyebrow">{vi.workspace.eyebrow}</span>
            <h1>{vi.workspace.title}</h1>
            <p>{vi.workspace.description}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="workspaceFrame superdocEditorWithComments">
        <div className="superdocEditorMain">
          <div className="superdocEditorPageShell">
            <div className="superdocEditorPageInner">
              <SuperDocEditor
                key={`${documentUrl}-${documentVersion}`}
                ref={editorRef}
                document={documentUrl}
                documentMode={mode}
                role={resolveRole(mode)}
                user={{
                  name: "Inres AI",
                  email: "ai-checker@example.com",
                }}
                contained
                modules={modules as never}
                comments={
                  (issues.length > 0
                    ? { visible: false }
                    : { visible: true }) as never
                }
                renderLoading={() => (
                  <div className="editorLoading">{vi.workspace.loadingDocx}</div>
                )}
                onContentError={(event) => {
                  console.error("SuperDoc content error", event);
                }}
                onException={(event) => {
                  console.error("SuperDoc exception", event);
                }}
                onReady={handleSuperDocReady as never}
              />
            </div>
          </div>
        </div>
        <div
          className={`builtinCommentsHost${useAppIssuesRail ? " builtinCommentsHost--appIssues" : ""}`}
        >
          <div id={commentsElementId} className="superdocCommentsMount" />
              {useAppIssuesRail ? (
            <div
              className="issueCommentsFallback"
              aria-label={vi.review.aiIssuesRailTitle}
            >
              <div className="issueCommentsFallbackHeader">
                <div>
                  {activeIssueWindow ? "Lỗi đã nạp vào DOCX" : "Lỗi sẵn sàng"}
                  {typeof totalIssueCount === "number" ? (
                    <span>
                      {chunkMode
                        ? `Chunk đang xem`
                        : activeIssueWindow
                        ? `Batch ${(activeIssueWindow.startIndex + 1).toLocaleString("vi-VN")}-${activeIssueWindow.endIndex.toLocaleString("vi-VN")}`
                        : issueBatchLoading
                          ? `Đang nạp batch ${(railStart + 1).toLocaleString("vi-VN")}-${Math.min(railStart + issueRailBatchSize, totalIssueCount).toLocaleString("vi-VN")}`
                          : `Chưa nạp batch DOCX`} / {totalIssueCount.toLocaleString("vi-VN")}
                    </span>
                  ) : null}
                </div>
                {!chunkMode && onOpenAllIssues && typeof totalIssueCount === "number" && totalIssueCount > issues.length ? (
                  <button type="button" className="miniBtn" onClick={onOpenAllIssues}>
                    Xem tất cả
                  </button>
                ) : null}
              </div>
              {!chunkMode ? <div className="issueRailBatchBar">
                <button
                  type="button"
                  className="miniBtn"
                  disabled={!canGoPreviousRail || issueBatchLoading}
                  onClick={() => {
                    const previousStart = Math.max(0, railStart - issueRailBatchSize);
                    if (onOpenIssueBatch) {
                      void onOpenIssueBatch(previousStart, issueRailBatchSize);
                    } else {
                      onRailWindowChange?.(previousStart);
                    }
                  }}
                >
                  Batch trước
                </button>
                {onOpenIssueBatch ? (
                  <button
                    type="button"
                    className="miniBtn accent"
                    disabled={issueBatchLoading}
                    onClick={() => void onOpenIssueBatch(railStart, issueRailBatchSize)}
                  >
                    {issueBatchLoading
                      ? "Đang nạp batch..."
                      : railIsAnnotatedBatch
                        ? "Nạp lại batch này"
                        : "Nạp batch này vào DOCX"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="miniBtn"
                  disabled={!canGoNextRail || issueBatchLoading}
                  onClick={() => {
                    const nextStart = railEnd;
                    if (onOpenIssueBatch) {
                      void onOpenIssueBatch(nextStart, issueRailBatchSize);
                    } else {
                      onRailWindowChange?.(nextStart);
                    }
                  }}
                >
                  Batch sau
                </button>
              </div> : null}
              {!railIsAnnotatedBatch ? (
                <div className="issueRailNotice">
                  {issueBatchLoading
                    ? chunkMode
                      ? "Đang tạo comment/highlight cho chunk hiện tại trong DOCX..."
                      : `Đang tạo comment/highlight cho batch ${(railStart + 1).toLocaleString("vi-VN")}-${Math.min(railStart + issueRailBatchSize, totalIssueCount ?? railStart + issueRailBatchSize).toLocaleString("vi-VN")} trong DOCX...`
                    : chunkMode
                      ? "DOCX chỉ đang nạp comment/highlight cho chunk hiện tại."
                      : `Danh sách lỗi đã có trong cache/session. DOCX chưa có comment/highlight; bấm "Nạp batch này vào DOCX" để bôi vàng/bình luận batch hiện tại.`}
                </div>
              ) : null}
              {issues.length === 0 && issueBatchLoading ? (
                <div className="issueRailNotice">Đang mở DOCX đã annotate trong SuperDoc...</div>
              ) : null}
              {issues.map((issue) => (
                <article
                  className={`reviewCard issue-${issue.status} issueCommentsFallbackCard`}
                  key={issue.id}
                >
                  <div className="cardMeta">
                    <span>{labelIssueType(issue.type)}</span>
                    <span>{labelIssueConfidence(issue.confidence)}</span>
                    <span className={`cardStatus cardStatus-${issue.status}`}>
                      {labelIssueStatus(issue.status)}
                    </span>
                  </div>
                  <h3>
                    {issue.wrong} → {issue.suggestion}
                  </h3>
                  <p className="issueCommentsFallbackReason">{issue.reason}</p>
                  <div className="cardActions">
                    {onFocusIssue ? (
                      <button
                        type="button"
                        className="miniBtn"
                        onClick={() => onFocusIssue(issue)}
                      >
                        {vi.review.goToIssue}
                      </button>
                    ) : null}
                    {onApplyIssue ? (
                      <button
                        type="button"
                        className="miniBtn accent"
                        onClick={() => onApplyIssue(issue)}
                        disabled={applyingIssueId === issue.id || issue.status === "applied" || issue.status === "ignored"}
                      >
                        {applyingIssueId === issue.id
                          ? vi.review.applying
                          : issue.status === "applied"
                            ? vi.review.applied
                            : vi.review.apply}
                      </button>
                    ) : null}
                    {onIgnoreIssue ? (
                      <button
                        type="button"
                        className="miniBtn ghost"
                        onClick={() => onIgnoreIssue(issue)}
                        disabled={issue.status === "applied" || issue.status === "ignored"}
                      >
                        {vi.review.ignore}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {!chunkMode ? <div className="issueRailBatchFooter">
                <button
                  type="button"
                  className="miniBtn"
                  disabled={!canGoPreviousRail || issueBatchLoading}
                  onClick={() => {
                    const previousStart = Math.max(0, railStart - issueRailBatchSize);
                    if (onOpenIssueBatch) {
                      void onOpenIssueBatch(previousStart, issueRailBatchSize);
                    } else {
                      onRailWindowChange?.(previousStart);
                    }
                  }}
                >
                  Batch trước
                </button>
                <span className="mutedText">
                  {typeof totalIssueCount === "number"
                    ? `${(railStart + 1).toLocaleString("vi-VN")}-${railEnd.toLocaleString("vi-VN")} / ${totalIssueCount.toLocaleString("vi-VN")}`
                    : ""}
                </span>
                <button
                  type="button"
                  className="miniBtn accent"
                  disabled={!canGoNextRail || issueBatchLoading}
                  onClick={() => {
                    const nextStart = railEnd;
                    if (onOpenIssueBatch) {
                      void onOpenIssueBatch(nextStart, issueRailBatchSize);
                    } else {
                      onRailWindowChange?.(nextStart);
                    }
                  }}
                >
                  Batch sau
                </button>
              </div> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
});
