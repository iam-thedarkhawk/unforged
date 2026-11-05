import { getAddress } from "viem";
import { sameAddress, verifyAttestation } from "./attestation.js";
import { manifestRoot } from "./hash.js";
import type { AcceptedRelease, AttestationEntry, CheckFileResult, Hex, Policy, Sha256 } from "./types.js";

/**
 * Releases the policy accepts: at least `threshold` distinct allowlisted builders
 * signed the same manifest root. Returns the newest `acceptLatest`, newest first.
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
    .map(([root, group]) => toRelease(root, group))
    .filter((release) => release.builders.length >= policy.threshold)
    .sort((x, y) => time(y.builtAt) - time(x.builtAt))
    .slice(0, policy.acceptLatest);
}

async function isValidEntry(policy: Policy, entry: AttestationEntry): Promise<boolean> {
  try {
    const { statement } = entry.attestation;
    return (
      policy.builders.some((b) => sameAddress(b, entry.creator)) &&
      entry.manifest.dapp === policy.dapp &&
      statement.predicate.repo === policy.repo &&
      (await verifyAttestation(entry.attestation, entry.creator)) &&
      (await manifestRoot(entry.manifest)) === statement.subject[0].digest.sha256
    );
  } catch {
    return false; // malformed entry
  }
}

function toRelease(root: Sha256, group: AttestationEntry[]): AcceptedRelease {
  const { manifest } = group[0]!;
  const builders = unique(group.map((e) => getAddress(e.creator))) as Hex[];
  const builtAt = group
    .map((e) => e.attestation.statement.predicate.builtAt)
    .reduce((newest, t) => (time(t) > time(newest) ? t : newest));
  const swarmRefs = unique(group.flatMap((e) => (e.swarmRef === null ? [] : [e.swarmRef])));
  return { dapp: manifest.dapp, release: manifest.release, commit: manifest.commit, manifestRoot: root, manifest, builders, builtAt, swarmRefs };
}

export function checkFile(release: AcceptedRelease, path: string, sha256: Sha256): CheckFileResult {
  const files = release.manifest.files;
  if (!Object.hasOwn(files, path)) return "unknown-file";
  return files[path] === sha256 ? "ok" : "hash-mismatch";
}

/** Unparseable timestamps sort as oldest. */
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
