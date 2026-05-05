import { useDeferredValue } from "react";
import { ClipboardList, X } from "lucide-react";
import {
  labelChangeStatus,
  labelHistoryType,
  labelIssueConfidence,
  labelIssueType,
  vi,
} from "../../i18n";
import type {
  ChangeRecord,
  CommentRecord,
  HistoryRecord,
  ReviewTab,
  SpellingIssue,
} from "../../types";

type Props = {
  activeTab: ReviewTab;
  issues: SpellingIssue[];
  comments: CommentRecord[];
  changes: ChangeRecord[];
  history: HistoryRecord[];
  onTabChange: (tab: ReviewTab) => void;
  onFocusIssue: (issue: SpellingIssue) => void;
  onApplyIssue: (issue: SpellingIssue) => void;
  onIgnoreIssue: (issue: SpellingIssue) => void;
  onClose?: () => void;
};

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ReviewSidebar({
  activeTab,
  issues,
  comments,
  changes,
  history,
  onTabChange,
  onFocusIssue,
  onApplyIssue,
  onIgnoreIssue,
  onClose,
}: Props) {
  const deferredIssues = useDeferredValue(issues);
  const tabTitles = vi.review.tabs;

  return (
    <aside className="reviewSidebar">
      <header className="reviewSidebarHeader">
        <div className="reviewSidebarTitleBlock">
          <div className="eyebrow">{vi.review.eyebrow}</div>
          <div className="reviewSidebarTitleRow">
            <h2>{tabTitles[activeTab]}</h2>
            <span className="issueCountBadge" aria-label={vi.review.issueCountAria(issues.length)}>
              {issues.length}
            </span>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            className="reviewCloseButton"
            onClick={onClose}
            aria-label={vi.common.closePanelAria}
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </header>

      <div className="tabStrip">
        {(
          [
            ["issues", tabTitles.issues],
            ["comments", tabTitles.comments],
            ["changes", tabTitles.changes],
            ["history", tabTitles.history],
          ] as Array<[ReviewTab, string]>
        ).map(([tab, label]) => (
          <button
            key={tab}
            className={`tabButton ${activeTab === tab ? "active" : ""}`}
            onClick={() => onTabChange(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="reviewPane">
        {activeTab === "issues" && (
          <div className="reviewList">
            {deferredIssues.length === 0 ? (
              <div className="reviewEmpty">
                <div className="reviewEmptyIcon">
                  <ClipboardList size={36} strokeWidth={1.5} aria-hidden />
                </div>
                <p className="reviewEmptyTitle">{vi.review.emptyIssuesTitle}</p>
                <p className="reviewEmptyHint">
                  {vi.review.emptyIssuesHintBefore}
                  <strong>{vi.common.checkSpelling}</strong>
                  {vi.review.emptyIssuesHintOrAgent}
                  <strong>{vi.review.emptyIssuesHintAgentWord}</strong>
                  {vi.review.emptyIssuesHintBeforeFile}
                  <code className="reviewEmptyCode">reviewed.docx</code>.
                </p>
              </div>
            ) : (
              deferredIssues.map((issue) => (
                <article className={`reviewCard issue-${issue.status}`} key={issue.id}>
                  <div className="cardMeta">
                    <span>{labelIssueType(issue.type)}</span>
                    <span>{labelIssueConfidence(issue.confidence)}</span>
                  </div>
                  <h3>
                    {issue.wrong} → {issue.suggestion}
                  </h3>
                  <p>{issue.reason}</p>
                  <small>{issue.location.path}</small>
                  <div className="cardActions">
                    <button className="miniBtn" onClick={() => onFocusIssue(issue)}>
                      {vi.review.goToIssue}
                    </button>
                    <button className="miniBtn accent" onClick={() => onApplyIssue(issue)}>
                      {vi.review.apply}
                    </button>
                    <button className="miniBtn ghost" onClick={() => onIgnoreIssue(issue)}>
                      {vi.review.ignore}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === "comments" && (
          <div className="reviewList">
            {comments.length === 0 ? (
              <div className="reviewEmpty reviewEmpty--compact">
                <p className="reviewEmptyTitle">{vi.review.emptyCommentsTitle}</p>
                <p className="reviewEmptyHint">{vi.review.emptyCommentsHint}</p>
              </div>
            ) : null}
            {comments.map((comment) => (
              <article className="reviewCard" key={comment.id}>
                <div className="cardMeta">
                  <span>{comment.author}</span>
                  <span>{formatTime(comment.createdAt)}</span>
                </div>
                <h3>
                  {vi.review.commentAddedOn(
                    comment.targetText || vi.review.selectionFallback
                  )}
                </h3>
                <p>{comment.text}</p>
              </article>
            ))}
          </div>
        )}

        {activeTab === "changes" && (
          <div className="reviewList">
            {changes.length === 0 ? (
              <div className="reviewEmpty">{vi.review.emptyChanges}</div>
            ) : (
              changes.map((change) => (
                <article className="reviewCard" key={change.id}>
                  <div className="cardMeta">
                    <span>{change.author}</span>
                    <span>{formatTime(change.createdAt)}</span>
                  </div>
                  <h3>
                    {change.type === "replace"
                      ? vi.review.changeReplace(change.oldText ?? "", change.newText ?? "")
                      : change.type === "insert"
                        ? vi.review.changeInsert(change.newText ?? "")
                        : vi.review.changeDelete(change.oldText ?? "")}
                  </h3>
                  <p>
                    {vi.review.changeStatusLabel}: {labelChangeStatus(change.status)}
                  </p>
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="reviewList">
            {history.length === 0 ? (
              <div className="reviewEmpty reviewEmpty--compact">
                <p className="reviewEmptyTitle">{vi.review.emptyHistoryTitle}</p>
                <p className="reviewEmptyHint">{vi.review.emptyHistoryHint}</p>
              </div>
            ) : null}
            {history.map((item) => (
              <article className="reviewCard historyCard" key={item.id}>
                <div className="cardMeta">
                  <span>{labelHistoryType(item.type)}</span>
                  <span>{formatTime(item.createdAt)}</span>
                </div>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
