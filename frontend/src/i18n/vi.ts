import type {
  ChangeRecord,
  CommentRecord,
  HistoryRecord,
  IssueStatus,
  SpellingIssue,
} from "../types";

export const vi = {
  app: {
    defaultAiCommand: "Kiểm tra chính tả tiếng Việt và thêm bình luận vào các lỗi",
  },
  common: {
    importDocx: "Nhập file DOCX",
    noDocument: "Chưa có tài liệu",
    checkSpelling: "Kiểm tra chính tả",
    checkingSpelling: "Đang kiểm tra…",
    reviewPanelTitle: "Lỗi và rà soát",
    reviewPanelAriaLabel: (count: number) => `Lỗi và rà soát, ${count} mục`,
    shareLinkTitle: "Sao chép liên kết chia sẻ",
    shareLinkAria: "Chia sẻ",
    exportTitle: "Xuất tệp",
    exportAria: "Xuất tệp",
    exportEmpty: "Nhập tài liệu để xuất",
    moreTitle: "Thêm tùy chọn",
    moreAria: "Thêm",
    documentModeLabel: "Chế độ tài liệu",
    modeSuggesting: "Đề xuất",
    modeEditing: "Chỉnh sửa",
    modeViewing: "Chỉ xem",
    applyHighConfidence: "Áp dụng các sửa độ tin cậy cao",
    agentsSection: "Tác tử",
    hideChatAi: "Ẩn Chat AI",
    showChatAi: "Hiện Chat AI",
    apiStatusTitle: "Trạng thái API",
    apiOnline: "API đang hoạt động",
    apiOffline: "API không khả dụng",
    apiChecking: "Đang kiểm tra API",
    themeDarkTitle: "Giao diện tối",
    themeLightTitle: "Giao diện sáng",
    themeDarkAria: "Chế độ tối",
    themeLightAria: "Chế độ sáng",
    closePanelAria: "Đóng panel",
  },
  export: {
    original: "Tải original.docx",
    reviewed: "Tải reviewed.docx",
    final: "Tải final.docx",
    reportJson: "Tải issues.json",
    reportCsv: "Tải issues.csv",
    clientSnapshot: "Xuất ảnh chụp trình soạn hiện tại",
  },
  workspace: {
    eyebrow: "KHÔNG GIAN LÀM VIỆC SUPERDOC",
    title: "Nhập file DOCX để bắt đầu phiên rà soát",
    description:
      "Frontend sử dụng SuperDoc React cho trình soạn thảo, thanh công cụ và khu vực bình luận. AI/Agent chỉ gọi backend, không dùng trực tiếp LLM key.",
    loadingDocx: "Đang mở file DOCX đã rà soát trong SuperDoc...",
  },
  review: {
    eyebrow: "RÀ SOÁT",
    aiIssuesRailTitle: "Kiểm tra lỗi AI",
    tabs: {
      issues: "Lỗi AI",
      comments: "Bình luận",
      changes: "Thay đổi",
      history: "Lịch sử",
    },
    emptyIssuesTitle: "Chưa có lỗi nào",
    emptyIssuesHintBefore: "Hãy chạy ",
    emptyIssuesHintOrAgent: " hoặc ",
    emptyIssuesHintAgentWord: "tác tử",
    emptyIssuesHintBeforeFile: " để tạo file ",
    emptyCommentsTitle: "Chưa có bình luận",
    emptyCommentsHint: "Bình luận trong tài liệu sẽ hiển thị ở đây.",
    emptyChanges: "Chưa có thay đổi theo dõi.",
    emptyHistoryTitle: "Chưa có lịch sử",
    emptyHistoryHint: "Thao tác rà soát sẽ được ghi lại tại đây.",
    issueCountAria: (n: number) => `${n} mục lỗi`,
    goToIssue: "Xem vị trí",
    apply: "Áp dụng",
    ignore: "Bỏ qua",
    commentAddedOn: (target: string) => `Đã thêm bình luận tại "${target}"`,
    selectionFallback: "vùng chọn",
    changeStatusLabel: "Trạng thái",
    changeReplace: (oldText: string, newText: string) =>
      `Thay "${oldText}" bằng "${newText}"`,
    changeInsert: (text: string) => `Thêm "${text}"`,
    changeDelete: (text: string) => `Xóa "${text}"`,
  },
  ai: {
    eyebrow: "Chat AI",
    placeholder: "Bạn muốn thay đổi điều gì?",
    send: "Gửi",
    running: "Đang chạy…",
    modes: {
      comment_only: "Chỉ bình luận",
      highlight_only: "Chỉ đánh dấu",
      track_changes: "Theo dõi thay đổi",
      comment_and_highlight: "Bình luận + đánh dấu",
      track_changes_and_comment: "Theo dõi thay đổi + bình luận",
    } as const,
  },
  agents: {
    runAgent: "Chạy tác tử",
    byId: {
      "vietnamese-spelling-checker": {
        name: "Kiểm tra chính tả (tiếng Việt)",
        description:
          "Kiểm tra lỗi chính tả tiếng Việt và thêm bình luận hoặc đánh dấu.",
      },
      "grammar-reviewer": {
        name: "Rà soát ngữ pháp",
        description: "Gợi ý lỗi cấu trúc câu ở chế độ chỉ bình luận.",
      },
      "style-reviewer": {
        name: "Rà soát văn phong",
        description: "Gợi ý văn phong ở chế độ chỉ bình luận.",
      },
      "format-cleaner": {
        name: "Chuẩn hóa định dạng",
        description: "Theo dõi thay đổi cho các chỉnh sửa định dạng an toàn.",
      },
    } as const,
  },
  labels: {
    issueType: {
      spelling: "Chính tả",
      accent: "Dấu thanh",
      typo: "Gõ nhầm",
      grammar: "Ngữ pháp",
      style: "Văn phong",
    } as const,
    issueConfidence: {
      high: "Cao",
      medium: "Trung bình",
      low: "Thấp",
    } as const,
    issueStatus: {
      pending: "Chờ xử lý",
      commented: "Đã bình luận",
      highlighted: "Đã đánh dấu",
      tracked: "Đang theo dõi",
      applied: "Đã áp dụng",
      ignored: "Đã bỏ qua",
      needs_review: "Cần rà soát",
    } as const,
    changeStatus: {
      pending: "Chờ duyệt",
      accepted: "Đã chấp nhận",
      rejected: "Đã từ chối",
    } as const,
    historyType: {
      imported: "Đã nhập",
      analyzed: "Đã phân tích",
      commented: "Bình luận",
      highlighted: "Đánh dấu",
      tracked: "Theo dõi thay đổi",
      applied: "Đã áp dụng",
      ignored: "Đã bỏ qua",
      exported: "Đã xuất",
    } as const,
    commentStatus: {
      open: "Đang mở",
      resolved: "Đã xử lý",
    } as const,
  },
} as const;

export function labelIssueType(type: SpellingIssue["type"]): string {
  return vi.labels.issueType[type] ?? type;
}

export function labelIssueConfidence(level: SpellingIssue["confidence"]): string {
  return vi.labels.issueConfidence[level] ?? level;
}

export function labelIssueStatus(status: IssueStatus): string {
  return vi.labels.issueStatus[status] ?? status;
}

export function labelChangeStatus(status: ChangeRecord["status"]): string {
  return vi.labels.changeStatus[status] ?? status;
}

export function labelHistoryType(type: HistoryRecord["type"]): string {
  return vi.labels.historyType[type] ?? type;
}

export function labelCommentStatus(status: NonNullable<CommentRecord["status"]>): string {
  return vi.labels.commentStatus[status] ?? status;
}
