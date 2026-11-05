// Canonical JSON (docs/formats.md): keys sorted at every level, no whitespace,
// integers only. Anything that JSON.stringify would silently drop or round throws.

export function canonicalJSON(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return String(value);
    case "number":
      if (!Number.isSafeInteger(value)) throw new TypeError(`canonicalJSON: not a safe integer: ${value}`);
      return String(value);
    case "string":
      return JSON.stringify(value);
    case "object":
      return Array.isArray(value) ? canonicalArray(value) : canonicalObject(value);
    default:
      throw new TypeError(`canonicalJSON: unsupported type ${typeof value}`);
  }
}

function canonicalArray(values: unknown[]): string {
  // Array.from turns holes into undefined, which then throws.
  return `[${Array.from(values, canonicalJSON).join(",")}]`;
}

function canonicalObject(value: object): string {
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError("canonicalJSON: only plain objects are allowed");
  }
  const record = value as Record<string, unknown>;
  const members = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`);
  return `{${members.join(",")}}`;
}
