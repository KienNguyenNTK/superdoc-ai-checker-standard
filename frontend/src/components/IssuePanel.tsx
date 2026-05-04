import { Check, CircleAlert, Eye, X } from "lucide-react";
import type { SpellingIssue } from "../types";

type Props = {
  issues: SpellingIssue[];
  onGoTo: (id: string) => void;
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
};

function confidenceLabel(value: SpellingIssue["confidence"]) {
  if (value === "high") return "Cao";
  if (value === "medium") return "Trung bình";
  return "Thấp";
}

export function IssuePanel({ issues, onGoTo, onAccept, onIgnore }: Props) {
  const pendingCount = issues.filter((x) => x.status === "pending").length;

  return (
    <aside className="issuePanel">
      <div className="panelHeader">
        <div>
          <h2>Lỗi phát hiện</h2>
          <p>{pendingCount} lỗi đang chờ xử lý</p>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="emptyState">
          <CircleAlert size={28} />
          <h3>Chưa có lỗi nào</h3>
          <p>
            Upload DOCX rồi bấm “Kiểm tra chính tả”. Kết quả sẽ lấy từ backend
            và local LLM/OpenAI API của bạn.
          </p>
        </div>
      ) : (
        <div className="issueList">
          {issues.map((issue) => (
            <div className={`issueCard ${issue.status}`} key={issue.id}>
              <div className="issueTop">
                <span className="badge">{issue.blockLabel || "Không rõ vị trí"}</span>
                <span className={`confidence ${issue.confidence}`}>
                  {confidenceLabel(issue.confidence)}
                </span>
              </div>

              <div className="correction">
                <span className="wrong">{issue.wrong}</span>
                <span className="arrow">→</span>
                <span className="suggestion">{issue.suggestion}</span>
              </div>

              <p className="reason">{issue.reason}</p>
              {issue.excerpt && <p className="issueExcerpt">{issue.excerpt}</p>}

              <div className="issueActions">
                <button
                  className="smallBtn"
                  onClick={() => onGoTo(issue.id)}
                  title={issue.commentId ? "Đi tới và highlight lỗi trong tài liệu" : "Tìm vị trí lỗi trong tài liệu"}
                >
                  <Eye size={14} />
                  Đi tới lỗi
                </button>

                <button
                  className="smallBtn success"
                  onClick={() => onAccept(issue.id)}
                  disabled={issue.status !== "pending"}
                >
                  <Check size={14} />
                  Chấp nhận
                </button>

                <button
                  className="smallBtn danger"
                  onClick={() => onIgnore(issue.id)}
                  disabled={issue.status !== "pending"}
                >
                  <X size={14} />
                  Bỏ qua
                </button>
              </div>

              {issue.status !== "pending" && (
                <div className="statusText">
                  {issue.status === "accepted" ? "Đã chấp nhận" : "Đã bỏ qua"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
