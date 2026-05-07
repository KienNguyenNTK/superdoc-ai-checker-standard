import { readFile } from 'node:fs/promises';

export type SuperDocDictionary = {
  name: string;
  version: string;
  entries: string[];
};

export async function loadVietnameseDictionary(jsonPath: string) {
  const raw = await readFile(jsonPath, 'utf8');
  const data = JSON.parse(raw) as SuperDocDictionary;

  const words = new Set(
    data.entries
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  return {
    has(term: string) {
      return words.has(term.trim().toLowerCase());
    },
    size: words.size,
  };
}

// Example:
// const dictionary = await loadVietnameseDictionary('./superdoc-vietnamese-dictionary.json');
// console.log(dictionary.has('hỗ trợ'));
