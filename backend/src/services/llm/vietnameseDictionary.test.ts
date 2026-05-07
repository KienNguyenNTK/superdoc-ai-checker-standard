import test from "node:test";
import assert from "node:assert/strict";
import {
  loadVietnameseDictionaryService,
  normalizeVietnameseTerm,
  stripVietnameseDiacritics,
  tokenizeVietnameseText,
} from "./vietnameseDictionary.js";

test("loadVietnameseDictionaryService loads normalized single words and phrases", async () => {
  const dictionary = await loadVietnameseDictionaryService();

  assert.equal(dictionary.hasSingleWord("a"), true);
  assert.equal(dictionary.hasTerm("hỗ trợ"), true);
  assert.equal(dictionary.hasTerm("rõ ràng"), true);
  assert.equal(dictionary.hasTerm("  Rõ   Ràng "), true);
  assert.equal(dictionary.isPreservedToken("SuperDoc"), true);
});

test("tokenizeVietnameseText keeps technical tokens intact", () => {
  const tokens = tokenizeVietnameseText("OpenAI dùng Node.js để xử lý DOCX.");

  assert.deepEqual(
    tokens.map((token) => token.text),
    ["OpenAI", "dùng", "Node.js", "để", "xử", "lý", "DOCX"]
  );
});

test("normalization helpers keep Vietnamese matching stable", () => {
  assert.equal(normalizeVietnameseTerm("  Gợi   Ý  "), "gợi ý");
  assert.equal(stripVietnameseDiacritics("Định dạng"), "dinh dang");
});
