import type { Recipe } from "@unforged/core";

/** Recipe env names that look like credentials. Recipes are public, so these never belong there. */
export const SECRET_NAME = /KEY|SECRET|TOKEN|PRIVATE|PASSWORD/i;

/** Host variables a build needs to find tools and reach the network. Nothing else is passed on. */
const PASSED_THROUGH = [
  "PATH",
  "HOME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
];

/** A minimal env: fixed timezone and locale, plus PATH, HOME and proxies when the host sets them. */
export function hostEnv(host: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = { TZ: "UTC", LANG: "C.UTF-8", LC_ALL: "C.UTF-8" };
  for (const name of PASSED_THROUGH) {
    const value = host[name];
    if (value !== undefined) env[name] = value;
  }
  return env;
}

/** The env install and build run with: the host minimum plus exactly what the recipe declares. */
export function buildEnv(recipe: Recipe, host: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return { ...hostEnv(host), ...recipe.env };
}
