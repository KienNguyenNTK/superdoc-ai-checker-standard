import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  AnalysisSummary,
  AnalysisCacheInfo,
  ChangeRecord,
  CommentRecord,
  HistoryRecord,
  Issue,
  IssueAnnotationWindow,
  IssueFilter,
  ReviewTab,
} from "../../types";

type Props = {
  activeTab: ReviewTab;
  activeFilter: IssueFilter;
  hasReviewResult: boolean;
  applyingIssueId?: string | null;
  analysisSummary?: AnalysisSummary | null;
  cacheInfo?: AnalysisCacheInfo | null;
  issues: Issue[];
  annotatedIssues?: Issue[];
  activeIssueWindow?: IssueAnnotationWindow | null;
  comments: CommentRecord[];
  changes: ChangeRecord[];
  history: HistoryRecord[];
  onTabChange: (tab: ReviewTab) => void;
  onFilterChange: (filter: IssueFilter) => void;
  onFocusIssue: (issue: Issue) => void;
  onApplyIssue: (issue: Issue) => void;
  onIgnoreIssue: (issue: Issue) => void;
  onAnnotateIssue?: (issue: Issue) => void;
  onOpenIssueBatch?: (startIndex: number, count?: number) => void;
  onAnnotateMore?: () => void;
  onAnnotateAll?: () => void;
  onExportAllIssues?: () => void;
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
  if (filter === "annotated") return isAnnotatedIssue(issue);
  if (filter === "unannotated") return !isAnnotatedIssue(issue);
  if (filter === "needs_review") return issue.status === "needs_review";
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

function isAnnotatedIssue(issue: Issue) {
  return Boolean(
    issue.location.commentId ||
      issue.location.changeId ||
      ["commented", "highlighted", "tracked"].includes(issue.status)
  );
}

function getAnnotationLabel(issue: Issue) {
  if (issue.location.changeId || issue.status === "tracked") return "Đã tạo tracked change";
  if (issue.location.commentId || issue.status === "commented") return "Đã bình luận";
  if (issue.status === "highlighted") return "Đã highlight";
  if (issue.status === "applied") return "Đã áp dụng";
  if (issue.status === "ignored") return "Đã bỏ qua";
  return "Chưa annotate";
}

function countFilterIssues(issues: Issue[], filter: IssueFilter) {
  return issues.filter((issue) => matchesFilter(issue, filter)).length;
}

function countBy<T extends string>(issues: Issue[], selector: (issue: Issue) => T) {
  return issues.reduce<Record<string, number>>((acc, issue) => {
    const key = selector(issue);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function ReviewSidebar({
  activeTab,
  activeFilter,
  hasReviewResult,
  applyingIssueId,
  analysisSummary,
  cacheInfo,
  issues,
  annotatedIssues = [],
  activeIssueWindow,
  comments,
  changes,
  history,
  onTabChange,
  onFilterChange,
  onFocusIssue,
  onApplyIssue,
  onIgnoreIssue,
  onAnnotateIssue,
  onOpenIssueBatch,
  onAnnotateMore,
  onAnnotateAll,
  onExportAllIssues,
  onClose,
}: Props) {
  const deferredIssues = useDeferredValue(issues);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [jumpIssueNumber, setJumpIssueNumber] = useState("");
  const pageSize = 200;
  const batchSize = 500;
  const filteredIssues = useMemo(
    () =>
      deferredIssues.filter((issue) => {
        if (!matchesFilter(issue, activeFilter)) return false;
        if (sourceFilter !== "all" && issue.source !== sourceFilter) return false;
        if (statusFilter !== "all" && issue.status !== statusFilter) return false;
        if (typeFilter !== "all" && issue.type !== typeFilter) return false;
        return true;
      }),
    [activeFilter, deferredIssues, sourceFilter, statusFilter, typeFilter]
  );
  const pagedIssues = useMemo(
    () => filteredIssues.slice((page - 1) * pageSize, page * pageSize),
    [filteredIssues, page]
  );
  const maxPage = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const uniqueSources = [...new Set(issues.map((issue) => issue.source))];
  const uniqueStatuses = [...new Set(issues.map((issue) => issue.status))];
  const uniqueTypes = [...new Set(issues.map((issue) => issue.type))];
  const sourceCounts = useMemo(() => countBy(issues, (issue) => issue.source), [issues]);
  const statusCounts = useMemo(() => countBy(issues, (issue) => issue.status), [issues]);
  const typeCounts = useMemo(() => countBy(issues, (issue) => issue.type), [issues]);
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        (["all", "annotated", "unannotated", "needs_review", "spelling", "format", "terminology", "translation", "tone", "entity", "date_number"] as IssueFilter[])
          .map((filter) => [filter, countFilterIssues(issues, filter)])
      ) as Record<IssueFilter, number>,
    [issues]
  );
  const tabTitles = vi.review.tabs;
  const showNoIssuesOverall = issues.length === 0 && hasReviewResult;
  const showNoIssuesForFilter = issues.length > 0 && filteredIssues.length === 0;
  const totalIssueCount = analysisSummary?.detectedIssues ?? issues.length;
  const annotatedCount = analysisSummary?.annotatedIssues ?? annotatedIssues.length;
  const unannotatedCount = Math.max(totalIssueCount - annotatedCount, 0);
  const activeWindowStart = activeIssueWindow ? activeIssueWindow.startIndex + 1 : 0;
  const activeWindowEnd = activeIssueWindow ? activeIssueWindow.endIndex : 0;
  const activeWindowIds = useMemo(
    () => new Set(activeIssueWindow?.issueIds ?? []),
    [activeIssueWindow]
  );
  const nextBatchStart = activeIssueWindow?.endIndex ?? 0;
  const previousBatchStart = Math.max(0, (activeIssueWindow?.startIndex ?? 0) - batchSize);

  useEffect(() => {
    setPage(1);
  }, [activeFilter, sourceFilter, statusFilter, typeFilter, issues.length]);

  return (
    <aside className="reviewSidebar">
      <header className="reviewSidebarHeader">
        <div className="reviewSidebarTitleBlock">
          <div className="eyebrow">{vi.review.eyebrow}</div>
          <div className="reviewSidebarTitleRow">
            <h2>{tabTitles[activeTab]}</h2>
            <span className="issueCountBadge" aria-label={vi.review.issueCountAria(totalIssueCount)}>
              {totalIssueCount}
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
        <>
        <div className="filterStrip">
          {(
            ["all", "annotated", "unannotated", "needs_review", "spelling", "format", "terminology", "translation", "tone", "entity", "date_number"] as IssueFilter[]
          ).map((filter) => (
            <button
              key={filter}
              className={`filterChip ${activeFilter === filter ? "active" : ""}`}
              onClick={() => onFilterChange(filter)}
            >
              <span>{vi.review.filters[filter]}</span>
              <strong>{filterCounts[filter].toLocaleString("vi-VN")}</strong>
            </button>
          ))}
        </div>
        <div className="reviewSelectRow">
          <select className="topSelect" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
            <option value="all">Mọi nguồn</option>
            {uniqueSources.map((source) => (
              <option key={source} value={source}>{source} ({(sourceCounts[source] ?? 0).toLocaleString("vi-VN")})</option>
            ))}
          </select>
          <select className="topSelect" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Mọi trạng thái</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>{status} ({(statusCounts[status] ?? 0).toLocaleString("vi-VN")})</option>
            ))}
          </select>
          <select className="topSelect" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Mọi loại lỗi</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>{type} ({(typeCounts[type] ?? 0).toLocaleString("vi-VN")})</option>
            ))}
          </select>
        </div>
        </>
      ) : null}

      <div className="reviewPane">
        {activeTab === "issues" && (
          <div className="reviewList">
            {analysisSummary && unannotatedCount > 0 ? (
              <div className="reviewSummaryNotice">
                <strong>
                  Phát hiện {analysisSummary.detectedIssues.toLocaleString("vi-VN")} lỗi
                </strong>
                <div className="reviewSummaryStats">
                  <span>Chắc chắn: {analysisSummary.confirmedErrorCount.toLocaleString("vi-VN")}</span>
                  <span>Cần rà soát: {analysisSummary.needsReviewCount.toLocaleString("vi-VN")}</span>
                  <span>Đã annotate: {annotatedCount.toLocaleString("vi-VN")}</span>
                  <span>Chưa annotate: {unannotatedCount.toLocaleString("vi-VN")}</span>
                  <span>Đang xem: {filteredIssues.length.toLocaleString("vi-VN")}</span>
                </div>
                <span>
                  Toàn bộ lỗi đã được giữ trong danh sách. Chỉ batch đang mở mới được nạp comment/highlight vào DOCX để tránh làm SuperDoc quá tải.
                </span>
                <span>
                  Batch DOCX hiện tại: {activeIssueWindow ? `${activeWindowStart.toLocaleString("vi-VN")}-${activeWindowEnd.toLocaleString("vi-VN")}` : "chưa mở batch"} / {totalIssueCount.toLocaleString("vi-VN")} lỗi.
                </span>
                {cacheInfo?.cacheHit ? (
                  <span>
                    Đã dùng kết quả phân tích đã lưu cho file này. Cache key: {cacheInfo.cacheKey?.slice(0, 12)}...
                  </span>
                ) : null}
                <div className="reviewSummaryActions">
                  {onOpenIssueBatch ? <button type="button" className="miniBtn accent" onClick={() => onOpenIssueBatch(0, batchSize)}>Mở batch 1-500</button> : null}
                  {onOpenIssueBatch ? <button type="button" className="miniBtn" disabled={!activeIssueWindow || activeIssueWindow.startIndex <= 0} onClick={() => onOpenIssueBatch(previousBatchStart, batchSize)}>Batch trước</button> : null}
                  {onAnnotateMore ? <button type="button" className="miniBtn" disabled={nextBatchStart >= totalIssueCount} onClick={onAnnotateMore}>Batch sau</button> : null}
                  {onAnnotateAll ? <button type="button" className="miniBtn ghost" onClick={onAnnotateAll}>Annotate tất cả lỗi</button> : null}
                  {onExportAllIssues ? <button type="button" className="miniBtn ghost" onClick={onExportAllIssues}>Export all issues JSON</button> : null}
                </div>
                {onOpenIssueBatch ? (
                  <form
                    className="issueJumpRow"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const issueNumber = Math.max(1, Math.min(totalIssueCount, Number(jumpIssueNumber || 1)));
                      const startIndex = Math.floor((issueNumber - 1) / batchSize) * batchSize;
                      onOpenIssueBatch(startIndex, batchSize);
                    }}
                  >
                    <input
                      className="issueJumpInput"
                      inputMode="numeric"
                      value={jumpIssueNumber}
                      onChange={(event) => setJumpIssueNumber(event.target.value.replace(/\D/g, ""))}
                      placeholder="Nhảy tới lỗi #"
                      aria-label="Nhảy tới số thứ tự lỗi"
                    />
                    <button type="submit" className="miniBtn">Mở batch</button>
                  </form>
                ) : null}
              </div>
            ) : null}
            {analysisSummary && unannotatedCount === 0 ? (
              <div className="reviewSummaryNotice reviewSummaryNotice-compact">
                <strong>Tổng kết rà soát</strong>
                <div className="reviewSummaryStats">
                  <span>Chắc chắn: {analysisSummary.confirmedErrorCount.toLocaleString("vi-VN")}</span>
                  <span>Cần rà soát: {analysisSummary.needsReviewCount.toLocaleString("vi-VN")}</span>
                  <span>Đã annotate: {annotatedCount.toLocaleString("vi-VN")}</span>
                  <span>Đang xem: {filteredIssues.length.toLocaleString("vi-VN")}</span>
                </div>
              </div>
            ) : null}
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
              pagedIssues.map((issue) => (
                <article className={`reviewCard issue-${issue.status}`} key={issue.id}>
                  <div className="cardMeta">
                    <span>{labelIssueType(issue.type)}</span>
                    <span>{labelIssueConfidence(issue.confidence)}</span>
                    <span>{labelIssueSeverity(issue.severity)}</span>
                    <span className={`cardStatus ${isAnnotatedIssue(issue) ? "cardStatus-annotated" : "cardStatus-unannotated"}`}>
                      {activeWindowIds.has(issue.id) ? getAnnotationLabel(issue) : "Chưa nạp vào DOCX"}
                    </span>
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
                    {isAnnotatedIssue(issue) ? (
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
                    ) : activeWindowIds.has(issue.id) && onAnnotateIssue && !["applied", "ignored"].includes(issue.status) ? (
                      <button
                        className="miniBtn accent"
                        onClick={() => onAnnotateIssue(issue)}
                        disabled={applyingIssueId === issue.id}
                      >
                        {applyingIssueId === issue.id ? "Đang annotate..." : "Annotate lỗi này"}
                      </button>
                    ) : onOpenIssueBatch && !["applied", "ignored"].includes(issue.status) ? (
                      <button
                        className="miniBtn accent"
                        onClick={() => onFocusIssue(issue)}
                        disabled={applyingIssueId === issue.id}
                      >
                        {applyingIssueId === issue.id ? "Đang mở batch..." : "Mở batch chứa lỗi này"}
                      </button>
                    ) : null}
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
            {filteredIssues.length > pageSize ? (
              <div className="reviewPager">
                <button type="button" className="miniBtn" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Trang trước
                </button>
                <span className="mutedText">Trang {page} / {maxPage} • {filteredIssues.length.toLocaleString("vi-VN")} lỗi</span>
                <button type="button" className="miniBtn" disabled={page >= maxPage} onClick={() => setPage((current) => Math.min(maxPage, current + 1))}>
                  Trang sau
                </button>
              </div>
            ) : null}
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
