import assert from "node:assert/strict";
import { test } from "node:test";
import { createSlugger, renderMarkdown, rewriteLink, slug } from "./src/markdown.mjs";

const GITHUB = "https://github.com/intelligent-ears/unforged";

test("slug matches GitHub's heading ids", () => {
  assert.equal(slug("Live on Arkiv Rabdi"), "live-on-arkiv-rabdi");
  assert.equal(slug("Gaps outside this ranking"), "gaps-outside-this-ranking");
  assert.equal(slug("What's new? (v1.0)"), "whats-new-v10");
  assert.equal(slug("CLI, registry & Action"), "cli-registry--action");
  assert.equal(slug("Non-code responses"), "non-code-responses");
});

test("duplicate slugs get a numeric suffix", () => {
  const slugger = createSlugger();
  assert.equal(slugger("Setup"), "setup");
  assert.equal(slugger("Setup"), "setup-1");
  assert.equal(slugger("Setup"), "setup-2");
  assert.equal(slugger("Setup-1"), "setup-1-1");
});

test("links to published markdown go to the generated page", () => {
  assert.equal(rewriteLink("docs/demo.md#x", "README.md"), "docs/demo.html#x");
  assert.equal(rewriteLink("../arkiv/schema.md", "docs/formats.md"), "docs/schema.html");
  assert.equal(rewriteLink("threat-model.md#gaps", "docs/demo.md"), "docs/threat-model.html#gaps");
  assert.equal(rewriteLink("../README.md", "docs/demo.md"), "docs/index.html");
  assert.equal(rewriteLink("../study/README.md", "docs/demo.md"), "docs/study.html");
});

test("other repo links go to GitHub", () => {
  assert.equal(rewriteLink("../LICENSE", "docs/demo.md"), `${GITHUB}/blob/main/LICENSE`);
  assert.equal(rewriteLink("../study/", "docs/demo.md"), `${GITHUB}/tree/main/study`);
  assert.equal(rewriteLink("../demo", "docs/demo.md"), `${GITHUB}/tree/main/demo`);
  assert.equal(rewriteLink("../demo/policy.json#L2", "docs/demo.md"), `${GITHUB}/blob/main/demo/policy.json#L2`);
  assert.equal(rewriteLink("prompts.md", "docs/demo.md"), `${GITHUB}/blob/main/docs/prompts.md`);
  assert.equal(rewriteLink("CLAUDE.md", "README.md"), `${GITHUB}/blob/main/CLAUDE.md`);
});

test("a listed page with no source yet links to GitHub, not a missing page", () => {
  const published = new Set(["README.md"]);
  assert.equal(rewriteLink("arkiv/schema.md", "README.md", { published }), `${GITHUB}/blob/main/arkiv/schema.md`);
});

test("absolute links and fragments are left alone", () => {
  for (const href of ["https://example.com/a.md", "http://example.com", "mailto:a@example.com", "#local"]) {
    assert.equal(rewriteLink(href, "docs/demo.md"), href);
  }
});

test("rendered links are relative to the output page", () => {
  const { html } = renderMarkdown("# T\n\n[a](docs/demo.md#x) [b](docs/formats.md)", "README.md");
  assert.match(html, /href="demo\.html#x"/);
  assert.match(html, /href="formats\.html"/);
});

test("external links get rel=noopener, internal ones do not", () => {
  const { html } = renderMarkdown("# T\n\n[a](https://example.com) [b](../LICENSE) [c](demo.md) [d](mailto:a@example.com)", "docs/formats.md");
  assert.match(html, /<a href="https:\/\/example\.com" rel="noopener">a<\/a>/);
  assert.match(html, /blob\/main\/LICENSE" rel="noopener">b<\/a>/);
  assert.match(html, /<a href="demo\.html">c<\/a>/);
  assert.match(html, /<a href="mailto:a@example\.com">d<\/a>/);
});

test("the title is the first h1 and h2/h3 carry anchors", () => {
  const { html, title } = renderMarkdown("# The `core` title\n\n## Part A\n\n### Part A\n\n#### Deep", "docs/formats.md");
  assert.equal(title, "The core title");
  assert.match(html, /<h1 id="the-core-title">The <code>core<\/code> title<\/h1>/);
  assert.match(html, /<h2 id="part-a">Part A <a class="anchor" href="#part-a"/);
  assert.match(html, /<h3 id="part-a-1">Part A <a class="anchor" href="#part-a-1"/);
  assert.match(html, /<h4 id="deep">Deep<\/h4>/);
});

test("a page without an h1 fails the build", () => {
  assert.throws(() => renderMarkdown("## Only h2", "docs/formats.md"), /no h1/);
});

test("HTML comments never reach the output", () => {
  const md = "# T\n\n<!-- block -->\n\nText <!-- inline --> more\n\n<!-- multi\nline -->\n\n`<!-- code -->`\n\n<!-- unclosed";
  const { html } = renderMarkdown(md, "docs/formats.md");
  assert.ok(!html.includes("<!--"), html);
  assert.ok(!html.includes("block"), html);
  assert.ok(!html.includes("inline"), html);
  assert.ok(html.includes("&lt;!-- code --&gt;"), "literal code stays visible");
});

test("GFM tables render inside their own scroll container", () => {
  const { html } = renderMarkdown("# T\n\n| a | b |\n|---|---|\n| 1 | 2 |", "docs/formats.md");
  assert.match(html, /<div class="table-scroll"[^>]*>\s*<table>/);
  assert.match(html, /<td>1<\/td>/);
});
