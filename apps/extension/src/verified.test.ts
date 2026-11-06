import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sha256Hex, type AcceptedRelease, type Policy } from "@unforged/core";
import type { Snapshot } from "./decide.js";
import type { Site } from "./site.js";
import { BLOCKED_BODY_LIMIT, MAX_VERIFIED_BYTES, blockedBodyReply, fetchCapped, verifiedFile, type TabContext } from "./verified.js";

const ORIGIN = "http://localhost:8080";
const GATEWAY = "http://mirror.example.org/unforged-mirror/";
const encode = (text: string) => new TextEncoder().encode(text);
const GOOD = "const genuine = 1;\n";
const GOOD_HASH = await sha256Hex(encode(GOOD));

function release(name: string, swarmRefs: string[], files: Record<string, string>): AcceptedRelease {
  return {
    dapp: "demo",
    release: name,
    commit: "c".repeat(40),
    manifestRoot: name.padEnd(64, "0"),
    manifest: { version: 1, dapp: "demo", release: name, commit: "c".repeat(40), files, config: {} },
    builders: [],
    builtAt: "2026-11-01T00:00:00Z",
    swarmRefs,
  };
}

const FILES = { "/a.js": GOOD_HASH, "/index.html": GOOD_HASH, "/earn/index.html": GOOD_HASH };
const NEW = release("2.0.0", ["ref-new"], FILES);
const OLD = release("1.0.0", ["ref-old"], { "/a.js": "0".repeat(64) });

function snapshot(releases: AcceptedRelease[], gateway = GATEWAY): Snapshot {
  const policy: Policy = {
    dapp: "demo",
    origins: [ORIGIN],
    repo: "https://github.com/example/demo",
    builders: [],
    threshold: 1,
    acceptLatest: 3,
    thirdParty: {},
    recovery: { gateway },
  };
  return { syncedAt: null, dapps: { demo: { policy, releases, policyVersion: 1 } } };
}

const SITE: Site = { dapp: "demo", base: `${ORIGIN}/` };
const onSite: TabContext = { site: SITE };

/** A mirror that serves these URL -> body pairs and fails for anything else, and logs requests. */
function mirror(files: Record<string, string>) {
  const requested: string[] = [];
  const fetchBytes = async (url: string) => {
    requested.push(url);
    const body = files[url];
    if (body === undefined) throw new Error("mirror answered 404");
    return encode(body);
  };
  return { requested, fetchBytes };
}

