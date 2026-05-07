import { useDeferredValue } from "react";
import { ClipboardList, X } from "lucide-react";
import {
  labelChangeStatus,
  labelHistoryType,
  labelIssueConfidence,
  labelIssueSeverity,
  labelIssueSource,
  labelIssueStatus,
  labelIssueType,
  vi,
} from "../../i18n";
import type {
  ChangeRecord,
  CommentRecord,
  HistoryRecord,
  Issue,
  IssueFilter,
  ReviewTab,
} from "../../types";

type Props = {
  activeTab: ReviewTab;
  activeFilter: IssueFilter;
  hasReviewResult: boolean;
  applyingIssueId?: string | null;
  issues: Issue[];
  comments: CommentRecord[];
  changes: ChangeRecord[];
  history: HistoryRecord[];
  onTabChange: (tab: ReviewTab) => void;
  onFilterChange: (filter: IssueFilter) => void;
  onFocusIssue: (issue: Issue) => void;
  onApplyIssue: (issue: Issue) => void;
  onIgnoreIssue: (issue: Issue) => void;
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

function matchesFilter(issue: Issue, filter: IssueFilter) {
  if (filter === "all") return true;
  if (filter === "spelling") {
    return ["spelling", "accent", "typo", "grammar", "style"].includes(issue.type);
  }
  if (filter === "format") {
    return ["format_consistency", "heading_consistency", "table_format_consistency"].includes(issue.type);
  }
  if (filter === "terminology") return issue.type === "terminology_consistency";
  if (filter === "translation") return issue.type === "translation_consistency";
  if (filter === "tone") return issue.type === "tone_consistency";
  if (filter === "entity") return issue.type === "name_consistency";
  if (filter === "date_number") return issue.type === "date_number_consistency";
  return true;
}

export function ReviewSidebar({
  activeTab,
  activeFilter,
  hasReviewResult,
  applyingIssueId,
  issues,
  comments,
  changes,
  history,
  onTabChange,
  onFilterChange,
  onFocusIssue,
  onApplyIssue,
  onIgnoreIssue,
  onClose,
}: Props) {
  const deferredIssues = useDeferredValue(issues);
  const filteredIssues = deferredIssues.filter((issue) => matchesFilter(issue, activeFilter));
  const tabTitles = vi.review.tabs;
  const showNoIssuesOverall = issues.length === 0 && hasReviewResult;
  const showNoIssuesForFilter = issues.length > 0 && filteredIssues.length === 0;

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

      {activeTab === "issues" ? (
        <div className="filterStrip">
          {(
            ["all", "spelling", "format", "terminology", "translation", "tone", "entity", "date_number"] as IssueFilter[]
          ).map((filter) => (
            <button
              key={filter}
              className={`filterChip ${activeFilter === filter ? "active" : ""}`}
              onClick={() => onFilterChange(filter)}
            >
              {vi.review.filters[filter]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="reviewPane">
        {activeTab === "issues" && (
          <div className="reviewList">
            {filteredIssues.length === 0 ? (
              <div className="reviewEmpty">
                <div className="reviewEmptyIcon">
                  <ClipboardList size={36} strokeWidth={1.5} aria-hidden />
                </div>
                {showNoIssuesOverall ? (
                  <>
                    <p className="reviewEmptyTitle">{vi.review.noIssuesAfterReviewTitle}</p>
                    <p className="reviewEmptyHint">{vi.review.noIssuesAfterReviewHint}</p>
                  </>
                ) : showNoIssuesForFilter ? (
                  <>
                    <p className="reviewEmptyTitle">{vi.review.emptyFilteredIssuesTitle}</p>
                    <p className="reviewEmptyHint">{vi.review.emptyFilteredIssuesHint}</p>
                  </>
                ) : (
                  <>
                    <p className="reviewEmptyTitle">{vi.review.emptyIssuesTitle}</p>
                    <p className="reviewEmptyHint">
                      {vi.review.emptyIssuesHintBefore}
                      <strong>{vi.common.analyzeConsistency}</strong>
                      {vi.review.emptyIssuesHintOrAgent}
                      <strong>{vi.review.emptyIssuesHintAgentWord}</strong>
                      {vi.review.emptyIssuesHintBeforeFile}
                      <code className="reviewEmptyCode">reviewed-consistency.docx</code>.
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <article className={`reviewCard issue-${issue.status}`} key={issue.id}>
                  <div className="cardMeta">
                    <span>{labelIssueType(issue.type)}</span>
                    <span>{labelIssueConfidence(issue.confidence)}</span>
                    <span>{labelIssueSeverity(issue.severity)}</span>
                    <span className={`cardStatus cardStatus-${issue.status}`}>
                      {labelIssueStatus(issue.status)}
                    </span>
                  </div>
                  <h3>
                    {issue.wrong} → {issue.suggestion}
                  </h3>
                  <p>{issue.reason}</p>
                  <small>{issue.location.path}</small>
                  <small>
                    {vi.review.sourceLabel}: {labelIssueSource(issue.source)}
                  </small>
                  <div className="cardActions">
                    <button className="miniBtn" onClick={() => onFocusIssue(issue)}>
                      {vi.review.goToIssue}
                    </button>
                    <button
                      className="miniBtn accent"
                      onClick={() => onApplyIssue(issue)}
                      disabled={applyingIssueId === issue.id || issue.status === "applied"}
                    >
                      {applyingIssueId === issue.id
                        ? vi.review.applying
                        : issue.status === "applied"
                          ? vi.review.applied
                          : vi.review.apply}
                    </button>
                    <button
                      className="miniBtn ghost"
                      onClick={() => onIgnoreIssue(issue)}
                      disabled={issue.status === "applied" || issue.status === "ignored"}
                    >
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
                        : change.type === "delete"
                          ? vi.review.changeDelete(change.oldText ?? "")
                          : `Định dạng: ${change.newText ?? change.oldText ?? ""}`}
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
