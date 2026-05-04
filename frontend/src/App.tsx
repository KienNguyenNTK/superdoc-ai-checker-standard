import { useEffect, useMemo, useRef, useState } from "react";
import { EditorShell } from "./components/EditorShell";
import { IssuePanel } from "./components/IssuePanel";
import { TopBar } from "./components/TopBar";
import { analyzeDocumentWithBackend, getApiHealth } from "./lib/api";
import {
  ensureIssueComment,
  navigateToIssue,
  syncIssueResolution,
} from "./lib/superdoc-proofing";
import type { DocumentMode, SpellingIssue } from "./types";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<DocumentMode>("editing");
  const [issues, setIssues] = useState<SpellingIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [modelName, setModelName] = useState<string>("");
  const [editorReady, setEditorReady] = useState(false);

  const editorRefHolder = useRef<any>(null);
  const fileName = useMemo(() => file?.name, [file]);

  useEffect(() => {
    getApiHealth()
      .then((data) => {
        setApiStatus("online");
        setModelName(data.model);
      })
      .catch(() => {
        setApiStatus("offline");
      });
  }, []);

  function handleUpload(nextFile: File) {
    setFile(nextFile);
    setDocumentUrl(null);
    setIssues([]);
    setMode("editing");
    setEditorReady(false);
  }

  async function handleAnalyze() {
    if (!file) return;

    setLoading(true);

    try {
      const result = await analyzeDocumentWithBackend(file);
      setIssues(result.issues || []);

      if (result.reviewedFileUrl) {
        setDocumentUrl(result.reviewedFileUrl);
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Không kiểm tra được chính tả");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const instance = editorRefHolder.current?.current?.getInstance?.();

    if (!instance?.export) {
      alert("SuperDoc instance chưa sẵn sàng hoặc bản package chưa hỗ trợ export qua ref.");
      return;
    }

    await instance.export({
      triggerDownload: true,
    });
  }

  function updateIssueStatus(id: string, status: "accepted" | "ignored") {
    const currentIssue = issues.find((item) => item.id === id);
    if (!currentIssue) {
      return;
    }

    const nextIssue = { ...currentIssue, status };
    setIssues((prev) => prev.map((item) => (item.id === id ? nextIssue : item)));

    const superdoc = editorRefHolder.current?.current?.getInstance?.();
    if (superdoc && nextIssue.commentId) {
      syncIssueResolution(superdoc, nextIssue);
    }
  }

  async function handleGoToIssue(id: string) {
    const superdoc = editorRefHolder.current?.current?.getInstance?.();
    const issue = issues.find((item) => item.id === id);

    if (!superdoc || !issue) {
      return;
    }

    let nextIssue = issue;

    if (!issue.commentId) {
      const commentId = await ensureIssueComment(superdoc, issue);
      if (!commentId) {
        return;
      }

      nextIssue = { ...issue, commentId };
      setIssues((prev) =>
        prev.map((item) => (item.id === id ? { ...item, commentId } : item))
      );
    }

    await navigateToIssue(superdoc, nextIssue);
  }

  useEffect(() => {
    const superdoc = editorRefHolder.current?.current?.getInstance?.();
    if (!superdoc || !editorReady || !issues.length) {
      return;
    }

    let cancelled = false;

    async function mapIssueComments() {
      for (const issue of issues) {
        if (cancelled || issue.commentId) {
          continue;
        }

        const commentId = await ensureIssueComment(superdoc, issue);
        if (!commentId || cancelled) {
          continue;
        }

        setIssues((prev) =>
          prev.map((item) => (item.id === issue.id ? { ...item, commentId } : item))
        );
      }
    }

    void mapIssueComments();

    return () => {
      cancelled = true;
    };
  }, [editorReady, issues]);

  return (
    <div className="app">
      <TopBar
        fileName={fileName}
        mode={mode}
        loading={loading}
        hasFile={!!file || !!documentUrl}
        apiStatus={apiStatus}
        modelName={modelName}
        onUpload={handleUpload}
        onAnalyze={handleAnalyze}
        onExport={handleExport}
        onModeChange={setMode}
      />

      <main className="layout">
        <section className="docArea">
          <EditorShell
            file={file}
            documentUrl={documentUrl}
            mode={mode}
            onReady={() => setEditorReady(true)}
            onReadyRef={(ref) => {
              editorRefHolder.current = ref;
            }}
          />
        </section>

        <IssuePanel
          issues={issues}
          onGoTo={handleGoToIssue}
          onAccept={(id) => updateIssueStatus(id, "accepted")}
          onIgnore={(id) => updateIssueStatus(id, "ignored")}
        />
      </main>
    </div>
  );
}
