import type {
  DocumentBlock,
  DocumentContextMemory,
  EntityRule,
  GlossaryEntry,
  GlossaryOccurrence,
  ToneRule,
} from "../../domain/types.js";
import { deriveHeadingRules, deriveTermFormatRules } from "./formatPatternAnalyzer.js";
import { mergeGlossarySeeds, type GlossarySeed } from "./glossaryExtractor.js";

type BuildContextMemoryInput = {
  documentId: string;
  blocks: DocumentBlock[];
  globalGlossary?: GlossarySeed[];
  documentGlossary?: GlossarySeed[];
};

function extractEntities(blocks: DocumentBlock[]): EntityRule[] {
  const entities = new Map<string, EntityRule>();

  for (const block of blocks) {
    for (const run of block.runs) {
      const text = run.text.trim();
      if (!/^[A-Z][A-Za-z0-9]+(?:[A-Z][A-Za-z0-9]+)*$/.test(text)) continue;
      if (!entities.has(text)) {
        entities.set(text, {
          canonicalName: text,
          variants: [text],
          firstSeenBlockId: block.blockId,
        });
      }
    }
  }

  return [...entities.values()];
}

function inferGlossaryFromBlocks(blocks: DocumentBlock[]): GlossaryEntry[] {
  const seeds: GlossarySeed[] = [];

  for (const block of blocks) {
    const occurrences: GlossaryOccurrence[] = [];

    const documentEngineMatch = block.text.match(/\bdocument engine\b/i);
    if (documentEngineMatch) {
      occurrences.push({
        blockId: block.blockId,
        text: documentEngineMatch[0],
      });
      seeds.push({
        term: "document engine",
        firstSeenBlockId: block.blockId,
        occurrences,
        confidence: "high",
      });
    }

    const userMatch = block.text.match(/\bngười dùng\b/i);
    if (userMatch) {
      seeds.push({
        term: "người dùng",
        firstSeenBlockId: block.blockId,
        occurrences: [{ blockId: block.blockId, text: userMatch[0] }],
        confidence: "medium",
      });
    }
  }

  return mergeGlossarySeeds(seeds);
}

function inferToneRules(blocks: DocumentBlock[]): ToneRule[] {
  const formalExamples = blocks
    .map((block) => block.text)
    .filter((text) => /người dùng|chúng tôi|quý khách/i.test(text))
    .slice(0, 5);

  if (formalExamples.length === 0) return [];

  return [
    {
      rule: "Ưu tiên văn phong trang trọng và xưng hô nhất quán theo tài liệu.",
      examples: formalExamples,
      confidence: "medium",
    },
  ];
}

export function buildContextMemory({
  documentId,
  blocks,
  globalGlossary,
  documentGlossary,
}: BuildContextMemoryInput): DocumentContextMemory {
  const inferredGlossary = inferGlossaryFromBlocks(blocks);
  const glossary = mergeGlossarySeeds(
    inferredGlossary,
    globalGlossary,
    documentGlossary
  );
  const entityRules = extractEntities(blocks);
  const formatRules = [
    ...deriveHeadingRules(blocks),
    ...deriveTermFormatRules(
      blocks,
      entityRules.map((rule) => rule.canonicalName)
    ),
  ];
  const toneRules = inferToneRules(blocks);

  return {
    documentId,
    glossary,
    formatRules,
    toneRules,
    entityRules,
  };
}
