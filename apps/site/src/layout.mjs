import { escapeHtml, GITHUB_URL, relativeToPage } from "./markdown.mjs";
import { outputPath } from "./pages.mjs";

const FONTS =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap";

const DESCRIPTION =
  "A Firefox extension that blocks a dapp's code unless independent builders rebuilt it from the public source and got the same bytes.";

export function head(title, page) {
  const asset = (path) => relativeToPage(path, page);
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(DESCRIPTION)}">
<link rel="icon" href="${asset("assets/mark.svg")}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${asset("assets/site.css")}">`;
}

export function topBar(page) {
  const link = (path) => relativeToPage(path, page);
  return `<a class="skip-link" href="#content">Skip to content</a>
<header class="topbar">
  <a class="wordmark" href="${link("index.html")}"><img src="${link("assets/mark.svg")}" alt="" width="20" height="24">Unforged</a>
  <nav aria-label="Site">
    <a href="${link("docs/index.html")}">Docs</a>
    <a href="${GITHUB_URL}" rel="noopener">GitHub</a>
  </nav>
</header>`;
}

export function footer(page) {
  return `<footer class="footer">
  <a href="${GITHUB_URL}/blob/main/LICENSE" rel="noopener">MIT</a>
  <a href="${GITHUB_URL}" rel="noopener">GitHub</a>
  <a href="${relativeToPage("docs/index.html", page)}">Docs</a>
  <span>Built at ETHGlobal Mumbai 2026</span>
</footer>`;
}

function sidebar(nav, currentSource, page) {
  const groups = nav.map(({ group, pages }) => {
    const items = pages.map(({ source, label }) => {
      const current = source === currentSource ? ' aria-current="page"' : "";
      return `<li><a href="${relativeToPage(outputPath(source), page)}"${current}>${escapeHtml(label)}</a></li>`;
    });
    return `<div class="nav-group"><p class="nav-title">${escapeHtml(group)}</p><ul>${items.join("")}</ul></div>`;
  });
  return `<nav class="sidebar" aria-label="Docs">\n${groups.join("\n")}\n</nav>`;
}

export function docPage({ title, body, source, nav }) {
  const page = outputPath(source);
  return `<!doctype html>
<html lang="en">
<head>
${head(`${title} · Unforged`, page)}
</head>
<body>
${topBar(page)}
<div class="docs">
${sidebar(nav, source, page)}
<main id="content" class="prose" tabindex="-1">
${body}</main>
</div>
${footer(page)}
</body>
</html>
`;
}
