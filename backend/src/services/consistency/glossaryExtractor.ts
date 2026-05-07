import type { Confidence, GlossaryEntry, GlossaryOccurrence } from "../../domain/types.js";

export type GlossarySeed = {
  term: string;
  preferredTranslation?: string;
  alternatives?: string[];
  firstSeenBlockId?: string;
  occurrences?: GlossaryOccurrence[];
  confidence?: Confidence;
};

export function normalizeGlossaryTerm(term: string) {
  return term.trim().replace(/\s+/g, " ");
}

export function mergeGlossarySeeds(
  ...groups: Array<GlossarySeed[] | undefined>
): GlossaryEntry[] {
  const merged = new Map<string, GlossaryEntry>();

  for (const group of groups) {
    for (const seed of group || []) {
      const term = normalizeGlossaryTerm(seed.term);
      if (!term) continue;

      const existing = merged.get(term);
      if (!existing) {
        merged.set(term, {
          term,
          preferredTranslation: seed.preferredTranslation,
          alternatives: [...new Set(seed.alternatives || [])],
          firstSeenBlockId: seed.firstSeenBlockId || "unknown",
          occurrences: [...(seed.occurrences || [])],
          confidence: seed.confidence || "medium",
        });
        continue;
      }

      if (seed.preferredTranslation) {
        existing.preferredTranslation = seed.preferredTranslation;
      }

      existing.alternatives = [...new Set([...existing.alternatives, ...(seed.alternatives || [])])];
      existing.occurrences.push(...(seed.occurrences || []));

      if (existing.firstSeenBlockId === "unknown" && seed.firstSeenBlockId) {
        existing.firstSeenBlockId = seed.firstSeenBlockId;
      }
    }
  }

  return [...merged.values()].sort((left, right) => left.term.localeCompare(right.term));
}
