import { getAddress } from "viem";
import { sameAddress, verifyAttestation } from "./attestation.js";
import { manifestRoot } from "./hash.js";
import type { AcceptedRelease, AttestationEntry, CheckFileResult, Hex, Policy, Sha256 } from "./types.js";

/**
 * Releases the policy accepts: at least `threshold` distinct allowlisted builders
 * signed the same manifest root. Returns the newest `acceptLatest`, newest first.
 * A release's builtAt is the threshold-th newest among its signers, so one builder
 * claiming a future time cannot move a release ahead on their own.
 */
export async function acceptReleases(policy: Policy, entries: AttestationEntry[]): Promise<AcceptedRelease[]> {
  if (!isPositiveInteger(policy.threshold) || !isPositiveInteger(policy.acceptLatest)) return [];

  const byRoot = new Map<Sha256, AttestationEntry[]>();
  for (const entry of entries) {
    if (!(await isValidEntry(policy, entry))) continue;
    const root = entry.attestation.statement.subject[0].digest.sha256;
    byRoot.set(root, [...(byRoot.get(root) ?? []), entry]);
  }

  return [...byRoot]
    .map(([root, group]) => toRelease(root, group, policy.threshold))
    .filter((release) => release.builders.length >= policy.threshold)
    .sort((x, y) => time(y.builtAt) - time(x.builtAt))
    .slice(0, policy.acceptLatest);
}

async function isValidEntry(policy: Policy, entry: AttestationEntry): Promise<boolean> {
  try {
    const { statement } = entry.attestation;
    const { manifest } = entry;
    return (
      policy.builders.some((b) => sameAddress(b, entry.creator)) &&
      manifest.dapp === policy.dapp &&
      statement.predicate.repo === policy.repo &&
      statement.predicate.commit === manifest.commit &&
      statement.subject[0].name === `${manifest.dapp}@${manifest.release}` &&
      !Number.isNaN(Date.parse(statement.predicate.builtAt)) &&
      (await verifyAttestation(entry.attestation, entry.creator)) &&
      (await manifestRoot(entry.manifest)) === statement.subject[0].digest.sha256
    );
  } catch {
    return false; // malformed entry
  }
}

function toRelease(root: Sha256, group: AttestationEntry[], threshold: number): AcceptedRelease {
  const { manifest } = group[0]!;
  const builders = unique(group.map((e) => getAddress(e.creator))) as Hex[];
  const builtAt = thresholdBuiltAt(group, threshold);
  const swarmRefs = unique(group.flatMap((e) => (e.swarmRef === null ? [] : [e.swarmRef])));
  return { dapp: manifest.dapp, release: manifest.release, commit: manifest.commit, manifestRoot: root, manifest, builders, builtAt, swarmRefs };
}

/**
 * Each signer's newest builtAt, sorted newest first; the threshold-th one.
 * Empty when there are fewer signers than threshold (the caller then drops the release).
 */
function thresholdBuiltAt(group: AttestationEntry[], threshold: number): string {
  const newestBySigner = new Map<string, string>();
  for (const e of group) {
    const signer = getAddress(e.creator);
    const t = e.attestation.statement.predicate.builtAt;
    const prev = newestBySigner.get(signer);
    if (prev === undefined || time(t) > time(prev)) newestBySigner.set(signer, t);
  }
  const sorted = [...newestBySigner.values()].sort((x, y) => time(y) - time(x));
  return sorted[threshold - 1] ?? "";
}

export function checkFile(release: AcceptedRelease, path: string, sha256: Sha256): CheckFileResult {
  const files = release.manifest.files;
  if (!Object.hasOwn(files, path)) return "unknown-file";
  return files[path] === sha256 ? "ok" : "hash-mismatch";
}

/** Entries with unparseable builtAt are dropped earlier; this is a fallback. */
function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? -Infinity : t;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isPositiveInteger(n: number): boolean {
  return Number.isInteger(n) && n >= 1;
}
