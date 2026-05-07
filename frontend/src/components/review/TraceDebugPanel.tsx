import { useMemo, useState } from "react";
import { Bug, RefreshCw, X } from "lucide-react";
import type {
  AnalysisTraceArtifact,
  AnalysisTraceIssueRecord,
  AnalysisTraceSummary,
  ClientTraceEvent,
  IssueStatus,
  IssueType,
  IssueSource,
} from "../../types";

type Props = {
  traceEnabled: boolean;
  traceSummary?: AnalysisTraceSummary | null;
  traceFileUrl?: string | null;
  trace?: AnalysisTraceArtifact | null;
  clientEvents: ClientTraceEvent[];
  loading?: boolean;
  onRefresh: () => void | Promise<void>;
  onClose?: () => void;
};

type TraceFilter =
  | "all"
  | "budget"
  | "range"
  | "annotation"
  | "response";

type TraceDiagnosis = {
  tone: "warning" | "info";
  title: string;
  message: string;
  recommendedFilter?: TraceFilter;
  recommendedLabel?: string;
};

function matchesTraceFilter(issue: AnalysisTraceIssueRecord, filter: TraceFilter) {
  if (filter === "all") return true;
  if (filter === "budget") {
    return issue.dropReason === "trimmed_by_max_issues" || issue.dropReason === "not_loaded_into_annotation_batch";
  }
  if (filter === "range") {
    return issue.events.some((event) => event.decision === "range_not_found");
  }
  if (filter === "annotation") {
    return issue.dropReason === "annotation_skipped";
  }
  if (filter === "response") {
    return issue.returnedToUi === true;
  }
  return true;
}

