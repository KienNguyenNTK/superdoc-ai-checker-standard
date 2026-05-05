import { z } from "zod";

export const LlmIssueSchema = z.object({
  blockId: z.string(),
  wrong: z.string().min(1),
  suggestion: z.string().min(1),
  reason: z.string().min(1),
  type: z.enum(["spelling", "accent", "typo", "grammar", "style"]),
  confidence: z.enum(["high", "medium", "low"]),
  beforeContext: z.string().optional(),
  afterContext: z.string().optional(),
  shouldAutoApply: z.boolean().optional(),
});

export const LlmIssueListSchema = z.object({
  issues: z.array(LlmIssueSchema),
});

export type LlmIssue = z.infer<typeof LlmIssueSchema>;
