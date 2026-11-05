import type { CheckConfigResult, ConfigRule } from "./types.js";

const PREFIX = "window.__env__=";
const TRAILER = /\s*;?\s*$/; // optional trailing ";" and whitespace

type Primitive = string | number | boolean | null;

/** §5: a config file is accepted as data, not code, if it is exactly `window.__env__=<object>`. */
export function checkConfig(rule: ConfigRule, bytes: Uint8Array): CheckConfigResult {
  if (rule.kind !== "window-env-json") return fail(`unsupported config kind: ${rule.kind}`);

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("not valid UTF-8");
  }
  if (!text.startsWith(PREFIX)) return fail(`must start with ${PREFIX}`);

  const body = text.slice(PREFIX.length).replace(TRAILER, "");
  if (!body.startsWith("{")) return fail("must assign one JSON object");
  let values: unknown;
  try {
    values = JSON.parse(body);
  } catch {
    return fail("not exactly one JSON object");
  }
  if (!isPlainObject(values)) return fail("must assign one JSON object");

  for (const [key, value] of Object.entries(values)) {
    const error = checkEntry(rule, key, value);
    if (error) return fail(error);
  }
  return { ok: true, values };
}

function checkEntry(rule: ConfigRule, key: string, value: unknown): string | undefined {
  if (!rule.allowedKeys.includes(key)) return `key not allowed: ${key}`;
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    if (!isPrimitive(item)) return `${key}: only primitives or arrays of primitives`;
    if (typeof item === "string" && !isAllowedUrl(rule, item)) return `${key}: URL host not allowlisted: ${item}`;
  }
  return undefined;
}

/** Strings that are not http(s) URLs pass; http(s) URLs need an allowlisted host (with port). */
function isAllowedUrl(rule: ConfigRule, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  return (rule.urlHostAllowlist ?? []).some((host) => host.toLowerCase() === url.host);
}

function isPrimitive(value: unknown): value is Primitive {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): CheckConfigResult {
  return { ok: false, error };
}
