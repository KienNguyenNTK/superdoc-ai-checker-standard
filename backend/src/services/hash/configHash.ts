import { createHash } from "node:crypto";

export function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)])
  );
}

export function stableStringify(value: unknown) {
  return JSON.stringify(sortValue(value));
}

export function hashStableJson(value: unknown) {
  return sha256Hex(stableStringify(value));
}
