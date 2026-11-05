import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigRule, Recipe } from "@unforged/core";
import { parse } from "yaml";
import { z } from "zod";
import { CliError, EXIT_BUILD_FAILED } from "./errors.js";

const hasNoParentSegment = (path: string) => !path.split("/").includes("..");

const repoRelativePath = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith("/") && hasNoParentSegment(path), "must stay inside the repo");

const configRule = z.strictObject({
  kind: z.literal("window-env-json"),
  allowedKeys: z.array(z.string()),
  urlHostAllowlist: z.array(z.string()).optional(),
}) satisfies z.ZodType<ConfigRule>;

// Strict, so a field that recipeDigest would cover can't be added without the schema knowing it.
const recipeSchema = z.strictObject({
  dapp: z.string().regex(/^[a-z0-9-]+$/),
  release: z.string().min(1),
  repo: z.string().regex(/^https:\/\/\S+$/),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  node: z.string().regex(/^\d+(\.\d+){0,2}$/),
  packageManager: z.string().regex(/^[a-z]+@\S+$/),
  files: z.record(repoRelativePath, z.string()),
  env: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z.string().regex(/^[^\r\n]*$/)),
  envFile: repoRelativePath,
  buildPath: z
    .string()
    .regex(/^(\/[^/]+)+$/, "must be absolute and not the filesystem root")
    .refine(hasNoParentSegment, "must not contain .."),
  install: z.string().min(1),
  build: z.string().min(1),
  output: repoRelativePath,
  configFiles: z.record(z.string().regex(/^\/.+/), configRule),
}) satisfies z.ZodType<Recipe>;

export function parseRecipe(yamlText: string): Recipe {
  const result = recipeSchema.safeParse(parse(yamlText));
  if (!result.success) {
    throw new CliError(EXIT_BUILD_FAILED, `invalid recipe:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** `wanted` is a version prefix: "24" matches v24.22.2, "22.23.4" only matches itself. */
export function nodeVersionMatches(wanted: string, actual: string): boolean {
  const actualParts = actual.replace(/^v/, "").split(".");
  return wanted.split(".").every((part, index) => part === actualParts[index]);
}

/** Points `yarn` at the release the repo vendors, so corepack never downloads one. */
export function resolveYarn(
  command: string,
  packageManager: string,
  repoDir: string,
  exists: (path: string) => boolean = existsSync,
): string {
  const version = /^yarn@(.+)$/.exec(packageManager)?.[1];
  if (!version) return command;
  const release = `.yarn/releases/yarn-${version}.cjs`;
  if (!exists(join(repoDir, release))) return command;
  return command.replace(/(^|&&|\|\||;)(\s*)yarn(?=\s|$)/g, `$1$2node ${release}`);
}
