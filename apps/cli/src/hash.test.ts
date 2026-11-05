import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Manifest } from "@unforged/core";
import { canonicalJSON, manifestRoot, sha256Hex } from "./hash.js";

describe("canonicalJSON", () => {
  it("sorts keys at every level with no whitespace and keeps array order", () => {
    expect(canonicalJSON({ b: [{ d: 1, c: "x" }, 2], a: { z: null, y: true } })).toBe(
      '{"a":{"y":true,"z":null},"b":[{"c":"x","d":1},2]}',
    );
  });
});

describe("sha256Hex", () => {
  it("matches the known vector for 'abc'", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("manifestRoot", () => {
  it("is the sha256 of the canonical JSON, whatever the key order", async () => {
    const manifest: Manifest = {
      version: 1,
      dapp: "d",
      release: "r",
      commit: "c",
      files: { "/b": "2", "/a": "1" },
      config: {},
    };
    const canonical =
      '{"commit":"c","config":{},"dapp":"d","files":{"/a":"1","/b":"2"},"release":"r","version":1}';
    expect(await manifestRoot(manifest)).toBe(createHash("sha256").update(canonical).digest("hex"));
  });
});
