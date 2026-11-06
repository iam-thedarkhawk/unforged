// Blocked page's "What changed" panel. The bodies come from the site being checked and the
// mirror, so every line goes in as a text node (dom.ts el); nothing here parses them as HTML.
import type { Blocked } from "@unforged/core";
import { buildDiffView, firstDiffable, summaryText, unavailableText, type CodeKind, type DiffLine, type DiffModel } from "./diff.js";
import { byId, el } from "./dom.js";
import { blockedFileLabel } from "./format.js";
import type { StateSource } from "./source.js";

function lineNode({ kind, text }: DiffLine): HTMLElement {
  return el("span", `diff-line diff-${kind}`, text);
}

function diffNodes(model: DiffModel): HTMLElement[] {
  const nodes: HTMLElement[] = [el("p", "diff-summary", summaryText(model))];
  if (model.lines.length > 0) {
    const lines = el("pre", "diff-lines", ...model.lines.map(lineNode));
    lines.tabIndex = 0; // it scrolls, so it must be reachable from the keyboard
    lines.setAttribute("aria-label", "Differences between the verified copy and the served file");
    nodes.push(lines);
  }
  if (model.hiddenLines > 0) nodes.push(el("p", "diff-note", `${model.hiddenLines} more lines not shown.`));
  return nodes;
}

function compareNote(message: string): HTMLElement {
  return el("p", "diff-note", message);
}

async function compare(source: StateSource, tabId: number | undefined, url: string, kind: CodeKind): Promise<HTMLElement[]> {
  const served = await source.getBlockedBody(tabId, url);
  if ("error" in served) return [compareNote(unavailableText("The served file", served.error))];
  const verified = await source.getVerifiedFile(tabId, url);
  if ("error" in verified) return [compareNote(unavailableText("The verified copy", verified.error))];
  await new Promise((resolve) => setTimeout(resolve)); // let "Comparing…" paint: formatting takes a moment
  const view = buildDiffView(verified.body, served.body, kind);
  return "error" in view ? [compareNote(view.error)] : diffNodes(view);
}

/** Fills the panel. Whatever goes wrong stays inside it: the rest of the page is already up. */
export async function showDiffPanel(source: StateSource, tabId: number | undefined, blocked: readonly Blocked[]): Promise<void> {
  const target = firstDiffable(blocked);
  if (!target) return;
  const heading = [el("h2", "", "What changed"), el("code", "file-path", blockedFileLabel(target.entry))];
  const panel = byId("diff");
  const status = el("div", "");
  status.setAttribute("role", "status");
  status.append(compareNote("Comparing with the verified copy…"));
  panel.replaceChildren(...heading, status);
  try {
    status.replaceChildren(...(await compare(source, tabId, target.entry.url, target.kind)));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    status.replaceChildren(compareNote(unavailableText("The comparison", reason)));
  }
}
