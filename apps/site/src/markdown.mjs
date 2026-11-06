import { existsSync, statSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked, Renderer } from "marked";
import { ALL_SOURCES, outputPath } from "./pages.mjs";

export const GITHUB_URL = "https://github.com/intelligent-ears/unforged";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;

export function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** GitHub's heading id: lowercase, punctuation dropped, each space a hyphen. */
export function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** A slug function that remembers what it issued: the second "x" becomes "x-1". */
export function createSlugger() {
  const used = new Set();
  return (text) => {
    const base = slug(text);
    let candidate = base;
    for (let n = 1; used.has(candidate); n += 1) candidate = `${base}-${n}`;
    used.add(candidate);
    return candidate;
  };
}

function isRepoDirectory(repoPath) {
  const absolute = join(REPO_ROOT, repoPath);
  return existsSync(absolute) && statSync(absolute).isDirectory();
}

/**
 * Where a markdown link should point. Returns a path from the site root for a
 * published page, a GitHub URL for anything else in the repo, and leaves
 * absolute URLs and same-page fragments alone.
 */
export function rewriteLink(href, source, { published = new Set(ALL_SOURCES) } = {}) {
  if (ABSOLUTE_URL.test(href) || href.startsWith("#")) return href;

  const [, path, suffix] = href.match(/^([^?#]*)(.*)$/s);
  const resolved = posix.normalize(posix.join(posix.dirname(source), path));
  const repoPath = resolved.replace(/\/$/, "");
  if (published.has(repoPath)) return outputPath(repoPath) + suffix;

  const kind = path.endsWith("/") || isRepoDirectory(repoPath) ? "tree" : "blob";
  const tail = repoPath === "." ? "" : `/${repoPath}`;
  return `${GITHUB_URL}/${kind}/main${tail}${suffix}`;
}

/** Turns a path from the site root into a URL relative to the page it appears on. */
export function relativeToPage(target, page) {
  if (ABSOLUTE_URL.test(target) || target.startsWith("#")) return target;
  const [, path, suffix] = target.match(/^([^?#]*)(.*)$/s);
  return posix.relative(posix.dirname(page), path) + suffix;
}

function renderLink(href, label, title) {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  const rel = /^https?:/i.test(href) ? ' rel="noopener"' : "";
  return `<a href="${escapeHtml(href)}"${titleAttr}${rel}>${label}</a>`;
}

/** Renders one source file to its page body. Returns the body HTML and the first h1's text. */
export function renderMarkdown(markdown, source, { published = new Set(ALL_SOURCES) } = {}) {
  const page = outputPath(source);
  const nextId = createSlugger();
  let title = null;

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const text = this.parser.parseInline(tokens, this.parser.textRenderer).replace(HTML_COMMENT, "");
        const id = nextId(text);
        if (depth === 1 && title === null) title = text.trim();
        const anchor =
          depth === 2 || depth === 3
            ? ` <a class="anchor" href="#${id}" aria-label="Link to this section: ${escapeHtml(text.trim())}">#</a>`
            : "";
        return `<h${depth} id="${id}">${inner}${anchor}</h${depth}>\n`;
      },
      link({ href, title: linkTitle, tokens }) {
        const target = relativeToPage(rewriteLink(href, source, { published }), page);
        return renderLink(target, this.parser.parseInline(tokens), linkTitle);
      },
      html({ text }) {
        return text.replace(HTML_COMMENT, "");
      },
      table(token) {
        const table = Renderer.prototype.table.call(this, token);
        return `<div class="table-scroll" role="region" aria-label="Table" tabindex="0">\n${table}</div>\n`;
      },
      code(token) {
        return Renderer.prototype.code.call(this, token).replace("<pre>", '<pre tabindex="0">');
      },
    },
  });

  const html = marked.parse(markdown);
  if (title === null) throw new Error(`${source} has no h1, so its page has no title`);
  return { html, title };
}
