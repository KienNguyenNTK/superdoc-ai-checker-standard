import type { DocumentBlock, RunFormatSnapshot } from "../../domain/types.js";

export type VisualStyleSnapshot = RunFormatSnapshot;

const TEMPORARY_HIGHLIGHTS = new Set([
  "yellow",
  "green",
  "blue",
  "#fff59d",
  "#c8e6c9",
  "#bbdefb",
]);

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizeWhitespace(value: unknown) {
  const text = asString(value);
  if (!text) return "";
  return text.trim().replace(/\s+/g, " ");
}

function isNumberingOnlyText(value: unknown) {
  return /^(?:\d+(?:\.\d+)*\.?|[IVXLC]+\.?|[A-ZÀ-Ỹ]\.)$/i.test(normalizeWhitespace(value));
}

function normalizeFontFamily(value?: unknown) {
  const text = asString(value);
  if (!text) return undefined;
  return text.replace(/["']/g, "").trim().toLowerCase();
}

function normalizeHexColor(value?: unknown) {
  const text = asString(value);
  if (!text) return undefined;

  const normalized = text.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "black") return "#000000";
  if (normalized === "white") return "#ffffff";
  if (normalized === "none" || normalized === "transparent" || normalized === "auto") return undefined;

  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex
      .split("")
      .map((char) => char + char)
      .join("")}`.toUpperCase();
  }

  if (/^[0-9a-f]{6}$/.test(hex)) {
    return `#${hex}`.toUpperCase();
  }

  return normalized;
}

function normalizeHighlight(value?: unknown) {
  const text = asString(value);
  if (!text) return undefined;
  const normalized = normalizeHexColor(text) ?? text.trim().toLowerCase();
  if (!normalized) return undefined;
  if (TEMPORARY_HIGHLIGHTS.has(normalized.toLowerCase())) return undefined;
  return normalized;
}

function normalizeStyleName(value?: unknown) {
  const text = asString(value);
  if (!text) return undefined;
  return text.trim().replace(/\s+/g, " ");
}

function pickComparableRuns(block: DocumentBlock) {
  const meaningfulRuns = block.runs.filter((run) => {
    const text = normalizeWhitespace(run.text);
    return text.length > 0 && !isNumberingOnlyText(text);
  });

  return meaningfulRuns.length > 0 ? meaningfulRuns : block.runs;
}

function dominantBoolean(values: Array<boolean | undefined>) {
  let trueCount = 0;
  let falseCount = 0;

  for (const value of values) {
    if (value === true) trueCount += 1;
    if (value === false) falseCount += 1;
  }

  if (trueCount === 0 && falseCount === 0) return undefined;
  return trueCount >= falseCount;
}

function dominantNumber(values: Array<number | undefined>) {
  const counts = new Map<number, number>();
  for (const value of values) {
    if (typeof value !== "number" || Number.isNaN(value)) continue;
    const rounded = Math.round(value);
    counts.set(rounded, (counts.get(rounded) || 0) + 1);
  }

  let winner: number | undefined;
  let winnerCount = -1;
  for (const [value, count] of counts) {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }

  return winner;
}

function dominantString(values: Array<string | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  let winner: string | undefined;
  let winnerCount = -1;
  for (const [value, count] of counts) {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }

  return winner;
}

export function getVisualStyle(block: DocumentBlock): VisualStyleSnapshot {
  const runs = pickComparableRuns(block);

  return {
    bold: dominantBoolean(runs.map((run) => run.bold)),
    italic: dominantBoolean(runs.map((run) => run.italic)),
    underline: dominantBoolean(runs.map((run) => run.underline)),
    color: dominantString(runs.map((run) => normalizeHexColor(run.color))),
    highlightColor: dominantString(runs.map((run) => normalizeHighlight(run.highlightColor))),
    fontFamily: dominantString(runs.map((run) => normalizeFontFamily(run.fontFamily))),
    fontSize: dominantNumber(runs.map((run) => run.fontSize)),
    styleName: normalizeStyleName(block.metadata?.styleName),
  };
}

export function compareHeadingVisualStyle(base: VisualStyleSnapshot, current: VisualStyleSnapshot) {
  const diffs: string[] = [];

  if (base.bold !== current.bold) diffs.push("bold");
  if (base.italic !== current.italic) diffs.push("italic");
  if (base.underline !== current.underline) diffs.push("underline");

  if (
    typeof base.fontSize === "number" &&
    typeof current.fontSize === "number" &&
    Math.abs(base.fontSize - current.fontSize) >= 2
  ) {
    diffs.push("fontSize");
  }

  if ((base.color || undefined) !== (current.color || undefined)) {
    if (base.color || current.color) diffs.push("color");
  }

  if ((base.highlightColor || undefined) !== (current.highlightColor || undefined)) {
    if (base.highlightColor || current.highlightColor) diffs.push("highlightColor");
  }

  const severe = diffs.includes("bold") || diffs.includes("fontSize");
  return {
    shouldReport: diffs.length >= 2 || severe,
    diffs,
  };
}

export function serializeVisualStyle(style: VisualStyleSnapshot) {
  return JSON.stringify({
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    color: style.color,
    highlightColor: style.highlightColor,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
  });
}

export function describeVisualStyle(style: VisualStyleSnapshot) {
  const parts: string[] = [];
  parts.push(`bold=${style.bold === true ? "true" : "false"}`);
  parts.push(`italic=${style.italic === true ? "true" : "false"}`);
  parts.push(`underline=${style.underline === true ? "true" : "false"}`);
  if (typeof style.fontSize === "number") parts.push(`fontSize=${style.fontSize}`);
  if (style.color) parts.push(`color=${style.color}`);
  if (style.highlightColor) parts.push(`highlight=${style.highlightColor}`);
  if (style.fontFamily) parts.push(`fontFamily=${style.fontFamily}`);
  return parts.join(", ");
}
