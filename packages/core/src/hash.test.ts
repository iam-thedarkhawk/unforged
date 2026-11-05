import { describe, expect, it } from "vitest";
import { canonicalJSON, sha256Hex } from "./index.js";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("sha256Hex", () => {
  it("hashes 'abc'", async () => {
    expect(await sha256Hex(utf8("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches the frozen canonical JSON vector", async () => {
    const value = { dapp: "lido", release: "0.161.0", files: { "/app.js": "bb22", "/index.html": "aa11" } };
    expect(await sha256Hex(utf8(canonicalJSON(value)))).toBe(
      "c661590fa690d3ee262b99f5100f93cbc5f668a41aa323fb9032a804e9f488b7",
    );
  });
});
