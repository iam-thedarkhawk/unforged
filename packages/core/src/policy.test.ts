import { describe, expect, it } from "vitest";
import { acceptReleases, checkFile, manifestRoot, statementDigest } from "./index.js";
import { attest, manifest, newBuilder, policy, type Builder } from "./fixtures.test-helpers.js";
import type { AttestationEntry, Statement } from "./types.js";

const [a, b, c] = [newBuilder(), newBuilder(), newBuilder()];
const p = policy([a, b, c]);

/** Edits a signed statement and signs it again, so only the edit is wrong. */
async function resign(builder: Builder, entry: AttestationEntry, edit: (s: Statement) => void): Promise<AttestationEntry> {
  const statement = structuredClone(entry.attestation.statement);
  edit(statement);
  const signature = await builder.signMessage({ message: { raw: await statementDigest(statement) } });
  return { ...entry, attestation: { statement, signature } };
}

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
      builtAt: "2026-11-01T00:00:00Z", // 2nd newest: threshold is 2
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

  it("drops an entry whose commit differs from the manifest", async () => {
    const m = manifest();
    const wrong = await resign(b, await attest(b, m), (s) => (s.predicate.commit = "0".repeat(40)));
    expect(await acceptReleases(p, [await attest(a, m), wrong])).toEqual([]);
  });

  it("drops an entry whose subject name differs from the manifest", async () => {
    const m = manifest();
    const wrong = await resign(b, await attest(b, m), (s) => (s.subject[0]!.name = "lido-staking-widget@9.9.9"));
    expect(await acceptReleases(p, [await attest(a, m), wrong])).toEqual([]);
  });

  it("drops an entry whose builtAt is not a date", async () => {
    const m = manifest();
    const bad = await attest(b, m, { builtAt: "yesterday" });
    expect(await acceptReleases(p, [await attest(a, m), bad])).toEqual([]);
  });

  it("does not let one builder move an old release ahead with a future builtAt", async () => {
    const x = manifest("0.161.0");
    const y = manifest("0.160.0");
    const entries = [
      await attest(a, x, { builtAt: "2026-11-01T00:00:00Z" }),
      await attest(b, x, { builtAt: "2026-11-02T00:00:00Z" }),
      await attest(a, y, { builtAt: "2099-01-01T00:00:00Z" }),
      await attest(c, y, { builtAt: "2026-10-01T00:00:00Z" }),
    ];
    const out = await acceptReleases({ ...p, acceptLatest: 1 }, entries);
    expect(out.map((r) => [r.release, r.builtAt])).toEqual([["0.161.0", "2026-11-01T00:00:00Z"]]);
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
