import type {
  ChangeRecord,
  CommentRecord,
  HistoryRecord,
  Issue,
  IssueFilter,
  IssueStatus,
  PromptTemplate,
} from "../types";

export const vi = {
  app: {
    defaultAiCommand: "Kiểm tra tính nhất quán toàn tài liệu và thêm bình luận vào các lỗi quan trọng",
  },
  common: {
    importDocx: "Nhập file DOCX",
    noDocument: "Chưa có tài liệu",
    analyzeConsistency: "Phân tích tài liệu",
    analyzing: "Đang phân tích…",
    analysisRunningTime: (seconds: string) => `Đã chạy ${seconds}`,
    analysisLastTime: (seconds: string) => `Mất ${seconds}`,
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
    buildContext: "Xây dựng bộ nhớ ngữ cảnh",
    contextBuilt: "Đã xây dựng bộ nhớ ngữ cảnh",
    promptSettings: "Thiết lập prompt AI",
    contextMemory: "Bộ nhớ tài liệu",
  },
  export: {
    original: "Tải tệp gốc original.docx",
    reviewed: "Tải tệp rà soát reviewed-consistency.docx",
    final: "Tải tệp hoàn chỉnh final.docx",
    reportJson: "Tải báo cáo issues.json",
    reportCsv: "Tải báo cáo issues.csv",
    clientSnapshot: "Xuất ảnh chụp trình soạn hiện tại",
  },
  workspace: {
    eyebrow: "KHÔNG GIAN LÀM VIỆC SUPERDOC",
    title: "Nhập file DOCX để bắt đầu phiên rà soát tính nhất quán",
    description:
      "Frontend dùng SuperDoc để hiển thị và đưa bạn tới đúng vị trí lỗi. Backend xử lý bộ nhớ ngữ cảnh, bộ luật kiểm tra, LLM kiểm tra tính nhất quán và xuất DOCX đã rà soát.",
    loadingDocx: "Đang mở file DOCX đã rà soát trong SuperDoc...",
  },
  review: {
    eyebrow: "RÀ SOÁT",
    aiIssuesRailTitle: "Lỗi do AI phát hiện",
    tabs: {
      issues: "Vấn đề",
      comments: "Bình luận",
      changes: "Thay đổi",
      history: "Lịch sử",
    },
    filters: {
      all: "Tất cả",
      spelling: "Chính tả",
      format: "Định dạng",
      terminology: "Thuật ngữ",
      translation: "Dịch thuật",
      tone: "Văn phong",
      entity: "Tên riêng",
      date_number: "Ngày/số/đơn vị",
    } as Record<IssueFilter, string>,
    emptyIssuesTitle: "Chưa có vấn đề nào",
    emptyIssuesHintBefore: "Hãy chạy ",
    emptyIssuesHintOrAgent: " hoặc ",
    emptyIssuesHintAgentWord: "tác tử",
    emptyIssuesHintBeforeFile: " để tạo file ",
    noIssuesAfterReviewTitle: "Không phát hiện lỗi nào",
    noIssuesAfterReviewHint:
      "Tài liệu đã được phân tích xong theo bộ kiểm tra hiện tại và chưa phát hiện vấn đề nào.",
    emptyFilteredIssuesTitle: "Không có vấn đề trong bộ lọc này",
    emptyFilteredIssuesHint:
      "Tài liệu vẫn có kết quả rà soát, nhưng không có mục nào khớp với bộ lọc đang chọn.",
    emptyCommentsTitle: "Chưa có bình luận",
    emptyCommentsHint: "Bình luận trong tài liệu sẽ hiển thị ở đây.",
    emptyChanges: "Chưa có thay đổi theo dõi.",
    emptyHistoryTitle: "Chưa có lịch sử",
    emptyHistoryHint: "Thao tác rà soát sẽ được ghi lại tại đây.",
    issueCountAria: (n: number) => `${n} mục lỗi`,
    goToIssue: "Xem vị trí",
    apply: "Áp dụng",
    applying: "Đang áp dụng…",
    applied: "Đã áp dụng",
    ignore: "Bỏ qua",
    commentAddedOn: (target: string) => `Đã thêm bình luận tại "${target}"`,
    selectionFallback: "vùng chọn",
    changeStatusLabel: "Trạng thái",
    sourceLabel: "Nguồn",
    severityLabel: "Mức độ",
    filterLabel: "Lọc theo loại",
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
        name: "Tác tử kiểm tra chính tả tiếng Việt",
        description: "Kiểm tra lỗi chính tả tiếng Việt.",
      },
      "format-consistency-checker": {
        name: "Tác tử kiểm tra tính nhất quán định dạng",
        description: "Kiểm tra độ nhất quán của in đậm, in nghiêng, gạch chân, tiêu đề và bảng.",
      },
      "terminology-consistency-checker": {
        name: "Tác tử kiểm tra tính nhất quán thuật ngữ",
        description: "Kiểm tra thuật ngữ theo bảng thuật ngữ và bộ nhớ ngữ cảnh.",
      },
      "translation-consistency-checker": {
        name: "Tác tử kiểm tra tính nhất quán bản dịch",
        description: "Kiểm tra bản dịch lệch so với bảng thuật ngữ hoặc ngữ cảnh.",
      },
      "tone-consistency-checker": {
        name: "Tác tử kiểm tra tính nhất quán văn phong",
        description: "Kiểm tra văn phong và cách xưng hô.",
      },
      "entity-name-consistency-checker": {
        name: "Tác tử kiểm tra tính nhất quán tên riêng",
        description: "Kiểm tra tên riêng, thương hiệu và tên sản phẩm.",
      },
      "full-document-consistency-checker": {
        name: "Tác tử rà soát toàn bộ tính nhất quán",
        description: "Chạy toàn bộ phép kiểm tra trên tài liệu.",
      },
      "grammar-reviewer": {
        name: "Tác tử rà soát ngữ pháp",
        description: "Tương thích ngược cho luồng rà soát chính tả và ngữ pháp cũ.",
      },
      "style-reviewer": {
        name: "Tác tử rà soát văn phong",
        description: "Tương thích ngược cho luồng rà soát văn phong cũ.",
      },
      "format-cleaner": {
        name: "Tác tử dọn định dạng",
        description: "Tương thích ngược cho luồng dọn định dạng cũ.",
      },
    } as const,
  },
  context: {
    title: "Bộ nhớ tài liệu",
    glossary: "Bảng thuật ngữ",
    formatRules: "Quy tắc định dạng",
    toneRules: "Quy tắc văn phong",
    entities: "Thực thể",
    saveGlossary: "Lưu bảng thuật ngữ",
    refreshContext: "Xây dựng lại bộ nhớ ngữ cảnh",
    glossaryPlaceholder: "term|preferredTranslation|alternative1,alternative2",
  },
  prompts: {
    title: "Thiết lập prompt AI",
    selectPrompt: "Chọn prompt",
    system: "Prompt hệ thống",
    userTemplate: "Mẫu prompt người dùng",
    temperature: "Độ ngẫu nhiên",
    maxTokens: "Số token tối đa",
    testPrompt: "Kiểm thử prompt",
    savePrompt: "Lưu prompt",
    resetPrompt: "Khôi phục mặc định",
    variables: "JSON biến đầu vào",
    sampleOutput: "JSON đầu ra mẫu",
    renderedSystem: "Prompt hệ thống sau khi dựng",
    renderedUser: "Prompt người dùng sau khi dựng",
    parsedResult: "Kết quả phân tích",
  },
  labels: {
    issueType: {
      spelling: "Chính tả",
      accent: "Dấu thanh",
      typo: "Gõ nhầm",
      grammar: "Ngữ pháp",
      style: "Văn phong",
      terminology_consistency: "Thuật ngữ",
      translation_consistency: "Dịch thuật",
      format_consistency: "Định dạng",
      capitalization_consistency: "Viết hoa",
      tone_consistency: "Văn phong",
      name_consistency: "Tên riêng",
      date_number_consistency: "Ngày/số/đơn vị",
      heading_consistency: "Tiêu đề",
      table_format_consistency: "Bảng",
    } as Record<Issue["type"], string>,
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
    issueSeverity: {
      info: "Thông tin",
      warning: "Cảnh báo",
      error: "Lỗi",
    } as const,
    issueSource: {
      rule_engine: "Bộ luật kiểm tra",
      llm: "LLM",
      hybrid: "Kết hợp",
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
      context_built: "Đã xây dựng bộ nhớ ngữ cảnh",
    } as const,
    commentStatus: {
      open: "Đang mở",
      resolved: "Đã xử lý",
    } as const,
  },
} as const;

export function labelIssueType(type: Issue["type"]): string {
  return vi.labels.issueType[type] ?? type;
}

export function labelIssueConfidence(level: Issue["confidence"]): string {
  return vi.labels.issueConfidence[level] ?? level;
}

export function labelIssueStatus(status: IssueStatus): string {
  return vi.labels.issueStatus[status] ?? status;
}

export function labelIssueSeverity(level: Issue["severity"]): string {
  return vi.labels.issueSeverity[level] ?? level;
}

export function labelIssueSource(source: Issue["source"]): string {
  return vi.labels.issueSource[source] ?? source;
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

export function labelPromptName(prompt: PromptTemplate) {
  return `${prompt.name} (${prompt.id})`;
}
