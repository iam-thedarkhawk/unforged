import { describe, expect, it } from "vitest";
import { checkConfig } from "./index.js";
import type { ConfigRule } from "./types.js";

const rule: ConfigRule = {
  kind: "window-env-json",
  allowedKeys: ["rpc", "chains", "name", "debug"],
  urlHostAllowlist: ["rpc.example.org"],
};
const bytes = (s: string) => new TextEncoder().encode(s);

describe("checkConfig", () => {
  it("accepts a valid window.__env__ file and returns its values", () => {
    const src = 'window.__env__={"rpc":"https://rpc.example.org/v1","chains":[1,17000],"name":"lido","debug":false};\n';
    expect(checkConfig(rule, bytes(src))).toEqual({
      ok: true,
      values: { rpc: "https://rpc.example.org/v1", chains: [1, 17000], name: "lido", debug: false },
    });
  });

  it("accepts a file without the trailing semicolon", () => {
    expect(checkConfig(rule, bytes('window.__env__={"name":"lido"}')).ok).toBe(true);
  });

  it.each([
    ["an extra key", 'window.__env__={"name":"lido","evil":"x"}'],
    ["a non-allowlisted URL host", 'window.__env__={"rpc":"https://evil.example/v1"}'],
    ["a non-allowlisted URL inside an array", 'window.__env__={"chains":["https://evil.example/"]}'],
    ["a nested object", 'window.__env__={"name":{"a":1}}'],
    ["trailing code after the JSON", 'window.__env__={"name":"lido"};alert(1)'],
    ["a wrong prefix", 'window.__env = {"name":"lido"}'],
    ["code before the prefix", 'alert(1);window.__env__={"name":"lido"}'],
    ["a non-object JSON value", "window.__env__=[1,2]"],
  ])("rejects %s", (_name, src) => {
    const result = checkConfig(rule, bytes(src));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  describe("urlHostAllowlist compares host with port", () => {
    const check = (allowlist: string[], url: string) =>
      checkConfig(
        { kind: "window-env-json", allowedKeys: ["rpc"], urlHostAllowlist: allowlist },
        bytes(`window.__env__=${JSON.stringify({ rpc: url })}`),
      ).ok;

    it.each([
      [["localhost:8080"], "http://localhost:8080/x", true],
      [["localhost:8080"], "http://localhost:9090/x", false],
      [["localhost:8080"], "http://localhost/x", false],
      [["localhost"], "http://localhost:8080/x", false],
      [["hoodi.drpc.org"], "https://hoodi.drpc.org", true],
      [["drpc.org"], "https://hoodi.drpc.org", false],
      [["hoodi.drpc.org"], "https://hoodi.drpc.org:443/", true],
      [["hoodi.drpc.org"], "http://hoodi.drpc.org:443/", false],
      [["HOODI.drpc.org:8545"], "https://hoodi.DRPC.org:8545/", true],
    ])("%j with %s -> %s", (allowlist, url, expected) => {
      expect(check(allowlist, url)).toBe(expected);
    });
  });
});
