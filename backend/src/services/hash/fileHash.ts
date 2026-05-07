import { readFile } from "node:fs/promises";
import { sha256Hex } from "./configHash.js";

export function hashFileBuffer(buffer: Buffer) {
  return sha256Hex(buffer);
}

export async function hashFile(filePath: string) {
  return hashFileBuffer(await readFile(filePath));
}
