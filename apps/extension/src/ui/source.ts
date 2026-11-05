// The UI's only way to get state: the background's messages, or fixtures under ?mock=<level>.
import type { SnapshotSummary, TabState } from "@unforged/core";
import { parseMock } from "./format.js";
import { MOCK_STATES, mockSummary } from "./mock.js";

export interface StateSource {
  mock: boolean;
  getTabState(tabId: number | undefined): Promise<TabState>;
  getSnapshotSummary(): Promise<SnapshotSummary>;
  openVerifiedCopy(tabId: number | undefined): Promise<unknown>;
}

function requireTabId(tabId: number | undefined): number {
  if (tabId === undefined) throw new Error("no tab to read");
  return tabId;
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
    const summary = (await browser.runtime.sendMessage({ type: "getSnapshotSummary" })) as SnapshotSummary | undefined;
    if (!summary?.dapps) throw new Error("the background did not report a snapshot");
    return summary;
  },
  openVerifiedCopy(tabId) {
    return browser.runtime.sendMessage({ type: "openVerifiedCopy", tabId: requireTabId(tabId) });
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
  };
}
