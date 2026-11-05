import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { nodeVersionMatches, parseRecipe, resolveYarn } from "./recipe.js";

const study = (name: string) => new URL(`../../../study/lido-0.161.0/${name}`, import.meta.url);
const recipeFile = (name: string) => new URL(`../../../recipes/${name}`, import.meta.url);

const VALID = {
  dapp: "lido-staking-widget",
  release: "0.161.0",
  repo: "https://github.com/lidofinance/ethereum-staking-widget",
  commit: "e256fd6db9f713433b5b95bcf2d2fd833131a547",
  node: "24",
  packageManager: "yarn@4.17.1",
  files: { "build-info.json": "{}" },
  env: { A: "1" },
  envFile: ".env.production.local",
  buildPath: "/unforged/build",
  install: "yarn install --immutable",
  build: "yarn build:ipfs",
  output: "out",
  configFiles: { "/runtime/window-env.js": { kind: "window-env-json", allowedKeys: ["A"] } },
};

const parseWith = (overrides: Record<string, unknown>) => parseRecipe(stringify({ ...VALID, ...overrides }));

describe("parseRecipe", () => {
  it("accepts a valid recipe", () => {
    expect(parseWith({})).toEqual(VALID);
  });

  it.each([
    ["an unknown field, which recipeDigest would otherwise miss", { extra: "x" }],
    ["a bad dapp name", { dapp: "Lido_Widget" }],
    ["a non-https repo", { repo: "http://github.com/x/y" }],
    ["a short commit", { commit: "e256fd6" }],
    ["a relative buildPath", { buildPath: "unforged/build" }],
    ["the filesystem root as buildPath", { buildPath: "/" }],
    ["a numeric env value", { env: { DEFAULT_CHAIN: 1 } }],
    ["an env value with a newline", { env: { A: "1\nB=2" } }],
    ["an env key that is not a name", { env: { "A B": "1" } }],
    ["a file escaping the repo", { files: { "../evil": "x" } }],
    ["an absolute file path", { files: { "/etc/evil": "x" } }],
    ["an envFile escaping the repo", { envFile: "../.env" }],
    ["an output escaping the repo", { output: "../out" }],
    ["a config path without a leading slash", { configFiles: { "a.js": { kind: "window-env-json", allowedKeys: [] } } }],
    ["an unknown config kind", { configFiles: { "/a.js": { kind: "raw", allowedKeys: [] } } }],
  ])("rejects %s", (_name, overrides) => {
    expect(() => parseWith(overrides)).toThrow();
  });
});

describe("nodeVersionMatches", () => {
  it.each([
    ["24", "v24.22.2", true],
    ["24", "v22.23.4", false],
    ["2", "v24.22.2", false],
    ["22.23.4", "v22.23.4", true],
    ["22.23.4", "v22.23.40", false],
    ["22.23", "v22.23.4", true],
  ])("recipe %s vs %s -> %s", (wanted, actual, expected) => {
    expect(nodeVersionMatches(wanted, actual)).toBe(expected);
  });
});

describe("resolveYarn", () => {
  const vendored = (path: string) => path === "/repo/.yarn/releases/yarn-4.17.1.cjs";

  it("rewrites yarn to the vendored release", () => {
    expect(resolveYarn("yarn build:ipfs", "yarn@4.17.1", "/repo", vendored)).toBe(
      "node .yarn/releases/yarn-4.17.1.cjs build:ipfs",
    );
    expect(resolveYarn("yarn a && yarn b", "yarn@4.17.1", "/repo", vendored)).toBe(
      "node .yarn/releases/yarn-4.17.1.cjs a && node .yarn/releases/yarn-4.17.1.cjs b",
    );
  });

  it("leaves other commands alone", () => {
    expect(resolveYarn("node yarnish.js yarn", "yarn@4.17.1", "/repo", vendored)).toBe("node yarnish.js yarn");
    expect(resolveYarn("yarn build", "pnpm@10.0.0", "/repo", vendored)).toBe("yarn build");
    expect(resolveYarn("yarn build", "yarn@1.0.0", "/repo", vendored)).toBe("yarn build");
  });
});

describe("Lido recipes", () => {
  const reference = parseRecipe(readFileSync(recipeFile("lido-staking-widget@0.161.0-reference.yaml"), "utf8"));
  const demo = parseRecipe(readFileSync(recipeFile("lido-staking-widget@0.161.0.yaml"), "utf8"));

  const hostsOf = (env: Record<string, string>) =>
    [...new Set(Object.values(env).flatMap((value) => (/^https?:\/\//.test(value) ? [new URL(value).hostname] : [])))];

  it("reference env is exactly the study env file, and so is build-info.json", () => {
    const lines = Object.entries(reference.env).map(([key, value]) => `${key}=${value}\n`);
    expect(lines.join("")).toBe(readFileSync(study("env.production.local"), "utf8"));
    expect(reference.files["build-info.json"]).toBe(readFileSync(study("build-info.json"), "utf8"));
  });

  it("demo differs from reference only in the four agreed env values and the allowlist", () => {
    const changed = {
      SUPPORTED_CHAINS: "560048",
      DEFAULT_CHAIN: "560048",
      EL_RPC_URLS_560048: "https://hoodi.drpc.org",
      SELF_ORIGIN: "http://localhost:8080",
    };
    expect(demo.env).toEqual({ ...reference.env, ...changed });

    const strip = ({ env: _env, configFiles: _configFiles, ...rest }: typeof demo) => rest;
    expect(strip(demo)).toEqual(strip(reference));
  });

  it.each([
    ["reference", reference],
    ["demo", demo],
  ])("%s config rule allows every env key and every env host", (_name, recipe) => {
    const rule = recipe.configFiles["/runtime/window-env.js"]!;
    expect(rule.kind).toBe("window-env-json");
    expect(rule.allowedKeys).toEqual(Object.keys(recipe.env));
    expect(rule.urlHostAllowlist).toEqual(hostsOf(recipe.env));
  });
});
