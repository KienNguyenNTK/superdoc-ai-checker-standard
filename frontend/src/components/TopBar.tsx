import { Download, FileText, Loader2, PlugZap, Sparkles } from "lucide-react";
import type { DocumentMode } from "../types";

type Props = {
  fileName?: string;
  mode: DocumentMode;
  loading: boolean;
  hasFile: boolean;
  apiStatus: "checking" | "online" | "offline";
  modelName?: string;
  onUpload: (file: File) => void;
  onAnalyze: () => void;
  onExport: () => void;
  onModeChange: (mode: DocumentMode) => void;
};

export function TopBar({
  fileName,
  mode,
  loading,
  hasFile,
  apiStatus,
  modelName,
  onUpload,
  onAnalyze,
  onExport,
  onModeChange,
}: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brandIcon">
          <FileText size={20} />
        </div>
        <div>
          <div className="brandTitle">SuperDoc AI Checker</div>
          <div className="brandSub">
            {fileName || "Upload DOCX để kiểm tra chính tả"}
          </div>
        </div>
      </div>

      <div className="statusPill" data-status={apiStatus}>
        <PlugZap size={14} />
        {apiStatus === "checking"
          ? "Đang kiểm tra API"
          : apiStatus === "online"
            ? `API online${modelName ? ` · ${modelName}` : ""}`
            : "API offline"}
      </div>

      <div className="toolbar">
        <label className="uploadBtn">
          Upload DOCX
          <input
            type="file"
            accept=".docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.currentTarget.value = "";
            }}
          />
        </label>

        <select
          className="select"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as DocumentMode)}
          disabled={!hasFile}
        >
          <option value="viewing">Viewing</option>
          <option value="editing">Editing</option>
          <option value="suggesting">Suggesting</option>
        </select>

        <button
          className="primaryBtn"
          onClick={onAnalyze}
          disabled={!hasFile || loading || apiStatus !== "online"}
        >
          {loading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
          {loading ? "Đang kiểm tra..." : "Kiểm tra chính tả"}
        </button>

        <button className="ghostBtn" onClick={onExport} disabled={!hasFile}>
          <Download size={16} />
          Xuất DOCX
        </button>
      </div>
    </header>
  );
}
