import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class CustomPromptStore {
  constructor(private readonly rootDir: string) {}

  getPath(promptId: string) {
    return path.join(this.rootDir, `${promptId}.json`);
  }

  async load(promptId: string) {
    try {
      const raw = await readFile(this.getPath(promptId), "utf8");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async save(promptId: string, value: Record<string, unknown>) {
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(this.getPath(promptId), JSON.stringify(value, null, 2));
  }

  async reset(promptId: string) {
    await rm(this.getPath(promptId), { force: true });
  }
}
