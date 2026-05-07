import { useEffect, useMemo, useState } from "react";
import { labelPromptName, vi } from "../../i18n";
import type { PromptTemplate, PromptTestResult } from "../../types";

type Props = {
  prompts: PromptTemplate[];
  onLoadPrompt: (promptId: string) => Promise<PromptTemplate>;
  onSavePrompt: (promptId: string, prompt: Partial<PromptTemplate>) => Promise<PromptTemplate>;
  onResetPrompt: (promptId: string) => Promise<PromptTemplate>;
  onTestPrompt: (
    promptId: string,
    variables: Record<string, string>,
    sampleOutput: string
  ) => Promise<PromptTestResult>;
};

export function PromptSettingsPanel({
  prompts,
  onLoadPrompt,
  onSavePrompt,
  onResetPrompt,
  onTestPrompt,
}: Props) {
  const [selectedPromptId, setSelectedPromptId] = useState<string>(prompts[0]?.id || "");
  const [draft, setDraft] = useState<PromptTemplate | null>(prompts[0] || null);
  const [variablesInput, setVariablesInput] = useState('{"CHECK_MODE":"format","BLOCKS":"[blockId=p_001] SuperDoc"}');
  const [sampleOutput, setSampleOutput] = useState('{"issues":[]}');
  const [testResult, setTestResult] = useState<PromptTestResult | null>(null);

  useEffect(() => {
    if (!selectedPromptId) return;
    void onLoadPrompt(selectedPromptId).then(setDraft);
  }, [selectedPromptId, onLoadPrompt]);

  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId) || draft,
    [draft, prompts, selectedPromptId]
  );

  if (!selectedPrompt) {
    return <section className="sidePanel"><h2>{vi.prompts.title}</h2></section>;
  }

  return (
    <section className="sidePanel">
      <header className="sidePanelHeader">
        <h2>{vi.prompts.title}</h2>
      </header>

      <div className="panelSection">
        <label className="panelLabel">{vi.prompts.selectPrompt}</label>
        <select
          className="topSelect moreMenuFullWidth"
          value={selectedPromptId}
          onChange={(event) => setSelectedPromptId(event.target.value)}
        >
          {prompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>
              {labelPromptName(prompt)}
            </option>
          ))}
        </select>
      </div>

      <div className="panelSection">
        <label className="panelLabel">{vi.prompts.system}</label>
        <textarea
          className="panelTextarea"
          value={draft?.system || ""}
          rows={8}
          onChange={(event) =>
            setDraft((current) => (current ? { ...current, system: event.target.value } : current))
          }
        />
      </div>

      <div className="panelSection">
        <label className="panelLabel">{vi.prompts.userTemplate}</label>
        <textarea
          className="panelTextarea"
          value={draft?.userTemplate || ""}
          rows={8}
          onChange={(event) =>
            setDraft((current) =>
              current ? { ...current, userTemplate: event.target.value } : current
            )
          }
        />
      </div>

      <div className="panelGrid">
        <div className="panelSection">
          <label className="panelLabel">{vi.prompts.temperature}</label>
          <input
            className="panelInput"
            type="number"
            step="0.1"
            value={draft?.defaultModelOptions?.temperature ?? 0.1}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      defaultModelOptions: {
                        ...current.defaultModelOptions,
                        temperature: Number(event.target.value),
                      },
                    }
                  : current
              )
            }
          />
        </div>
        <div className="panelSection">
          <label className="panelLabel">{vi.prompts.maxTokens}</label>
          <input
            className="panelInput"
            type="number"
            value={draft?.defaultModelOptions?.maxTokens ?? 2000}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      defaultModelOptions: {
                        ...current.defaultModelOptions,
                        maxTokens: Number(event.target.value),
                      },
                    }
                  : current
              )
            }
          />
        </div>
      </div>

      <div className="panelSection">
        <div className="cardActions">
          <button
            type="button"
            className="primaryBtn"
            onClick={async () => {
              if (!draft) return;
              setDraft(
                await onSavePrompt(draft.id, {
                  system: draft.system,
                  userTemplate: draft.userTemplate,
                  defaultModelOptions: draft.defaultModelOptions,
                })
              );
            }}
          >
            {vi.prompts.savePrompt}
          </button>
          <button
            type="button"
            className="ghostBtn"
            onClick={async () => {
              const reset = await onResetPrompt(selectedPrompt.id);
              setDraft(reset);
            }}
          >
            {vi.prompts.resetPrompt}
          </button>
        </div>
      </div>

      <div className="panelSection">
        <label className="panelLabel">{vi.prompts.variables}</label>
        <textarea
          className="panelTextarea"
          value={variablesInput}
          rows={4}
          onChange={(event) => setVariablesInput(event.target.value)}
        />
      </div>

      <div className="panelSection">
        <label className="panelLabel">{vi.prompts.sampleOutput}</label>
        <textarea
          className="panelTextarea"
          value={sampleOutput}
          rows={4}
          onChange={(event) => setSampleOutput(event.target.value)}
        />
      </div>

      <div className="panelSection">
        <button
          type="button"
          className="primaryBtn"
          onClick={async () => {
            const parsedVariables = JSON.parse(variablesInput) as Record<string, string>;
            const result = await onTestPrompt(selectedPrompt.id, parsedVariables, sampleOutput);
            setTestResult(result);
          }}
        >
          {vi.prompts.testPrompt}
        </button>
      </div>

      {testResult ? (
        <>
          <div className="panelSection">
            <label className="panelLabel">{vi.prompts.renderedSystem}</label>
            <pre className="panelPre">{testResult.renderedSystem}</pre>
          </div>
          <div className="panelSection">
            <label className="panelLabel">{vi.prompts.renderedUser}</label>
            <pre className="panelPre">{testResult.renderedUser}</pre>
          </div>
          <div className="panelSection">
            <label className="panelLabel">{vi.prompts.parsedResult}</label>
            <pre className="panelPre">{JSON.stringify(testResult.parsed || testResult.error, null, 2)}</pre>
          </div>
        </>
      ) : null}
    </section>
  );
}