describe("verifiedFile", () => {
  it("returns the mirror's body when its hash equals the manifest's", async () => {
    const { fetchBytes, requested } = mirror({ [`${GATEWAY}ref-new/a.js`]: GOOD });
    expect(await verifiedFile(snapshot([NEW]), onSite, `${ORIGIN}/a.js`, fetchBytes)).toEqual({ body: GOOD });
    expect(requested).toEqual([`${GATEWAY}ref-new/a.js`]);
  });

  it("refuses a mirror copy whose hash differs", async () => {
    const { fetchBytes } = mirror({ [`${GATEWAY}ref-new/a.js`]: "const tampered = 1;\n" });
    expect(await verifiedFile(snapshot([NEW]), onSite, `${ORIGIN}/a.js`, fetchBytes)).toEqual({ error: "mirror copy doesn't match" });
  });

  it("uses the tab's locked release over the newest", async () => {
    const { fetchBytes, requested } = mirror({ [`${GATEWAY}ref-old/a.js`]: GOOD });
    const reply = await verifiedFile(snapshot([NEW, OLD]), { site: SITE, lock: OLD }, `${ORIGIN}/a.js`, fetchBytes);
    expect(requested).toEqual([`${GATEWAY}ref-old/a.js`]);
    expect(reply).toEqual({ error: "mirror copy doesn't match" }); // checked against OLD's hash, not NEW's
  });

  it("uses a mirror site's own release over the newest", async () => {
    const site: Site = { dapp: "demo", base: `${GATEWAY}ref-old/`, mirror: OLD };
    const { fetchBytes, requested } = mirror({});
    await verifiedFile(snapshot([NEW, OLD]), { site }, `${GATEWAY}ref-old/a.js`, fetchBytes);
    expect(requested).toEqual([`${GATEWAY}ref-old/a.js`]);
  });

  it("maps URLs with the served-path rules", async () => {
    const start = mirror({ [`${GATEWAY}ref-new/index.html`]: GOOD });
    expect(await verifiedFile(snapshot([NEW]), onSite, `${ORIGIN}/?utm=1`, start.fetchBytes)).toEqual({ body: GOOD });
    const route = mirror({ [`${GATEWAY}ref-new/earn/index.html`]: GOOD });
    expect(await verifiedFile(snapshot([NEW]), onSite, `${ORIGIN}/earn`, route.fetchBytes)).toEqual({ body: GOOD });
  });

  it("tries the next ref after one fails", async () => {
    const twoRefs = release("2.0.0", ["ref-a", "ref-b"], FILES);
    const { fetchBytes } = mirror({ [`${GATEWAY}ref-b/a.js`]: GOOD });
    expect(await verifiedFile(snapshot([twoRefs]), onSite, `${ORIGIN}/a.js`, fetchBytes)).toEqual({ body: GOOD });
  });

  it("says when the file isn't in the release, without asking the mirror", async () => {
    const { fetchBytes, requested } = mirror({});
    for (const url of [`${ORIGIN}/extra.js`, "https://other.example.org/a.js", `${ORIGIN}/%E0%A4%A`]) {
      expect(await verifiedFile(snapshot([NEW]), onSite, url, fetchBytes)).toEqual({ error: "file not in the release" });
    }
    expect(requested).toEqual([]);
  });

  it("says when the release has no mirror", async () => {
    const { fetchBytes, requested } = mirror({});
    const noRefs = release("2.0.0", [], FILES);
    const url = `${ORIGIN}/a.js`;
    expect(await verifiedFile(snapshot([noRefs]), onSite, url, fetchBytes)).toEqual({ error: "no mirror for this release" });
    expect(await verifiedFile(snapshot([NEW], "TODO"), onSite, url, fetchBytes)).toEqual({ error: "no mirror for this release" });
    expect(await verifiedFile(snapshot([]), onSite, url, fetchBytes)).toEqual({ error: "no mirror for this release" });
    expect(requested).toEqual([]);
  });

  it("doesn't fall back to an older release's mirror", async () => {
    const { fetchBytes, requested } = mirror({});
    const reply = await verifiedFile(snapshot([release("2.0.0", [], FILES), OLD]), onSite, `${ORIGIN}/a.js`, fetchBytes);
    expect(reply).toEqual({ error: "no mirror for this release" });
    expect(requested).toEqual([]);
  });

  it("passes on a fetch error", async () => {
    const { fetchBytes } = mirror({});
    expect(await verifiedFile(snapshot([NEW]), onSite, `${ORIGIN}/a.js`, fetchBytes)).toEqual({
      error: "couldn't fetch the mirror copy: mirror answered 404",
    });
  });

  it("knows nothing about a tab without a site", async () => {
    const { fetchBytes } = mirror({});
    expect(await verifiedFile(snapshot([NEW]), {}, `${ORIGIN}/a.js`, fetchBytes)).toHaveProperty("error");
  });
});

describe("fetchCapped", () => {
  const serving = (response: Response) => async () => response;

  it("returns the whole body under the cap", async () => {
    const bytes = await fetchCapped("http://m/a.js", serving(new Response("hello")));
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });

  it("rejects an error status", async () => {
    await expect(fetchCapped("http://m/a.js", serving(new Response("nope", { status: 404 })))).rejects.toThrow("404");
  });

  it("rejects a body over the cap, even one with no declared length", async () => {
    const chunk = new Uint8Array(200 * 1024);
    let sent = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    await expect(fetchCapped("http://m/a.js", serving(new Response(endless)))).rejects.toThrow("500 KB");
    expect(sent).toBeLessThan(Math.ceil(MAX_VERIFIED_BYTES / chunk.length) + 3);
  });

  it("asks without cookies", async () => {
    let init: RequestInit | undefined;
    const spy = async (_url: string | URL | Request, options?: RequestInit) => {
      init = options;
      return new Response("x");
    };
    await fetchCapped("http://m/a.js", spy);
    expect(init?.credentials).toBe("omit");
  });
});

describe("blockedBodyReply", () => {
  it("keeps a body within the limit as text", () => {
    expect(blockedBodyReply(encode("evil()"))).toEqual({ body: "evil()" });
  });

  it("refuses a larger one: half a file would diff as false removals", () => {
    const reply = blockedBodyReply(new Uint8Array(BLOCKED_BODY_LIMIT + 1));
    expect(reply).toEqual({ error: expect.stringContaining("200 KB") });
  });
});

describe("manifest", () => {
  // Firefox's default MV3 CSP adds upgrade-insecure-requests, which rewrites a plain-HTTP mirror
  // fetch to https. Every byte is verified, so transport security isn't what protects the file.
  it("keeps scripts to the extension but doesn't upgrade mirror requests", () => {
    const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
    expect(manifest.content_security_policy.extension_pages).toBe("script-src 'self'");
  });
});
