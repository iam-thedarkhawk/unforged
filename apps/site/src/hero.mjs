import { createHash } from "node:crypto";

/** The manifest root both builders attested for Lido 0.161.0 (docs/demo.md). */
export const ROOT = "13c7535a8b18401f36f176ebc74488ed5929e494b8d4e15f6a68a1bee9d26682";

/**
 * Illustrative only: nothing real hashes to this. It is a real SHA-256 output,
 * so it differs from the root the way a tampered file's hash would: almost
 * everywhere, with a few characters matching by chance.
 */
export const TAMPERED = createHash("sha256").update(`tampered ${ROOT}`).digest("hex");

function cells(hash, classFor) {
  return [...hash]
    .map((char, index) => {
      const name = classFor(char, index);
      return name ? `<span class="${name}">${char}</span>` : `<span>${char}</span>`;
    })
    .join("");
}

function row(label, hash, classFor, verdict) {
  const statusClass = verdict === "Match" ? "status status-match" : "status status-mismatch";
  return `<div class="assay-row">
        <div class="assay-head">
          <span class="assay-label">${label}</span>
          <span class="${statusClass}"><span class="status-waiting">Waiting</span><span class="status-final">${verdict}</span></span>
        </div>
        <div class="hash" aria-hidden="true">${cells(hash, classFor)}</div>
        <span class="sr-only">${hash}</span>
      </div>`;
}

/**
 * The hero's markup is its final state, so it is correct with JS off and with
 * reduced motion. hero.js only replays how it got there.
 */
export function renderHero() {
  const matches = () => "ok";
  const differs = (char, index) => (char === ROOT[index] ? "" : "bad");
  return [
    row("Builder 1 (Docker)", ROOT, matches, "Match"),
    row("Builder 2 (GitHub Action)", ROOT, matches, "Match"),
    row("Served file", TAMPERED, differs, "No match"),
  ].join("\n      ");
}
