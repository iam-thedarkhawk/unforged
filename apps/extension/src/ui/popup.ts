// Toolbar popup: shows what the background reports about the active tab.
import type { SnapshotSummary, TabState, Verdict } from "@unforged/core";
import { byId, detailList, el, showMockNotice } from "./dom.js";
import {
  blockedFileLabel,
  buildersCount,
  configValueText,
  dappOf,
  reasonText,
  relativeTime,
  shortAddress,
  shortCommit,
  statusLabel,
} from "./format.js";
import { stateSource, type StateSource } from "./source.js";

function statusLine(level: Verdict["level"] | "error", text: string): HTMLElement {
  const dot = el("span", `dot dot-${level}`);
  dot.setAttribute("aria-hidden", "true");
  return el("p", "status", dot, el("strong", "", text));
}

/** Only a reproduced verdict names builders for the code in this tab. */
function buildersDetail(verdict: Verdict, total: number | undefined): HTMLElement | undefined {
  if (verdict.level !== "reproduced") return undefined;
  const addresses = verdict.builders.map((builder) => el("code", "address", shortAddress(builder)));
  return el("span", "", el("div", "", buildersCount(verdict.builders, total)), ...addresses);
}

function stateDetails(state: TabState, summary: SnapshotSummary | undefined): HTMLElement {
  const verdict = state.verdict;
  const dapp = dappOf(state);
  const release = state.release ?? ("release" in verdict ? verdict.release : undefined);
  const entry = summary?.dapps.find((d) => d.dapp === dapp);
  const commit = entry?.releases.find((r) => r.release === release)?.commit;
  return detailList([
    ["Dapp", dapp],
    ["Release", release],
    ["Commit", commit && shortCommit(commit)],
    ["Builders", buildersDetail(verdict, entry?.buildersTotal)],
    ["Files checked", dapp ? String(state.checked) : undefined],
  ]);
}

function blockedFiles(state: TabState): HTMLElement {
  const items = state.blocked.map((file) =>
    el("li", "", el("code", "file-path", blockedFileLabel(file)), el("span", "file-reason", reasonText(file.reason))),
  );
  return el("section", "", el("h2", "", "Blocked files"), el("ul", "file-list", ...items));
}

function configValues(values: Record<string, unknown>): HTMLElement {
  const rows = Object.entries(values).map(([key, value]): [string, string] => [key, configValueText(value)]);
  const list = detailList(rows);
  list.classList.add("config");
  return el("section", "", el("h2", "", "Accepted config"), list);
}

function syncLine(summary: SnapshotSummary | undefined): HTMLElement {
  const when = summary ? relativeTime(summary.syncedAt) : "unavailable";
  return el("p", "sync", `Last sync: ${when}`);
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/** Never fall back to a verdict: if the state can't be read, say so. */
function showUnavailable(root: HTMLElement, reason: unknown): void {
  const message = reason instanceof Error ? reason.message : String(reason);
  root.replaceChildren(
    statusLine("error", "Status unavailable"),
    el("p", "note", `Unforged couldn't read this tab: ${message}.`),
  );
}

async function render(source: StateSource, root: HTMLElement): Promise<void> {
  const tabId = source.mock ? undefined : await activeTabId();
  const [state, summary] = await Promise.allSettled([source.getTabState(tabId), source.getSnapshotSummary()]);
  const snapshot = summary.status === "fulfilled" ? summary.value : undefined;

  if (state.status === "rejected") {
    showUnavailable(root, state.reason);
    root.append(syncLine(snapshot));
    return;
  }

  const { value } = state;
  root.replaceChildren(statusLine(value.verdict.level, statusLabel(value.verdict.level)), stateDetails(value, snapshot));
  if (value.blocked.length > 0) root.append(blockedFiles(value));
  if (value.configValues && Object.keys(value.configValues).length > 0) root.append(configValues(value.configValues));
  root.append(syncLine(snapshot));
}

async function main(): Promise<void> {
  const source = stateSource();
  const root = byId("app");
  try {
    await render(source, root);
  } catch (error) {
    showUnavailable(root, error);
  }
  if (source.mock) showMockNotice(root);
}

void main();
