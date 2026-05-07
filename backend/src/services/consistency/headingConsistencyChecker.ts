import type {
  DocumentBlock,
  FormatRule,
  HeadingSemanticRole,
  Issue,
} from "../../domain/types.js";
import { classifyHeading, isHeadingLike } from "./headingClassifier.js";
import {
  compareHeadingVisualStyle,
  describeVisualStyle,
  getVisualStyle,
  serializeVisualStyle,
  type VisualStyleSnapshot,
} from "./visualStyleNormalizer.js";

function groupBySemanticRole(blocks: DocumentBlock[]) {
  const groups = new Map<HeadingSemanticRole, DocumentBlock[]>();

  for (const block of blocks.filter(isHeadingLike)) {
    const role = classifyHeading(block);
    const current = groups.get(role) || [];
    current.push(block);
    groups.set(role, current);
  }

  return groups;
}

function getDominantStyleEntries(items: DocumentBlock[]) {
  const styleGroups = new Map<
    string,
    Array<{
      block: DocumentBlock;
      style: VisualStyleSnapshot;
    }>
  >();

  for (const block of items) {
    const style = getVisualStyle(block);
    const key = serializeVisualStyle(style);
    const current = styleGroups.get(key) || [];
    current.push({ block, style });
    styleGroups.set(key, current);
  }

  let dominantKey = "";
  let dominantEntries: Array<{ block: DocumentBlock; style: VisualStyleSnapshot }> = [];

  for (const [key, entries] of styleGroups) {
    if (entries.length > dominantEntries.length) {
      dominantKey = key;
      dominantEntries = entries;
    }
  }

  return {
    dominantKey,
    dominantEntries,
  };
}

export function buildHeadingFormatRules(blocks: DocumentBlock[]): FormatRule[] {
  const rules: FormatRule[] = [];
  const groups = groupBySemanticRole(blocks);

  for (const [role, items] of groups) {
    if (items.length < 2) continue;

    const { dominantEntries } = getDominantStyleEntries(items);
    if (dominantEntries.length < 2) continue;

    rules.push({
      target: `heading_role:${role}`,
      ruleType: "heading_format",
      semanticRole: role,
      expectedFormat: dominantEntries[0].style,
      examples: dominantEntries.slice(0, 3).map(({ block }) => ({
        blockId: block.blockId,
        text: block.text,
      })),
      confidence: dominantEntries.length >= 3 ? "high" : "medium",
    });
  }

  return rules;
}

function createHeadingReason(
  role: HeadingSemanticRole,
  expectedFormat: VisualStyleSnapshot,
  currentFormat: VisualStyleSnapshot,
  evidenceCount: number
) {
  return `Heading này thuộc nhóm ${role} nhưng lệch với pattern phổ biến của ${evidenceCount} heading cùng nhóm: ${describeVisualStyle(
    expectedFormat
  )}. Hiện tại ${describeVisualStyle(currentFormat)}.`;
}

function createHeadingLocation(block: DocumentBlock): Issue["location"] {
  return {
    blockId: block.blockId,
    blockType: block.type,
    path: block.path,
    startOffset: 0,
    endOffset: block.text.length,
    runIds: block.runs.map((candidate) => candidate.runId),
    searchText: block.text,
    target: {
      kind: "selection",
      start: { kind: "text", blockId: block.blockId, offset: 0 },
      end: { kind: "text", blockId: block.blockId, offset: block.text.length },
    },
  };
}

export function checkHeadingFormatRules(
  documentId: string,
  blocks: DocumentBlock[],
  headingRules: FormatRule[]
): Issue[] {
  const issues: Issue[] = [];

  for (const rule of headingRules) {
    const role = rule.semanticRole;
    if (!role) continue;

    const items = blocks.filter((block) => isHeadingLike(block) && classifyHeading(block) === role);
    if (items.length < 2) continue;

    for (const block of items) {
      const currentStyle = getVisualStyle(block);
      const comparison = compareHeadingVisualStyle(rule.expectedFormat, currentStyle);
      if (!comparison.shouldReport) continue;

      issues.push({
        id: `heading_format_${role}_${block.blockId}`,
        documentId,
        type: "heading_consistency",
        wrong: block.text,
        suggestion: `Chuẩn hóa style ${role}`,
        reason: createHeadingReason(role, rule.expectedFormat, currentStyle, rule.examples.length),
        confidence: comparison.diffs.includes("bold") || comparison.diffs.includes("fontSize") ? "high" : "medium",
        severity: "warning",
        source: "rule_engine",
        status: "pending",
        location: createHeadingLocation(block),
        evidence: rule.examples.map((example) => ({
          blockId: example.blockId,
          text: example.text,
          note: "Heading cùng nhóm, style chuẩn.",
        })),
        suggestedFormat: rule.expectedFormat,
      });
    }
  }

  return issues;
}
