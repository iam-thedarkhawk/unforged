#!/usr/bin/env node
// Usage: compare-reference.mjs <manifest.json> [outputDir]
// Compares a build against the study's Lido reference. A manifest holds only the rule for a
// config file, not its hash, so config files are hashed from outputDir (default: the recipes' out dir).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REFERENCE_URL = new URL("../../../study/lido-0.161.0/manifest-linux-x64.json", import.meta.url);
const DEFAULT_OUTPUT_DIR = "/unforged/build/out";

const [manifestPath, outputDir = DEFAULT_OUTPUT_DIR] = process.argv.slice(2);
if (!manifestPath) {
  console.error("usage: compare-reference.mjs <manifest.json> [outputDir]");
  process.exit(2);
}

function hashConfigFile(path) {
  const file = join(outputDir, path);
  return existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : undefined;
}

const reference = JSON.parse(readFileSync(REFERENCE_URL, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const actual = { ...manifest.files };
for (const path of Object.keys(manifest.config)) actual[path] = hashConfigFile(path);

const referencePaths = Object.keys(reference);
const identical = referencePaths.filter((path) => actual[path] === reference[path]);
const differing = [...new Set([...referencePaths, ...Object.keys(actual)])]
  .filter((path) => actual[path] !== reference[path])
  .sort();

console.log(`${identical.length}/${referencePaths.length} identical`);
for (const path of differing) console.log(`  ${path}`);
process.exitCode = differing.length === 0 ? 0 : 1;
