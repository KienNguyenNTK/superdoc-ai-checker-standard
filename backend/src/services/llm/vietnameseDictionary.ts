import { readFile } from "node:fs/promises";
import { CUSTOM_DICTIONARY, PROJECT_DIR } from "../../config.js";
import path from "node:path";

type RawDictionaryPayload = {
  entries?: string[];
};

export type DictionaryToken = {
  text: string;
  normalized: string;
  startOffset: number;
  endOffset: number;
};

export type VietnameseDictionaryService = {
  size: number;
  hasTerm: (term: string) => boolean;
  hasSingleWord: (term: string) => boolean;
  isPreservedToken: (term: string) => boolean;
  suggestSingleWord: (term: string) => string | null;
};

export const DICTIONARY_JSON_PATH = path.join(
  PROJECT_DIR,
  "backend",
  "superdoc-vietnamese-dictionary-package",
  "superdoc-vietnamese-dictionary.json"
);

const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:[./_-][\p{L}\p{N}]+)*/gu;

let dictionaryPromise: Promise<VietnameseDictionaryService> | null = null;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeVietnameseTerm(value: string) {
  return collapseWhitespace(value).toLocaleLowerCase("vi-VN");
}

export function stripVietnameseDiacritics(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Mark}+/gu, "")
    .replace(/đ/gu, "d")
    .replace(/Đ/gu, "D")
    .toLocaleLowerCase("vi-VN");
}

export function tokenizeVietnameseText(text: string): DictionaryToken[] {
  const matches = text.matchAll(TOKEN_PATTERN);
  const tokens: DictionaryToken[] = [];

  for (const match of matches) {
    const token = match[0];
    const startOffset = match.index ?? -1;
    if (!token || startOffset < 0) continue;

    tokens.push({
      text: token,
      normalized: normalizeVietnameseTerm(token),
      startOffset,
      endOffset: startOffset + token.length,
    });
  }

  return tokens;
}

function isTechnicalToken(term: string) {
  return /[./_]/.test(term) || /\d/.test(term) || /[A-Z].*[A-Z]/.test(term);
}

function createPreserveTokenSet(entries: string[]) {
  const preserveTokens = new Set<string>();

  for (const entry of entries) {
    preserveTokens.add(normalizeVietnameseTerm(entry));
    for (const token of tokenizeVietnameseText(entry)) {
      preserveTokens.add(token.normalized);
    }
  }

  return preserveTokens;
}

function buildAccentlessSuggestionIndex(terms: Iterable<string>) {
  const index = new Map<string, Set<string>>();

  for (const term of terms) {
    const normalized = normalizeVietnameseTerm(term);
    if (!normalized || normalized.includes(" ")) continue;

    const key = stripVietnameseDiacritics(normalized);
    if (!key) continue;

    const existing = index.get(key) ?? new Set<string>();
    existing.add(normalized);
    index.set(key, existing);
  }

  return index;
}

export async function loadVietnameseDictionaryService(
  dictionaryPath = DICTIONARY_JSON_PATH
) {
  const raw = await readFile(dictionaryPath, "utf8");
  const data = JSON.parse(raw) as RawDictionaryPayload;
  const normalizedEntries = new Set(
    (data.entries ?? []).map(normalizeVietnameseTerm).filter(Boolean)
  );
  const preserveTerms = createPreserveTokenSet(CUSTOM_DICTIONARY);
  const singleWordEntries = new Set(
    [...normalizedEntries].filter((entry) => !entry.includes(" "))
  );
  const accentlessIndex = buildAccentlessSuggestionIndex(singleWordEntries);

  return {
    size: normalizedEntries.size,
    hasTerm(term: string) {
      return normalizedEntries.has(normalizeVietnameseTerm(term));
    },
    hasSingleWord(term: string) {
      return singleWordEntries.has(normalizeVietnameseTerm(term));
    },
    isPreservedToken(term: string) {
      const normalized = normalizeVietnameseTerm(term);
      return preserveTerms.has(normalized) || isTechnicalToken(term);
    },
    suggestSingleWord(term: string) {
      const normalized = normalizeVietnameseTerm(term);
      if (!normalized || normalized.includes(" ")) return null;

      const exact = accentlessIndex.get(stripVietnameseDiacritics(normalized));
      if (!exact || exact.size !== 1) return null;

      const [candidate] = [...exact];
      return candidate && candidate !== normalized ? candidate : null;
    },
  } satisfies VietnameseDictionaryService;
}

export async function getVietnameseDictionaryService() {
  if (!dictionaryPromise) {
    dictionaryPromise = loadVietnameseDictionaryService();
  }

  return dictionaryPromise;
}
