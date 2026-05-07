import { useEffect, useMemo, useState } from "react";
import { vi } from "../../i18n";
import type { DocumentContextMemory, GlossaryEntry } from "../../types";

type Props = {
  context: DocumentContextMemory | null;
  onSaveGlossary: (glossary: GlossaryEntry[]) => Promise<void>;
  onRefreshContext: () => Promise<void>;
};

function toEditableGlossary(glossary: GlossaryEntry[]) {
  return glossary
    .map((entry) =>
      [entry.term, entry.preferredTranslation || "", entry.alternatives.join(",")].join("|")
    )
    .join("\n");
}

function fromEditableGlossary(input: string): GlossaryEntry[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [term, preferredTranslation = "", alternatives = ""] = line.split("|");
      return {
        term: term.trim(),
        preferredTranslation: preferredTranslation.trim() || undefined,
        alternatives: alternatives
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        firstSeenBlockId: `manual_${index}`,
        confidence: "high" as const,
      };
    });
}

export function ContextMemoryPanel({ context, onSaveGlossary, onRefreshContext }: Props) {
  const [draft, setDraft] = useState(() => toEditableGlossary(context?.glossary || []));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(toEditableGlossary(context?.glossary || []));
  }, [context]);

  const sections = useMemo(
    () => ({
      formatRules: context?.formatRules || [],
      toneRules: context?.toneRules || [],
      entityRules: context?.entityRules || [],
    }),
    [context]
  );

  return (
    <section className="sidePanel">
      <header className="sidePanelHeader">
        <h2>{vi.context.title}</h2>
        <button type="button" className="ghostBtn" onClick={() => void onRefreshContext()}>
          {vi.context.refreshContext}
        </button>
      </header>

      <div className="panelSection">
        <h3>{vi.context.glossary}</h3>
        <textarea
          className="panelTextarea"
          value={draft}
          placeholder={vi.context.glossaryPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          rows={10}
        />
        <button
          type="button"
          className="primaryBtn"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSaveGlossary(fromEditableGlossary(draft));
            } finally {
              setSaving(false);
            }
          }}
        >
          {vi.context.saveGlossary}
        </button>
      </div>

      <div className="panelSection">
        <h3>{vi.context.formatRules}</h3>
        <ul className="panelList">
          {sections.formatRules.map((rule) => (
            <li key={`${rule.target}-${rule.ruleType}`}>
              <strong>{rule.target}</strong> - {rule.ruleType}
            </li>
          ))}
        </ul>
      </div>

      <div className="panelSection">
        <h3>{vi.context.toneRules}</h3>
        <ul className="panelList">
          {sections.toneRules.map((rule) => (
            <li key={rule.rule}>
              <strong>{rule.rule}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="panelSection">
        <h3>{vi.context.entities}</h3>
        <ul className="panelList">
          {sections.entityRules.map((rule) => (
            <li key={rule.canonicalName}>
              <strong>{rule.canonicalName}</strong> - {rule.variants.join(", ")}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
