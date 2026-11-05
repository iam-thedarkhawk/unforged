import { describe, expect, it } from "vitest";
import { isBlockedPage, keepsTabState, showsBlockedPage } from "./navigation.js";

const POLICY = ["http://localhost:8080"];
const BLOCKED = "moz-extension://abc/blocked.html";

describe("keepsTabState", () => {
  it("keeps the state on a policy origin, including a different path", () => {
    expect(keepsTabState("http://localhost:8080/", POLICY, BLOCKED)).toBe(true);
    expect(keepsTabState("http://localhost:8080/wrap#x", POLICY, BLOCKED)).toBe(true);
  });

  it("keeps the state on our own blocked page", () => {
    expect(keepsTabState(`${BLOCKED}?tab=3`, POLICY, BLOCKED)).toBe(true);
  });

  it.each([
    "about:blank",
    "about:home",
    "about:newtab",
    "file:///home/me/a.html",
    "moz-extension://abc/popup.html",
    "moz-extension://other/blocked.html",
    "moz-extension://abc/blocked.html.evil",
    "https://example.com/",
    "http://localhost:9090/",
    "https://localhost:8080/",
    "http://localhost:8080@example.com/",
    "not a url",
  ])("resets on %s", (url) => {
    expect(keepsTabState(url, POLICY, BLOCKED)).toBe(false);
  });
});

describe("isBlockedPage", () => {
  it("matches only our page, with or without a query or fragment", () => {
    expect(isBlockedPage(BLOCKED, BLOCKED)).toBe(true);
    expect(isBlockedPage(`${BLOCKED}?tab=3`, BLOCKED)).toBe(true);
    expect(isBlockedPage(`${BLOCKED}#x`, BLOCKED)).toBe(true);
    expect(isBlockedPage(`${BLOCKED}x`, BLOCKED)).toBe(false);
    expect(isBlockedPage("about:blank", BLOCKED)).toBe(false);
  });
});

describe("showsBlockedPage", () => {
  it.each(["main_frame", "sub_frame", "script", "stylesheet", "worker"])("sends the tab there for a blocked %s", (type) => {
    expect(showsBlockedPage(type)).toBe(true);
  });

  it("does not for a blocked xmlhttprequest, which the page can survive", () => {
    expect(showsBlockedPage("xmlhttprequest")).toBe(false);
  });
});
