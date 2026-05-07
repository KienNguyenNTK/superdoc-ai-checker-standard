import type { PromptTemplate } from "../domain/types.js";
import { consistencyPrompt } from "./templates/consistency.prompt.js";
import { entityConsistencyPrompt } from "./templates/entityConsistency.prompt.js";
import { formatConsistencyPrompt } from "./templates/formatConsistency.prompt.js";
import { glossaryExtractionPrompt } from "./templates/glossaryExtraction.prompt.js";
import { spellingPrompt } from "./templates/spelling.prompt.js";
import { toneConsistencyPrompt } from "./templates/toneConsistency.prompt.js";
import { translationConsistencyPrompt } from "./templates/translationConsistency.prompt.js";

export type PromptId =
  | "spelling"
  | "format_consistency"
  | "translation_consistency"
  | "terminology_consistency"
  | "tone_consistency"
  | "glossary_extraction"
  | "entity_consistency";

export const promptRegistry: Record<PromptId, PromptTemplate> = {
  spelling: spellingPrompt,
  format_consistency: formatConsistencyPrompt,
  translation_consistency: translationConsistencyPrompt,
  terminology_consistency: consistencyPrompt,
  tone_consistency: toneConsistencyPrompt,
  glossary_extraction: glossaryExtractionPrompt,
  entity_consistency: entityConsistencyPrompt,
};
