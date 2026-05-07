import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import type { DocumentBlock } from "../../domain/types.js";

type PageMapInfo = {
  totalPages: number;
  pagesByBlockIndex: number[];
  source: "explicit_page_breaks" | "docprops" | "estimated";
};

function countMatches(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

function readTagNumber(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}>(\\d+)</${tagName}>`, "i"));
  return match ? Number(match[1]) : null;
}

async function readDocxXml(docxPath: string, entryName: string) {
  const buffer = await readFile(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  return zip.file(entryName)?.async("string") ?? null;
}

function extractParagraphPageNumbers(documentXml: string) {
  const paragraphMatches = documentXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
  const pages: number[] = [];
  let currentPage = 1;

  for (const paragraphXml of paragraphMatches) {
    pages.push(currentPage);
    const explicitBreaks =
      countMatches(paragraphXml, /<w:br\b[^>]*\bw:type=["']page["'][^>]*\/?>/g) +
      countMatches(paragraphXml, /<w:lastRenderedPageBreak\b[^>]*\/?>/g);
    currentPage += explicitBreaks;
  }

  return {
    pages,
    totalPages: Math.max(1, currentPage),
  };
}

function estimatePageForBlock(index: number, totalBlocks: number, totalPages: number) {
  if (totalPages <= 1) return 1;
  const zeroBasedPage = Math.floor((index / Math.max(1, totalBlocks)) * totalPages);
  return Math.max(1, Math.min(totalPages, zeroBasedPage + 1));
}

export async function buildDocxPageMap(
  docxPath: string,
  blocks: DocumentBlock[]
): Promise<PageMapInfo> {
  const documentXml = await readDocxXml(docxPath, "word/document.xml").catch(() => null);
  const appXml = await readDocxXml(docxPath, "docProps/app.xml").catch(() => null);
  const docPropsPages = appXml ? readTagNumber(appXml, "Pages") : null;

  if (documentXml) {
    const paragraphMap = extractParagraphPageNumbers(documentXml);
    if (paragraphMap.totalPages > 1) {
      return {
        totalPages: paragraphMap.totalPages,
        pagesByBlockIndex: blocks.map((_, index) => paragraphMap.pages[index] ?? paragraphMap.totalPages),
        source: "explicit_page_breaks",
      };
    }
  }

  if (docPropsPages && docPropsPages > 1) {
    return {
      totalPages: docPropsPages,
      pagesByBlockIndex: blocks.map((_, index) =>
        estimatePageForBlock(index, blocks.length, docPropsPages)
      ),
      source: "docprops",
    };
  }

  const estimatedPages = Math.max(1, Math.ceil(blocks.length / 26));
  return {
    totalPages: estimatedPages,
    pagesByBlockIndex: blocks.map((_, index) =>
      estimatePageForBlock(index, blocks.length, estimatedPages)
    ),
    source: "estimated",
  };
}

export function applyPageMapToBlocks(blocks: DocumentBlock[], pageMap: PageMapInfo) {
  return blocks.map((block, index) => ({
    ...block,
    page: pageMap.pagesByBlockIndex[index] ?? pageMap.totalPages,
  }));
}
