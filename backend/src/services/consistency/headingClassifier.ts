import type { DocumentBlock, HeadingSemanticRole } from "../../domain/types.js";
import { getVisualStyle } from "./visualStyleNormalizer.js";

export function normalizeHeadingText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function hasSectionNumbering(text: string) {
  return /^\d+(?:\.\d+)*\.?\s+\S+/.test(text);
}

function isLikelyDocumentTitle(text: string, block: DocumentBlock) {
  const words = text.split(/\s+/).filter(Boolean);
  const letters = text.replace(/[^A-Za-zÀ-ỹ]/g, "");
  const upperLetters = text.replace(/[^A-ZÀ-Ỹ]/g, "");
  const upperRatio = upperLetters.length / Math.max(1, letters.length);
  const visual = getVisualStyle(block);

  return words.length >= 4 && upperRatio > 0.65 && (visual.fontSize ?? 0) >= 16 && visual.bold === true;
}

function isSubtitle(text: string, block: DocumentBlock) {
  const visual = getVisualStyle(block);
  return visual.italic === true && (visual.fontSize ?? 0) <= 13 && text.length > 10;
}

export function isHeadingLike(block: DocumentBlock) {
  return block.type === "heading" || block.type === "caption";
}

export function classifyHeading(block: DocumentBlock): HeadingSemanticRole {
  const text = normalizeHeadingText(block.text);
  const headingLevel = block.metadata?.headingLevel;
  const isFirstPage = block.page === 1;

  if (!text) return "unknown";

  if (isFirstPage && !hasSectionNumbering(text) && isLikelyDocumentTitle(text, block)) {
    return "document_title";
  }

  if (isSubtitle(text, block)) {
    return "document_subtitle";
  }

  if (/^(chương|chapter)\s+\d+/i.test(text)) {
    return "chapter_heading";
  }

  if (/^\d+\.\d+\.\d+\.?\s+\S+/.test(text)) {
    return "section_heading_level_3";
  }

  if (/^\d+\.\d+\.?\s+\S+/.test(text)) {
    return "section_heading_level_2";
  }

  if (/^\d+\.?\s+\S+/.test(text)) {
    return "section_heading_level_1";
  }

  if (/^(bảng|table)\s+\d+/i.test(text)) {
    return "table_title";
  }

  if (/^(hình|figure|fig\.)\s+\d+/i.test(text)) {
    return "figure_caption";
  }

  if (/^(phụ lục|appendix)\s+/i.test(text)) {
    return "appendix_heading";
  }

  if (headingLevel) {
    return "normal_heading";
  }

  return "unknown";
}
