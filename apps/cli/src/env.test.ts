import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { buildEnv, hostEnv } from "./env.js";
import { parseRecipe } from "./recipe.js";

const demoRecipeText = readFileSync(
  new URL("../../../recipes/lido-staking-widget@0.161.0.yaml", import.meta.url),
  "utf8",
);

const HOST = {
  PATH: "/usr/bin:/bin",
  HOME: "/home/builder",
  HTTPS_PROXY: "http://proxy:3128",
  BUILDER_PRIVATE_KEY: "0xnot-a-real-key",
  CURATOR_PRIVATE_KEY: "0xnot-a-real-key",
  NODE_ENV: "development",
  CI: "true",
  GITHUB_TOKEN: "not-a-real-token",
  TZ: "Europe/Berlin",
};

describe("hostEnv", () => {
  it("keeps only PATH, HOME and proxy variables, plus a fixed locale and timezone", () => {
    expect(hostEnv(HOST)).toEqual({
      TZ: "UTC",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      PATH: "/usr/bin:/bin",
      HOME: "/home/builder",
      HTTPS_PROXY: "http://proxy:3128",
    });
  });

  it("drops keys, tokens and local build switches", () => {
    const env = hostEnv(HOST);
    for (const name of ["BUILDER_PRIVATE_KEY", "CURATOR_PRIVATE_KEY", "NODE_ENV", "CI", "GITHUB_TOKEN"]) {
      expect(env).not.toHaveProperty(name);
    }
  });

  it("keeps lowercase proxy variables", () => {
    expect(hostEnv({ https_proxy: "http://p", no_proxy: "localhost" })).toMatchObject({
      https_proxy: "http://p",
      no_proxy: "localhost",
    });
  });
});

describe("buildEnv", () => {
  it("adds the demo recipe's env on top of the host env", () => {
    const env = buildEnv(parseRecipe(demoRecipeText), HOST);
    expect(env.EL_RPC_URLS_560048).toBe("https://hoodi.drpc.org");
    expect(env.PATH).toBe("/usr/bin:/bin");
    expect(env).not.toHaveProperty("BUILDER_PRIVATE_KEY");
  });
});

describe("recipe env", () => {
  it("rejects names that look like secrets", () => {
    const recipe = parse(demoRecipeText);
    recipe.env.API_KEY = "x";
    expect(() => parseRecipe(stringify(recipe))).toThrow(/recipe env must not contain secrets/);
  });
});
