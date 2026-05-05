import { useState } from "react";
import { vi } from "../../i18n";
import type { ReviewMode } from "../../types";

type Props = {
  command: string;
  mode: ReviewMode;
  visible: boolean;
  disabled?: boolean;
  modelLabel: string;
  onCommandChange: (value: string) => void;
  onModeChange: (value: ReviewMode) => void;
  onSubmit: () => Promise<void> | void;
};

export function AiCommandBar({
  command,
  mode,
  visible,
  disabled,
  modelLabel,
  onCommandChange,
  onModeChange,
  onSubmit,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  if (!visible) return null;

  return (
    <form
      className="aiCommandBar"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
          await onSubmit();
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="aiPromptMeta">
        <span className="eyebrow">{vi.ai.eyebrow}</span>
        <span className="mutedText">{modelLabel}</span>
      </div>
      <input
        className="aiInput"
        value={command}
        disabled={disabled || submitting}
        onChange={(event) => onCommandChange(event.target.value)}
        placeholder={vi.ai.placeholder}
      />
      <select
        className="modeSelect"
        value={mode}
        disabled={disabled || submitting}
        onChange={(event) => onModeChange(event.target.value as ReviewMode)}
      >
        <option value="comment_only">{vi.ai.modes.comment_only}</option>
        <option value="highlight_only">{vi.ai.modes.highlight_only}</option>
        <option value="track_changes">{vi.ai.modes.track_changes}</option>
        <option value="comment_and_highlight">{vi.ai.modes.comment_and_highlight}</option>
        <option value="track_changes_and_comment">{vi.ai.modes.track_changes_and_comment}</option>
      </select>
      <button className="primaryBtn" type="submit" disabled={disabled || submitting}>
        {submitting ? vi.ai.running : vi.ai.send}
      </button>
    </form>
  );
}
