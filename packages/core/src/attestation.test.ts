import { describe, expect, it } from "vitest";
import { manifestRoot, recipeDigest, verifyAttestation } from "./index.js";
import { attest, manifest, newBuilder, recipe, REPO } from "./fixtures.test-helpers.js";

describe("buildStatement", () => {
  it("binds the manifest root, repo and recipe digest", async () => {
    const b = newBuilder();
    const m = manifest();
    const { attestation } = await attest(b, m);
    const s = attestation.statement;
    expect(s.subject[0]).toEqual({ name: "lido-staking-widget@0.161.0", digest: { sha256: await manifestRoot(m) } });
    expect(s.predicate.repo).toBe(REPO);
    expect(s.predicate.recipeDigest).toBe(await recipeDigest(recipe()));
    expect(s.predicate.builder).toBe(b.address);
  });
});

describe("verifyAttestation", () => {
  it("accepts a statement signed by its builder and creator", async () => {
    const b = newBuilder();
    const { attestation } = await attest(b, manifest());
    expect(await verifyAttestation(attestation, b.address)).toBe(true);
    expect(await verifyAttestation(attestation, b.address.toLowerCase() as `0x${string}`)).toBe(true);
  });

  it("rejects when the creator is not the signer", async () => {
    const { attestation } = await attest(newBuilder(), manifest());
    expect(await verifyAttestation(attestation, newBuilder().address)).toBe(false);
  });

  it("rejects when predicate.builder is not the signer", async () => {
    const signer = newBuilder();
    const { attestation } = await attest(signer, manifest());
    const other = newBuilder().address;
    const forged = { ...attestation, statement: { ...attestation.statement, predicate: { ...attestation.statement.predicate, builder: other } } };
    expect(await verifyAttestation(forged, other)).toBe(false);
  });

  it("rejects a tampered statement", async () => {
    const b = newBuilder();
    const { attestation } = await attest(b, manifest());
    const tampered = { ...attestation, statement: { ...attestation.statement, subject: [{ name: "x@1", digest: { sha256: "00".repeat(32) } }] as typeof attestation.statement.subject } };
    expect(await verifyAttestation(tampered, b.address)).toBe(false);
  });

  it("returns false for a malformed signature instead of throwing", async () => {
    const b = newBuilder();
    const { attestation } = await attest(b, manifest());
    expect(await verifyAttestation({ ...attestation, signature: "0x1234" }, b.address)).toBe(false);
  });
});
