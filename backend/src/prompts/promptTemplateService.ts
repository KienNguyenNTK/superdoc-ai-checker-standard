import OpenAI from "openai";
import type { PromptTemplate, PromptTestResult } from "../domain/types.js";
import { API_KEY, BASE_URL, MODEL } from "../config.js";
import { type PromptId, promptRegistry } from "./promptRegistry.js";
import { CustomPromptStore } from "./userPrompts/customPromptStore.js";

const openai = API_KEY
  ? new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
    })
  : null;

function renderString(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => variables[key] ?? "");
}

function safeJsonParse(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

export class PromptTemplateService {
  private readonly store: CustomPromptStore;

  constructor(
    rootDir: string,
    private readonly registry: Partial<Record<PromptId | string, PromptTemplate>> = promptRegistry
  ) {
    this.store = new CustomPromptStore(rootDir);
  }

  async listPrompts() {
    return Promise.all(Object.keys(this.registry).map((promptId) => this.getPrompt(promptId)));
  }

  async getPrompt(promptId: string): Promise<PromptTemplate> {
    const base = this.registry[promptId];
    if (!base) throw new Error(`Unknown prompt: ${promptId}`);

    const override = await this.store.load(promptId);
    if (!override) return base;

    return {
      ...base,
      ...override,
      defaultModelOptions: {
        ...base.defaultModelOptions,
        ...(override.defaultModelOptions as Record<string, unknown> | undefined),
      },
    };
  }

  async saveOverride(
    promptId: string,
    override: Partial<Pick<PromptTemplate, "system" | "userTemplate" | "defaultModelOptions">>
  ) {
    await this.getPrompt(promptId);
    await this.store.save(promptId, override as Record<string, unknown>);
    return this.getPrompt(promptId);
  }

  async resetOverride(promptId: string) {
    await this.getPrompt(promptId);
    await this.store.reset(promptId);
    return this.getPrompt(promptId);
  }

  async render(promptId: string, variables: Record<string, string>) {
    const prompt = await this.getPrompt(promptId);

    return {
      prompt,
      system: renderString(prompt.system, variables),
      user: renderString(prompt.userTemplate, variables),
    };
  }

  async testPrompt(
    promptId: string,
    variables: Record<string, string>,
    options?: {
      sampleOutput?: string;
      runModel?: boolean;
    }
  ): Promise<PromptTestResult> {
    const rendered = await this.render(promptId, variables);
    let rawOutput = options?.sampleOutput;

    if (!rawOutput && options?.runModel && openai) {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: rendered.prompt.defaultModelOptions?.temperature ?? 0.1,
        messages: [
          { role: "system", content: rendered.system },
          { role: "user", content: rendered.user },
        ],
      });

      rawOutput = completion.choices[0]?.message?.content || "";
    }

    if (!rawOutput) {
      return {
        ok: true,
        promptId,
        renderedSystem: rendered.system,
        renderedUser: rendered.user,
      };
    }

    try {
      const parsed = safeJsonParse(rawOutput);
      return {
        ok: true,
        promptId,
        renderedSystem: rendered.system,
        renderedUser: rendered.user,
        parsed,
        rawOutput,
      };
    } catch (error: any) {
      return {
        ok: false,
        promptId,
        renderedSystem: rendered.system,
        renderedUser: rendered.user,
        rawOutput,
        error: error?.message || String(error),
      };
    }
  }
}
