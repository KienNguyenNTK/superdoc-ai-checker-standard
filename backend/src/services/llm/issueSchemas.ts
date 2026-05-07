import { z } from "zod";

export const LlmIssueSchema = z.object({
  blockId: z.string(),
  path: z.string().optional(),
  wrong: z.string().min(1),
  suggestion: z.string().min(1),
  reason: z.string().min(1),
  type: z.enum([
    "spelling",
    "accent",
    "typo",
    "grammar",
    "style",
    "terminology_consistency",
    "translation_consistency",
    "format_consistency",
    "capitalization_consistency",
    "tone_consistency",
    "name_consistency",
    "date_number_consistency",
    "heading_consistency",
    "table_format_consistency",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  severity: z.enum(["info", "warning", "error"]).default("warning"),
  source: z.enum(["rule_engine", "llm", "hybrid"]).default("llm"),
  status: z.enum(["pending", "needs_review"]).optional(),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  beforeContext: z.string().optional(),
  afterContext: z.string().optional(),
  shouldAutoApply: z.boolean().optional(),
});

export const LlmIssueListSchema = z.object({
  issues: z.array(LlmIssueSchema),
});

export type LlmIssue = z.infer<typeof LlmIssueSchema>;
