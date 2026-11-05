#!/usr/bin/env node
import { Command } from "commander";
import { runBuild } from "./build.js";
import { CliError, EXIT_BUILD_FAILED } from "./errors.js";

const program = new Command("unforged").description("Rebuild dapps from source and attest the result");

program
  .command("build")
  .description("Build a recipe and write manifest.json and build.log to the current directory")
  .argument("<recipe>", "path to the recipe YAML")
  .option("--check", "build twice from a clean checkout and exit 3 if the manifests differ")
  .option("--allow-node-mismatch", "build even if node --version doesn't match recipe.node")
  .action(async (recipe: string, options: { check?: boolean; allowNodeMismatch?: boolean }) => {
    console.log(await runBuild(recipe, options));
  });

program.parseAsync().catch((error: unknown) => {
  console.error(`unforged: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = error instanceof CliError ? error.exitCode : EXIT_BUILD_FAILED;
});
