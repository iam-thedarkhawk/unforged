import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHero } from "./src/hero.mjs";
import { docPage, footer, head, topBar } from "./src/layout.mjs";
import { createSlugger, renderMarkdown } from "./src/markdown.mjs";
import { NAV, outputPath } from "./src/pages.mjs";

const siteDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(siteDir, "../..");
const src = (name) => readFileSync(join(siteDir, "src", name), "utf8");

/** NAV without pages whose source isn't in the repo, and without groups left empty. */
function availableNav(log) {
  const nav = NAV.map(({ group, pages }) => ({
    group,
    pages: pages.filter(({ source }) => {
      const found = existsSync(join(repoRoot, source));
      if (!found) log(`skipped ${source}: not in the repo`);
      return found;
    }),
  }));
  return nav.filter(({ pages }) => pages.length > 0);
}

function write(outDir, page, html) {
  const path = join(outDir, page);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
}

function buildDocs(outDir, nav) {
  const published = new Set(nav.flatMap(({ pages }) => pages.map(({ source }) => source)));
  for (const source of published) {
    const markdown = readFileSync(join(repoRoot, source), "utf8");
    const { html, title } = renderMarkdown(markdown, source, { published });
    write(outDir, outputPath(source), docPage({ title, body: html, source, nav }));
  }
}

/** The README's CROPS section once it exists; until then, the page the CROPS lines draw on. */
function cropsLink() {
  const nextId = createSlugger();
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  const headings = [...readme.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => nextId(match[1]));
  return headings.includes("crops")
    ? '<a href="docs/index.html#crops">Read the CROPS section</a>'
    : '<a href="docs/threat-model.html">Read the threat model</a>';
}

function buildLanding(outDir) {
  const page = "index.html";
  const values = {
    HEAD: head("Unforged: trust the source, not the server", page),
    TOPBAR: topBar(page),
    FOOTER: footer(page),
    HERO_ROWS: renderHero(),
    HERO_SCRIPT: src("hero.js").trim(),
    CROPS_LINK: cropsLink(),
  };
  const html = src("landing.html").replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`landing.html: unknown placeholder ${key}`);
    return values[key];
  });
  write(outDir, page, html);
}

export async function build({ outDir = join(siteDir, "dist"), quiet = false } = {}) {
  const log = quiet ? () => {} : console.warn;
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "assets"), { recursive: true });
  copyFileSync(join(siteDir, "src/site.css"), join(outDir, "assets/site.css"));
  copyFileSync(join(siteDir, "src/mark.svg"), join(outDir, "assets/mark.svg"));
  // GitHub Pages must serve the output as it is, not through Jekyll.
  writeFileSync(join(outDir, ".nojekyll"), "");
  buildDocs(outDir, availableNav(log));
  buildLanding(outDir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
