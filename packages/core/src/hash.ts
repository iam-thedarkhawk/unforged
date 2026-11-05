import { canonicalJSON } from "./canonical.js";
import type { Manifest, Recipe, Sha256 } from "./types.js";

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Lowercase hex SHA-256 via WebCrypto (Node 20+ and Firefox). */
export async function sha256Hex(bytes: Uint8Array): Promise<Sha256> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sha256Canonical(value: unknown): Promise<Sha256> {
  return sha256Hex(utf8(canonicalJSON(value)));
}

export function manifestRoot(m: Manifest): Promise<Sha256> {
  return sha256Canonical(m);
}

export function recipeDigest(r: Recipe): Promise<Sha256> {
  return sha256Canonical(r);
}
