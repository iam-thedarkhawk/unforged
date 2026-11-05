// Local stand-ins with the same signatures as @unforged/core, to be swapped for core's.
import type { Manifest } from "@unforged/core";

export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`);
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Buffer.from(digest).toString("hex");
}

export function manifestRoot(manifest: Manifest): Promise<string> {
  return sha256Hex(new TextEncoder().encode(canonicalJSON(manifest)));
}
