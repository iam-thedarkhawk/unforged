// The UI's only way to get state: the background's messages, or fixtures under ?mock=<level>.
import type { TabState } from "@unforged/core";
import type { SyncSummary } from "../summary.js";
import type { FileReply } from "../verified.js";
import { parseMock } from "./format.js";
import { MOCK_BODIES, MOCK_STATES, mockSummary } from "./mock.js";

export interface StateSource {
  mock: boolean;
  getTabState(tabId: number | undefined): Promise<TabState>;
  getSnapshotSummary(): Promise<SyncSummary>;
  openVerifiedCopy(tabId: number | undefined): Promise<unknown>;
  getBlockedBody(tabId: number | undefined, url: string): Promise<FileReply>;
  /** The mirror's copy of a file, only if the background checked it against the manifest. */
  getVerifiedFile(tabId: number | undefined, url: string): Promise<FileReply>;
  /** Asks the background to sync now. Resolves when it finished, or with why it didn't run. */
  syncNow(): Promise<{ ok: true } | { error: string }>;
}

function requireTabId(tabId: number | undefined): number {
  if (tabId === undefined) throw new Error("no tab to read");
  return tabId;
}

async function askForFile(type: "getBlockedBody" | "getVerifiedFile", tabId: number | undefined, url: string): Promise<FileReply> {
  const reply = (await browser.runtime.sendMessage({ type, tabId: requireTabId(tabId), url })) as FileReply | undefined;
  return reply ?? { error: "the background did not answer" };
}

// A background that doesn't answer resolves to undefined, which must not read as a state.
const background: StateSource = {
  mock: false,
  async getTabState(tabId) {
    const state = (await browser.runtime.sendMessage({ type: "getTabState", tabId: requireTabId(tabId) })) as
      | TabState
      | undefined;
    if (!state?.verdict) throw new Error("the background did not report this tab");
    return state;
  },
  async getSnapshotSummary() {
    const summary = (await browser.runtime.sendMessage({ type: "getSnapshotSummary" })) as SyncSummary | undefined;
    if (!summary?.dapps) throw new Error("the background did not report a snapshot");
    return summary;
  },
  openVerifiedCopy(tabId) {
    return browser.runtime.sendMessage({ type: "openVerifiedCopy", tabId: requireTabId(tabId) });
  },
  getBlockedBody: (tabId, url) => askForFile("getBlockedBody", tabId, url),
  getVerifiedFile: (tabId, url) => askForFile("getVerifiedFile", tabId, url),
  async syncNow() {
    const reply = (await browser.runtime.sendMessage({ type: "syncNow" })) as { ok: true } | { error: string } | undefined;
    return reply ?? { error: "the background did not answer" };
  },
};

export function stateSource(search: string = location.search): StateSource {
  const level = parseMock(search);
  if (!level) return background;
  return {
    mock: true,
    getTabState: async () => MOCK_STATES[level],
    getSnapshotSummary: async () => mockSummary(),
    openVerifiedCopy: async () => {
      throw new Error("nothing to open in mock mode");
    },
    getBlockedBody: async () => ({ body: MOCK_BODIES.served }),
    getVerifiedFile: async () => ({ body: MOCK_BODIES.verified }),
    syncNow: async () => ({ error: "no sync in mock mode" }),
  };
}
