import { describe, expect, it } from "vitest";
import { canonicalJSON } from "./index.js";

describe("canonicalJSON", () => {
  it("sorts keys with the default sort and drops whitespace", () => {
    expect(canonicalJSON({ b: 1, a: 2, B: 3, aa: 4 })).toBe('{"B":3,"a":2,"aa":4,"b":1}');
  });

  it("sorts nested objects and keeps array order", () => {
    const value = { z: { y: [3, 1, { d: true, c: null }], x: "s" }, a: [] };
    expect(canonicalJSON(value)).toBe('{"a":[],"z":{"x":"s","y":[3,1,{"c":null,"d":true}]}}');
  });

  it.each([
    ["a fraction", { n: 1.5 }],
    ["NaN", { n: NaN }],
    ["an unsafe integer", { n: 2 ** 53 }],
    ["an undefined value", { u: undefined }],
    ["undefined in an array", [1, undefined]],
    ["a function", { f: () => 1 }],
    ["a bigint", { b: 1n }],
  ])("rejects %s", (_name, value) => {
    expect(() => canonicalJSON(value)).toThrow();
  });
});