function stageDelta(current: number, previous: number) {
  const delta = current - previous;
  return delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`;
}

function formatTraceNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function topEntries(record: Record<string, number>, limit = 6) {
  return Object.entries(record)
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function buildTraceDiagnosis(
  summary: AnalysisTraceSummary,
  trace: AnalysisTraceArtifact | null | undefined,
  clientEvents: ClientTraceEvent[]
): TraceDiagnosis {
  const largestLoss = [
    { key: "budget", value: summary.droppedByBudget },
    { key: "range", value: summary.rangeNotFound },
    { key: "annotation", value: summary.skippedAnnotation },
  ].sort((left, right) => right.value - left.value)[0];
  const focusFailures = clientEvents.filter((event) => event.decision === "focus_display_failed").length;
  const refreshFailures = clientEvents.filter((event) => event.decision === "trace_refresh_failed").length;
  const returnedWithoutAnnotation = Math.max(summary.returnedToUi - summary.annotatedInDocx, 0);
  const activeIssues = trace?.issues ?? [];
  const uiIssues = activeIssues.filter((issue) => issue.returnedToUi).length;
  const unresolvedUiIssues = activeIssues.filter(
    (issue) =>
      issue.returnedToUi &&
      issue.events.some((event) => event.stage === "range_resolution" && event.decision === "range_not_found")
  ).length;

  const isListFirstBatchMode =
    Boolean(trace?.request.annotateFromCache === false) &&
    summary.returnedToUi > 0 &&
    summary.annotatedInDocx === 0;

  if (isListFirstBatchMode) {
    return {
      tone: "info",
      title: "Đã tải đủ danh sách lỗi, chưa mở batch DOCX",
      message: `${summary.returnedToUi.toLocaleString("vi-VN")} issue đã có trong UI/session từ cache. Đây là trạng thái đúng để test chuyển batch: DOCX chưa có comment/highlight vì bạn chưa mở batch 500 lỗi nào.`,
      recommendedFilter: "response",
      recommendedLabel: "Có trong UI",
    };
  }

  if (largestLoss?.key === "budget" && largestLoss.value > 0) {
    return {
      tone: "info",
      title: "Một phần issue chưa nạp vào batch DOCX",
      message: `${summary.droppedByBudget.toLocaleString("vi-VN")} issue chưa có comment/highlight trong DOCX active. Đây không phải mất lỗi; hãy mở batch chứa issue cần xem để SuperDoc nạp đúng vùng đó.`,
      recommendedFilter: "budget",
      recommendedLabel: "Chưa nạp batch",
    };
  }

  if (largestLoss?.key === "range" && largestLoss.value > 0) {
    return {
      tone: "warning",
      title: "Nhiều lỗi không resolve được vị trí trong DOCX",
      message: `${summary.rangeNotFound.toLocaleString("vi-VN")} issue không tìm được range chính xác. Vấn đề hiện nghiêng về mapping text/block/range hơn là detector.`,
      recommendedFilter: "range",
      recommendedLabel: "Range not found",
    };
  }

  if (largestLoss?.key === "annotation" && largestLoss.value > 0) {
    return {
      tone: "warning",
      title: "Backend có issue nhưng SuperDoc không annotate hết",
      message: `${summary.skippedAnnotation.toLocaleString("vi-VN")} issue đã đi qua bước chọn nhưng không tạo được comment/highlight/track-change. Nên kiểm tra luồng annotation thay vì detector.`,
      recommendedFilter: "annotation",
      recommendedLabel: "Không annotate",
    };
  }

  if (focusFailures > 0) {
    return {
      tone: "warning",
      title: "Issue đã về UI nhưng thao tác focus/display đang lỗi",
      message: `Có ${focusFailures.toLocaleString("vi-VN")} lần client báo focus/display thất bại. Backend đã trả issue, cần kiểm tra phía frontend hoặc workspace focus logic.`,
      recommendedFilter: "response",
      recommendedLabel: "Có trong UI",
    };
  }

  if (returnedWithoutAnnotation > 0) {
    return {
      tone: "info",
      title: "Một phần issue chỉ nằm trong response, không có annotate tương ứng",
      message: `${returnedWithoutAnnotation.toLocaleString("vi-VN")} issue đã được trả về UI nhiều hơn số annotate thành công. Đây thường là case comment-only hoặc annotation fallback, nên cần đối chiếu trace issue cụ thể.`,
      recommendedFilter: "response",
      recommendedLabel: "Có trong UI",
    };
  }

  if (unresolvedUiIssues > 0) {
    return {
      tone: "info",
      title: "UI đang có issue nhưng một phần vẫn không resolve được vị trí",
      message: `${unresolvedUiIssues.toLocaleString("vi-VN")} issue đã về UI nhưng có event range_not_found. Nếu người dùng thấy không nhảy đúng chỗ, lỗi nằm ở mapping range.`,
      recommendedFilter: "range",
      recommendedLabel: "Range not found",
    };
  }

  if (refreshFailures > 0) {
    return {
      tone: "info",
      title: "Trace backend có thể ổn nhưng client refresh trace từng lỗi",
      message: `Có ${refreshFailures.toLocaleString("vi-VN")} lần client không tải được artifact trace. Nếu panel thiếu dữ liệu, hãy kiểm tra endpoint trace hoặc network client.`,
    };
  }

  if (summary.afterSelection === summary.returnedToUi && summary.afterSelection === uiIssues) {
    return {
      tone: "info",
      title: "Backend đang trả đủ issue đã chọn",
      message: "Luồng trace hiện chưa cho thấy issue bị mất sau backend. Nếu sidebar vẫn thấy thiếu, ưu tiên kiểm tra filter, tab hiện tại hoặc logic render/focus ở frontend.",
      recommendedFilter: "response",
      recommendedLabel: "Có trong UI",
    };
  }

  return {
    tone: "info",
    title: "Chưa thấy điểm rơi lỗi áp đảo ở một stage cụ thể",
    message: "Hãy xem từng nhóm issue phía dưới để xác định case cụ thể nằm ở detector, dedup/select, range hay annotation.",
  };
}

export function TraceDebugPanel({
  traceEnabled,
  traceSummary,
  traceFileUrl,
  trace,
  clientEvents,
  loading,
  onRefresh,
  onClose,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<TraceFilter>("all");
  const traceIssues = trace?.issues ?? [];
  const filteredIssues = useMemo(
    () => traceIssues.filter((issue) => matchesTraceFilter(issue, activeFilter)),
    [activeFilter, traceIssues]
  );
  const summary = trace?.summary ?? traceSummary ?? null;
  const diagnosis = useMemo(
    () => (summary ? buildTraceDiagnosis(summary, trace, clientEvents) : null),
    [clientEvents, summary, trace]
  );
  const diagnosisFilter = diagnosis?.recommendedFilter;
  const filterCounts = useMemo(
    () => ({
      all: traceIssues.length,
      budget: traceIssues.filter(
        (issue) =>
          issue.dropReason === "trimmed_by_max_issues" ||
          issue.dropReason === "not_loaded_into_annotation_batch"
      ).length,
      range: traceIssues.filter((issue) =>
        issue.events.some((event) => event.decision === "range_not_found")
      ).length,
      annotation: traceIssues.filter((issue) => issue.dropReason === "annotation_skipped").length,
      response: traceIssues.filter((issue) => issue.returnedToUi === true).length,
    }),
    [traceIssues]
  );
  const issueBreakdowns = useMemo(
    () => ({
      bySource: topEntries(countBy(traceIssues.map((issue) => issue.source as IssueSource))),
      byStatus: topEntries(countBy(traceIssues.map((issue) => issue.status as IssueStatus))),
      byType: topEntries(countBy(traceIssues.map((issue) => issue.type as IssueType))),
      byResolution: topEntries(
        countBy(traceIssues.map((issue) => issue.resolution ?? "unresolved"))
      ),
      byDropReason: topEntries(
        countBy(traceIssues.map((issue) => issue.dropReason ?? "active_or_returned"))
      ),
    }),
    [traceIssues]
  );

  return (
    <aside className="tracePanel">
      <header className="tracePanelHeader">
        <div>
          <div className="eyebrow">DEBUG TRACE</div>
          <div className="tracePanelTitleRow">
            <h2>Luồng phân tích</h2>
            {traceEnabled ? <span className="traceBadge">Đang bật</span> : <span className="traceBadge muted">Đang tắt</span>}
          </div>
        </div>
        <div className="tracePanelHeaderActions">
          <button type="button" className="iconGhostBtn" onClick={() => void onRefresh()} aria-label="Làm mới trace">
            <RefreshCw size={18} aria-hidden />
          </button>
          {onClose ? (
            <button type="button" className="reviewCloseButton" onClick={onClose} aria-label="Đóng panel trace">
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      <div className="tracePanelBody">
        {!summary ? (
            <div className="reviewEmpty">
            <div className="reviewEmptyIcon">
              <Bug size={36} strokeWidth={1.5} aria-hidden />
            </div>
            <p className="reviewEmptyTitle">Chưa có trace</p>
            <p className="reviewEmptyHint">Trace hiện được ghi tự động cho mọi lần phân tích. Hãy chạy lại phân tích nếu chưa có artifact.</p>
          </div>
        ) : (
          <>
            {diagnosis ? (
              <section className={`traceDiagnosis traceDiagnosis--${diagnosis.tone}`}>
                <div className="traceDiagnosisHeader">
                  <strong>{diagnosis.title}</strong>
                  {diagnosis.recommendedFilter && diagnosis.recommendedLabel ? (
                    <button
                      type="button"
                      className="miniBtn accent"
                      onClick={() => diagnosisFilter && setActiveFilter(diagnosisFilter)}
                    >
                      Xem nhóm {diagnosis.recommendedLabel}
                    </button>
                  ) : null}
                </div>
                <p>{diagnosis.message}</p>
              </section>
            ) : null}

            <section className="traceFlow">
              <div className="traceStageCard">
                <strong>Cache</strong>
                <span>{trace?.cache?.cacheHit || summary.cacheHit ? "HIT" : "MISS"}</span>
              </div>
              <div className="traceStageCard">
                <strong>Detector</strong>
                <span>{summary.detectedByDetector.toLocaleString("vi-VN")}</span>
              </div>
              <div className="traceStageCard">
                <strong>After dedup</strong>
                <span>{summary.afterDedup.toLocaleString("vi-VN")}</span>
                <small>{stageDelta(summary.afterDedup, summary.detectedByDetector)}</small>
              </div>
              <div className="traceStageCard">
                <strong>Đã nạp vào batch DOCX</strong>
                <span>{summary.afterSelection.toLocaleString("vi-VN")}</span>
                <small>{stageDelta(summary.afterSelection, summary.afterDedup)}</small>
              </div>
              <div className="traceStageCard">
                <strong>Resolved/annotated</strong>
                <span>{summary.annotatedInDocx.toLocaleString("vi-VN")}</span>
                <small>{stageDelta(summary.annotatedInDocx, summary.afterSelection)}</small>
              </div>
              <div className="traceStageCard">
                <strong>Returned UI</strong>
                <span>{summary.returnedToUi.toLocaleString("vi-VN")}</span>
                <small>{stageDelta(summary.returnedToUi, summary.annotatedInDocx)}</small>
              </div>
            </section>

            <section className="traceSummaryGrid">
              <div className="traceMetric"><span>Chưa nạp vào batch DOCX</span><strong>{summary.droppedByBudget.toLocaleString("vi-VN")}</strong></div>
              <div className="traceMetric"><span>Duplicate bị bỏ</span><strong>{summary.duplicatesRemoved.toLocaleString("vi-VN")}</strong></div>
              <div className="traceMetric"><span>Range not found</span><strong>{summary.rangeNotFound.toLocaleString("vi-VN")}</strong></div>
              <div className="traceMetric"><span>Annotation skipped</span><strong>{summary.skippedAnnotation.toLocaleString("vi-VN")}</strong></div>
              <div className="traceMetric"><span>Comment created</span><strong>{summary.commentCreated.toLocaleString("vi-VN")}</strong></div>
              <div className="traceMetric"><span>Highlight applied</span><strong>{summary.highlightApplied.toLocaleString("vi-VN")}</strong></div>
              <div className="traceMetric"><span>Tracked changes</span><strong>{summary.trackedChangeCreated.toLocaleString("vi-VN")}</strong></div>
              <div className="traceMetric"><span>Cần rà soát</span><strong>{summary.needsReviewCount.toLocaleString("vi-VN")}</strong></div>
            </section>

            {trace ? (
              <>
                <section className="traceSectionCard">
                  <div className="traceSectionTitle">Thông tin request và input</div>
                  <div className="traceSummaryGrid">
                    <div className="traceMetric"><span>Checks</span><strong>{trace.request.checks.join(", ") || "none"}</strong></div>
                    <div className="traceMetric"><span>Mode</span><strong>{trace.request.mode}</strong></div>
                    <div className="traceMetric"><span>useLLM</span><strong>{String(trace.request.useLLM)}</strong></div>
                    <div className="traceMetric"><span>useRuleEngine</span><strong>{String(trace.request.useRuleEngine)}</strong></div>
                    <div className="traceMetric"><span>Kích thước batch annotate</span><strong>{formatTraceNumber(trace.request.maxAnnotatedIssues)}</strong></div>
                    <div className="traceMetric"><span>Trace</span><strong>{trace.request.debugTrace ? "always_on" : "off"}</strong></div>
                    <div className="traceMetric"><span>Cache hit</span><strong>{trace.cache?.cacheHit ? "true" : "false"}</strong></div>
                    <div className="traceMetric"><span>Force reanalyze</span><strong>{String(trace.cache?.forceReanalyze ?? trace.request.forceReanalyze ?? false)}</strong></div>
                    <div className="traceMetric"><span>Cached at</span><strong>{trace.cache?.cachedAt ?? summary.cachedAt ?? "n/a"}</strong></div>
                    <div className="traceMetric"><span>Cache key</span><strong>{trace.cache?.cacheKey?.slice(0, 16) ?? summary.cacheKey?.slice(0, 16) ?? "n/a"}</strong></div>
                    <div className="traceMetric"><span>Blocks</span><strong>{formatTraceNumber(trace.stages.inputBlocks.blocks)}</strong></div>
                    <div className="traceMetric"><span>Unique templates</span><strong>{formatTraceNumber(trace.stages.inputBlocks.uniqueTemplates)}</strong></div>
                    <div className="traceMetric"><span>Representative chunks</span><strong>{formatTraceNumber(trace.stages.inputBlocks.representativeChunks)}</strong></div>
                  </div>
                </section>

                <section className="traceSectionCard">
                  <div className="traceSectionTitle">Detector breakdown</div>
                  <div className="traceSummaryGrid">
                    <div className="traceMetric"><span>Rule issues</span><strong>{formatTraceNumber(trace.stages.detectorOutput.ruleIssues)}</strong></div>
                    <div className="traceMetric"><span>Dictionary suspicion</span><strong>{formatTraceNumber(trace.stages.detectorOutput.dictionarySuspicionIssues)}</strong></div>
                    <div className="traceMetric"><span>LLM issues</span><strong>{formatTraceNumber(trace.stages.detectorOutput.llmIssues)}</strong></div>
                    <div className="traceMetric"><span>Merged issues</span><strong>{formatTraceNumber(trace.stages.detectorOutput.mergedIssues)}</strong></div>
                    <div className="traceMetric"><span>Confirmed errors</span><strong>{formatTraceNumber(trace.stages.detectorOutput.confirmedErrorCount)}</strong></div>
                    <div className="traceMetric"><span>Needs review</span><strong>{formatTraceNumber(trace.stages.detectorOutput.needsReviewCount)}</strong></div>
                    <div className="traceMetric"><span>Source: rule_engine</span><strong>{formatTraceNumber(trace.stages.detectorOutput.bySource.rule_engine)}</strong></div>
                    <div className="traceMetric"><span>Source: llm</span><strong>{formatTraceNumber(trace.stages.detectorOutput.bySource.llm)}</strong></div>
                    <div className="traceMetric"><span>Source: hybrid</span><strong>{formatTraceNumber(trace.stages.detectorOutput.bySource.hybrid)}</strong></div>
                  </div>
                </section>

                <section className="traceSectionCard">
                  <div className="traceSectionTitle">Range, annotation và payload</div>
                  <div className="traceSummaryGrid">
                    <div className="traceMetric"><span>Resolved exact</span><strong>{formatTraceNumber(trace.stages.rangeResolution.exact)}</strong></div>
                    <div className="traceMetric"><span>Resolved fuzzy</span><strong>{formatTraceNumber(trace.stages.rangeResolution.fuzzy)}</strong></div>
                    <div className="traceMetric"><span>Resolved ambiguous</span><strong>{formatTraceNumber(trace.stages.rangeResolution.ambiguous)}</strong></div>
                    <div className="traceMetric"><span>Resolved not found</span><strong>{formatTraceNumber(trace.stages.rangeResolution.notFound)}</strong></div>
                    <div className="traceMetric"><span>Comment created</span><strong>{formatTraceNumber(trace.stages.annotation.commentCreated)}</strong></div>
                    <div className="traceMetric"><span>Highlight applied</span><strong>{formatTraceNumber(trace.stages.annotation.highlightApplied)}</strong></div>
                    <div className="traceMetric"><span>Tracked change created</span><strong>{formatTraceNumber(trace.stages.annotation.trackedChangeCreated)}</strong></div>
                    <div className="traceMetric"><span>Annotated in DOCX</span><strong>{formatTraceNumber(trace.stages.annotation.annotatedInDocx)}</strong></div>
                    <div className="traceMetric"><span>Skipped annotation</span><strong>{formatTraceNumber(trace.stages.annotation.skippedAnnotation)}</strong></div>
                    <div className="traceMetric"><span>Returned to UI</span><strong>{formatTraceNumber(trace.stages.responsePayload.returnedToUi)}</strong></div>
                  </div>
                </section>

                <section className="traceSectionCard">
                  <div className="traceSectionTitle">Tóm tắt issue theo nhóm</div>
                  <div className="traceTagGrid">
                    <div className="traceTagGroup">
                      <strong>Theo source</strong>
                      <div className="traceTagList">
                        {issueBreakdowns.bySource.map(([label, value]) => (
                          <span key={label} className="traceTag">{label}: {formatTraceNumber(value)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="traceTagGroup">
                      <strong>Theo status</strong>
                      <div className="traceTagList">
                        {issueBreakdowns.byStatus.map(([label, value]) => (
                          <span key={label} className="traceTag">{label}: {formatTraceNumber(value)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="traceTagGroup">
                      <strong>Theo type</strong>
                      <div className="traceTagList">
                        {issueBreakdowns.byType.map(([label, value]) => (
                          <span key={label} className="traceTag">{label}: {formatTraceNumber(value)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="traceTagGroup">
                      <strong>Theo resolution</strong>
                      <div className="traceTagList">
                        {issueBreakdowns.byResolution.map(([label, value]) => (
                          <span key={label} className="traceTag">{label}: {formatTraceNumber(value)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="traceTagGroup">
                      <strong>Theo drop reason</strong>
                      <div className="traceTagList">
                        {issueBreakdowns.byDropReason.map(([label, value]) => (
                          <span key={label} className="traceTag">{label}: {formatTraceNumber(value)}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            <section className="traceActionsRow">
              {traceFileUrl ? (
                <a className="ghostBtn" href={traceFileUrl} target="_blank" rel="noreferrer">
                  Mở analysis-trace.json
                </a>
              ) : null}
              <span className="mutedText">{loading ? "Đang tải trace..." : `${traceIssues.length} issue trace`}</span>
            </section>

            <section className="traceFilters">
              {([
                ["all", "Tất cả"],
                ["budget", "Chưa nạp batch DOCX"],
                ["range", "Range not found"],
                ["annotation", "Không annotate"],
                ["response", "Có trong UI"],
              ] as Array<[TraceFilter, string]>).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  className={`filterChip ${activeFilter === filter ? "active" : ""}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {label} ({formatTraceNumber(filterCounts[filter])})
                </button>
              ))}
            </section>

            <section className="traceIssueList">
              {filteredIssues.slice(0, 40).map((issue) => (
                <article key={issue.traceId} className="reviewCard">
                  <div className="cardMeta">
                    <span>{issue.traceId}</span>
                    <span>{issue.source}</span>
                    <span>{issue.status}</span>
                  </div>
                  <h3>{issue.wrong} → {issue.suggestion}</h3>
                  <small>{issue.path ?? issue.blockId}</small>
                  <small>
                    {issue.dropReason ? `drop=${issue.dropReason}` : issue.returnedToUi ? "returned_to_ui" : "active"}
                  </small>
                  <p>{issue.events.map((event) => `${event.stage}:${event.decision}`).join(" | ")}</p>
                </article>
              ))}
            </section>

            <section className="traceClientEvents">
              <h3>Client events</h3>
              {clientEvents.length === 0 ? (
                <p className="mutedText">Chưa có client debug event.</p>
              ) : (
                clientEvents.slice().reverse().map((event) => (
                  <article key={event.id} className="traceClientEvent">
                    <strong>{event.decision}</strong>
                    <span>{event.detail}</span>
                  </article>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
