import { useEffect, useRef, type MutableRefObject } from "react";
import { SuperDocEditor } from "@superdoc-dev/react";
import type { DocumentMode } from "../types";

type Props = {
  file: File | null;
  documentUrl: string | null;
  mode: DocumentMode;
  onReady?: () => void;
  onReadyRef?: (ref: MutableRefObject<any>) => void;
};

export function EditorShell({ file, documentUrl, mode, onReady, onReadyRef }: Props) {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    onReadyRef?.(editorRef);
  }, [onReadyRef]);

  if (!file && !documentUrl) {
    return (
      <div className="editorEmpty">
        <div className="dropCard">
          <h1>Upload DOCX để test SuperDoc</h1>
          <p>
            Frontend chỉ hiển thị tài liệu và lỗi. Backend sẽ đọc DOCX, gửi nội
            dung sang LLM, rồi trả danh sách lỗi về panel bên phải.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="editorWrap">
      <SuperDocEditor
        key={file?.name || documentUrl || "empty"}
        ref={editorRef}
        document={documentUrl || file!}
        documentMode={mode}
        contained
        role="editor"
        user={{
          name: "Inres AI",
          email: "test@example.com",
        }}
        renderLoading={() => (
          <div className="editorLoading">Đang mở tài liệu DOCX...</div>
        )}
        onReady={() => {
          console.log("SuperDoc ready");
          onReady?.();
        }}
        onContentError={(event: unknown) => {
          console.error("SuperDoc content error", event);
        }}
        onException={(event: unknown) => {
          console.error("SuperDoc exception", event);
        }}
      />
    </div>
  );
}
