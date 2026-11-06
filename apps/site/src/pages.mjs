// The docs site's table of contents. A file not listed here is never published.
export const NAV = [
  { group: "Start", pages: [{ source: "README.md", label: "Overview" }] },
  {
    group: "How it works",
    pages: [
      { source: "docs/architecture.md", label: "Architecture" },
      { source: "docs/threat-model.md", label: "Threat model" },
      { source: "docs/demo.md", label: "Demo" },
    ],
  },
  {
    group: "Reference",
    pages: [
      { source: "docs/formats.md", label: "Formats" },
      { source: "docs/extension.md", label: "Extension" },
      { source: "docs/cli-registry.md", label: "CLI and registry" },
    ],
  },
  {
    group: "Arkiv",
    pages: [
      { source: "arkiv/schema.md", label: "Schema" },
      { source: "arkiv/how-you-use-arkiv.md", label: "How we use Arkiv" },
      { source: "arkiv/why-arkiv.md", label: "Why Arkiv" },
      { source: "arkiv/reach.md", label: "Reach" },
      { source: "arkiv/friction.md", label: "Friction log" },
    ],
  },
  { group: "Research", pages: [{ source: "study/README.md", label: "Reproducibility study" }] },
];

export const ALL_SOURCES = NAV.flatMap(({ pages }) => pages.map((page) => page.source));

/** Output path of a published source, relative to the site root. */
export function outputPath(source) {
  if (source === "README.md") return "docs/index.html";
  if (source === "study/README.md") return "docs/study.html";
  const name = source.split("/").pop().replace(/\.md$/, "");
  return `docs/${name}.html`;
}
