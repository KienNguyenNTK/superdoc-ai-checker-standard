import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PromptTemplateService } from "./promptTemplateService.js";
import type { PromptTemplate } from "../domain/types.js";

test("PromptTemplateService renders variables and persists overrides", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "prompt-service-"));
  await mkdir(root, { recursive: true });

  const template: PromptTemplate = {
    id: "test_prompt",
    name: "Test prompt",
    description: "Used in tests",
    system: "SYSTEM {{CHECK_MODE}}",
    userTemplate: "USER {{BLOCKS}}",
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } } },
    defaultModelOptions: {
      temperature: 0.1,
      maxTokens: 300,
    },
  };

  const service = new PromptTemplateService(root, {
    test_prompt: template,
  });

  const rendered = await service.render("test_prompt", {
    CHECK_MODE: "format",
    BLOCKS: "A\nB",
  });

  assert.equal(rendered.system, "SYSTEM format");
  assert.equal(rendered.user, "USER A\nB");

  await service.saveOverride("test_prompt", {
    system: "UPDATED {{CHECK_MODE}}",
    userTemplate: "UPDATED USER {{BLOCKS}}",
    defaultModelOptions: {
      temperature: 0.2,
      maxTokens: 150,
    },
  });

  const overrideRaw = JSON.parse(await readFile(path.join(root, "test_prompt.json"), "utf8"));
  assert.equal(overrideRaw.system, "UPDATED {{CHECK_MODE}}");

  const updated = await service.getPrompt("test_prompt");
  assert.equal(updated.system, "UPDATED {{CHECK_MODE}}");

  await service.resetOverride("test_prompt");
  const reset = await service.getPrompt("test_prompt");
  assert.equal(reset.system, template.system);
});
