// Pure rules for what a top-level navigation does to a tab's state, and when a block takes the
// tab to the blocked page. No browser APIs here, so they are unit-tested directly.
import { originOf } from "./classify.js";

const BLOCKED_PAGE_TYPES = new Set(["main_frame", "sub_frame", "script", "stylesheet", "worker"]);

export function isBlockedPage(url: string, blockedPageUrl: string): boolean {
  return url.split(/[?#]/, 1)[0] === blockedPageUrl;
}

/** A verdict stays valid on its policy origin and on the page explaining it; anywhere else it's stale. */
export function keepsTabState(url: string, policyOrigins: readonly string[], blockedPageUrl: string): boolean {
  if (isBlockedPage(url, blockedPageUrl)) return true;
  const origin = originOf(url);
  return origin !== undefined && policyOrigins.includes(origin);
}

/** Whether blocking a request of this type leaves the page too broken to stay on. */
export function showsBlockedPage(requestType: string): boolean {
  return BLOCKED_PAGE_TYPES.has(requestType);
}
