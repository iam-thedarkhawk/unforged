import { describe, expect, it } from "vitest";
import { acceptReleases, checkFile, manifestRoot } from "./index.js";
import { attest, manifest, newBuilder, policy } from "./fixtures.test-helpers.js";

const [a, b, c] = [newBuilder(), newBuilder(), newBuilder()];
const p = policy([a, b, c]);

describe("acceptReleases", () => {
  it("accepts a root signed by 2 of 3 builders", async () => {
    const m = manifest();
    const out = await acceptReleases(p, [
      await attest(a, m, { builtAt: "2026-11-01T00:00:00Z", swarmRef: null }),
      await attest(b, m, { builtAt: "2026-11-02T00:00:00Z" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      dapp: "lido-staking-widget",
      release: "0.161.0",
      commit: m.commit,
      manifestRoot: await manifestRoot(m),
      manifest: m,
      builtAt: "2026-11-02T00:00:00Z",
      swarmRefs: ["ab".repeat(32)],
    });
    expect(new Set(out[0]!.builders)).toEqual(new Set([a.address, b.address]));
  });

  it("rejects a root signed by 1 of 3", async () => {
    expect(await acceptReleases(p, [await attest(a, manifest())])).toEqual([]);
  });

  it("counts the same builder twice once", async () => {
    const m = manifest();
    expect(await acceptReleases(p, [await attest(a, m), await attest(a, m)])).toEqual([]);
  });

  it("ignores a builder not on the allowlist", async () => {
    const m = manifest();
    expect(await acceptReleases(p, [await attest(a, m), await attest(newBuilder(), m)])).toEqual([]);
  });

  it("drops an entry whose manifest does not hash to the signed root", async () => {
    const m = manifest();
    const bad = { ...(await attest(b, m)), manifest: manifest("0.161.0", { "/evil.js": "ee".repeat(32) }) };
    expect(await acceptReleases(p, [await attest(a, m), bad])).toEqual([]);
  });

  it("drops an entry for the wrong repo", async () => {
    const m = manifest();
    const wrong = await attest(b, m, { repo: "https://github.com/evil/fork" });
    expect(await acceptReleases(p, [await attest(a, m), wrong])).toEqual([]);
  });

  it("drops an entry for another dapp", async () => {
    const m = { ...manifest(), dapp: "other" };
    expect(await acceptReleases(p, [await attest(a, m), await attest(b, m)])).toEqual([]);
  });

  it("keeps only the newest release when acceptLatest is 1", async () => {
    const old = manifest("0.160.0");
    const neu = manifest("0.161.0");
    const entries = [
      await attest(a, old, { builtAt: "2026-10-01T00:00:00Z" }),
      await attest(b, old, { builtAt: "2026-10-01T00:00:00Z" }),
      await attest(a, neu, { builtAt: "2026-11-01T00:00:00Z" }),
      await attest(c, neu, { builtAt: "2026-11-01T00:00:00Z" }),
    ];
    expect((await acceptReleases(p, entries)).map((r) => r.release)).toEqual(["0.161.0", "0.160.0"]);
    const latest = await acceptReleases({ ...p, acceptLatest: 1 }, entries);
    expect(latest.map((r) => r.release)).toEqual(["0.161.0"]);
  });
});

describe("checkFile", () => {
  it("classifies files against the accepted manifest", async () => {
    const m = manifest();
    const [release] = await acceptReleases(p, [await attest(a, m), await attest(b, m)]);
    expect(checkFile(release!, "/index.html", "aa".repeat(32))).toBe("ok");
    expect(checkFile(release!, "/other.js", "aa".repeat(32))).toBe("unknown-file");
    expect(checkFile(release!, "/index.html", "cc".repeat(32))).toBe("hash-mismatch");
  });
});
