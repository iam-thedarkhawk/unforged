import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/compare-reference.mjs", import.meta.url));
const REFERENCE: Record<string, string> = JSON.parse(
  readFileSync(new URL("../../../study/lido-0.161.0/manifest-linux-x64.json", import.meta.url), "utf8"),
);
const CONFIG_PATH = "/runtime/window-env.js";
const FIRST_PATH = Object.keys(REFERENCE)[0]!;

describe("compare-reference.mjs", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "unforged-compare-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function compare(manifest: object, outDir?: string) {
    const path = join(dir, "manifest.json");
    writeFileSync(path, JSON.stringify(manifest));
    const args = outDir ? [SCRIPT, path, outDir] : [SCRIPT, path];
    return spawnSync("node", args, { encoding: "utf8" });
  }

  it("reports 170/170 and exits 0 when everything matches", () => {
    const result = compare({ files: REFERENCE, config: {} });
    expect(result.stdout).toContain("170/170 identical");
    expect(result.status).toBe(0);
  });

  it("names a differing file and exits 1", () => {
    const result = compare({ files: { ...REFERENCE, [FIRST_PATH]: "0".repeat(64) }, config: {} });
    expect(result.stdout).toContain("169/170 identical");
    expect(result.stdout).toContain(FIRST_PATH);
    expect(result.status).toBe(1);
  });

  it("counts a missing file as differing", () => {
    const { [FIRST_PATH]: _dropped, ...files } = REFERENCE;
    const result = compare({ files, config: {} });
    expect(result.stdout).toContain("169/170 identical");
    expect(result.stdout).toContain(FIRST_PATH);
    expect(result.status).toBe(1);
  });

  it("fails on a file the reference does not have", () => {
    const result = compare({ files: { ...REFERENCE, "/extra.js": "0".repeat(64) }, config: {} });
    expect(result.stdout).toContain("/extra.js");
    expect(result.status).toBe(1);
  });

  it("hashes config files from the build output, since the manifest only holds their rule", () => {
    const { [CONFIG_PATH]: _config, ...files } = REFERENCE;
    const outDir = join(dir, "out");
    mkdirSync(join(outDir, "runtime"), { recursive: true });
    writeFileSync(join(outDir, CONFIG_PATH), "window.__env__={}");

    const result = compare({ files, config: { [CONFIG_PATH]: { kind: "window-env-json", allowedKeys: [] } } }, outDir);
    expect(result.stdout).toContain("169/170 identical");
    expect(result.stdout).toContain(CONFIG_PATH);
    expect(result.status).toBe(1);
  });
});
