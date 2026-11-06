import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { after, before, test } from "node:test";
import { build, repoRoot } from "./build.mjs";
import { ROOT } from "./src/hero.mjs";

const EXPECTED_PAGES = [
  ["README.md", "index.html"],
  ["docs/architecture.md", "architecture.html"],
  ["docs/threat-model.md", "threat-model.html"],
  ["docs/demo.md", "demo.html"],
  ["docs/formats.md", "formats.html"],
  ["docs/extension.md", "extension.html"],
  ["docs/cli-registry.md", "cli-registry.html"],
  ["arkiv/schema.md", "schema.html"],
  ["arkiv/how-you-use-arkiv.md", "how-you-use-arkiv.html"],
  ["arkiv/why-arkiv.md", "why-arkiv.html"],
  ["arkiv/reach.md", "reach.html"],
  ["arkiv/friction.md", "friction.html"],
  ["study/README.md", "study.html"],
];

let out;
let files;

function read(path) {
  return readFileSync(join(out, path), "utf8");
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => relative(out, join(entry.parentPath, entry.name)));
}

function attributes(html, name) {
  return [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, "g"))].map((match) => match[1]);
}

before(async () => {
  out = mkdtempSync(join(tmpdir(), "unforged-site-"));
  await build({ outDir: out, quiet: true });
  files = htmlFiles(out);
});

after(() => rmSync(out, { recursive: true, force: true }));

test("every page with a source in the repo is published", () => {
  for (const [source, page] of EXPECTED_PAGES) {
    const hasSource = existsSync(join(repoRoot, source));
    assert.equal(existsSync(join(out, "docs", page)), hasSource, `${source} -> docs/${page}`);
  }
  assert.ok(existsSync(join(out, "index.html")));
});

test("private documents are never published", () => {
  const names = files.join("\n");
  assert.doesNotMatch(names, /prompts|build-plan|CLAUDE/i);
  for (const file of files) {
    const hrefs = attributes(read(file), "href").filter((href) => !href.startsWith("http"));
    assert.ok(!hrefs.some((href) => /prompts|build-plan|CLAUDE/.test(href)), file);
  }
});

test("no HTML comment reaches any output", () => {
  for (const file of files) assert.ok(!read(file).includes("<!--"), file);
});

test("every internal href and src resolves, including fragments", () => {
  const isExternal = (url) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url);
  const broken = [];
  for (const file of files) {
    const html = read(file);
    for (const url of [...attributes(html, "href"), ...attributes(html, "src")]) {
      if (isExternal(url)) continue;
      assert.ok(!url.startsWith("/"), `${file}: ${url} must be relative, the site lives under /unforged/`);
      const [path, fragment] = url.split("#");
      const target = path ? resolve(dirname(join(out, file)), path) : join(out, file);
      if (!existsSync(target)) {
        broken.push(`${file}: ${url}`);
      } else if (fragment && !attributes(readFileSync(target, "utf8"), "id").includes(fragment)) {
        broken.push(`${file}: ${url} (no such id)`);
      }
    }
  }
  assert.deepEqual(broken, []);
});

test("every external link has rel=noopener", () => {
  for (const file of files) {
    for (const [tag] of read(file).matchAll(/<a\s[^>]*href="https?:[^>]*>/g)) {
      assert.match(tag, /rel="noopener"/, `${file}: ${tag}`);
    }
  }
});

test("doc pages have the title, nav state and links the spec asks for", () => {
  const demo = read("docs/demo.html");
  assert.match(demo, /<title>Demo environment \(owner: Yuvraaj\) · Unforged<\/title>/);
  assert.match(demo, /<a href="demo\.html" aria-current="page">/);
  assert.equal(demo.match(/aria-current="page"/g).length, 1);
  assert.match(demo, /<h2 id="live-on-arkiv-rabdi">/);
  assert.match(demo, /github\.com\/intelligent-ears\/unforged\/blob\/main\/demo\/policy\.json/);
  assert.match(read("docs/index.html"), /<a href="index\.html" aria-current="page">Overview/);
  assert.match(read("docs/threat-model.html"), /<h2 id="gaps-outside-this-ranking">/);
});

test("the hero's final state is in the HTML, so it works without JS", () => {
  const landing = read("index.html");
  const hashes = [...landing.matchAll(/<div class="hash"[^>]*>(.*?)<\/div>/gs)].map((match) => match[1]);
  assert.equal(hashes.length, 3);
  const text = (row) => row.replace(/<[^>]+>/g, "");
  assert.equal(text(hashes[0]), ROOT);
  assert.equal(text(hashes[1]), ROOT);
  assert.equal(text(hashes[2]).length, 64);
  assert.notEqual(text(hashes[2]), ROOT);
  assert.equal(hashes[0].match(/class="ok"/g).length, 64);
  assert.equal(hashes[1].match(/class="ok"/g).length, 64);
  const differing = [...text(hashes[2])].filter((char, index) => char !== ROOT[index]).length;
  assert.equal(hashes[2].match(/class="bad"/g).length, differing);
  assert.match(landing, /Blocked before it ran/);
});

test("the landing page carries the demo doc's evidence unchanged", () => {
  const landing = read("index.html");
  const demo = readFileSync(join(repoRoot, "docs/demo.md"), "utf8");
  const explorerLinks = (text) => new Set(text.match(/https:\/\/rabdi\.explorer\.arkiv\.network\/[a-z]+\/0x[0-9a-fA-F]+/g));
  assert.deepEqual(explorerLinks(landing), explorerLinks(demo));
  assert.ok(demo.includes(ROOT), "the hero root is the published manifest root");
  assert.ok(landing.includes(`>${ROOT}<`), "the proof section shows the full root");
});

test("the landing page follows the design rules", () => {
  const landing = read("index.html");
  assert.ok(!landing.includes("→"));
  for (const section of ["Trust the source, not the server.", "Bybit", "13", "CROPS", "Built at ETHGlobal Mumbai 2026"]) {
    assert.ok(landing.includes(section), section);
  }
  assert.equal(landing.match(/<script/g).length, 1, "only the hero animation runs JS");
  for (const file of files.filter((name) => name !== "index.html")) {
    assert.ok(!read(file).includes("<script"), `${file} has no JS`);
  }
});
