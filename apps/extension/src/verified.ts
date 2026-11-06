// The two sides of the blocked page's diff. The verified side is decided here, in the background:
// a mirror is untrusted, so its copy is only handed over if its hash equals the attested manifest's.
import { sha256Hex, type AcceptedRelease } from "@unforged/core";
import { gatewayUrl } from "@unforged/registry";
import { resolvePath, type Snapshot } from "./decide.js";
import { mirrorBase, pathIn, type Site } from "./site.js";

export const MAX_VERIFIED_BYTES = 500 * 1024;
export const BLOCKED_BODY_LIMIT = 200 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export type FileReply = { body: string } | { error: string };

/** What the background knows about the tab asking. */
export interface TabContext {
  site?: Site | undefined;
  lock?: AcceptedRelease | undefined;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
type FetchBytes = (url: string) => Promise<Uint8Array>;

/** A body too large to keep whole gets an error: half a file would diff as false removals. */
export function blockedBodyReply(body: Uint8Array): FileReply {
  if (body.byteLength > BLOCKED_BODY_LIMIT) {
    return { error: `this file is over ${BLOCKED_BODY_LIMIT / 1024} KB, too large to compare here` };
  }
  return { body: new TextDecoder().decode(body) };
}

/** Reads a mirror file, stopping at the cap so a hostile mirror can't fill memory. */
export async function fetchCapped(url: string, fetchImpl: Fetch = fetch, limit: number = MAX_VERIFIED_BYTES): Promise<Uint8Array> {
  const response = await fetchImpl(url, { credentials: "omit", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`the mirror answered ${response.status}`);
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const out = new Uint8Array(limit);
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out.slice(0, length);
    if (length + value.byteLength > limit) {
      await reader.cancel();
      throw new Error(`the file is over ${limit / 1024} KB, too large to compare here`);
    }
    out.set(value, length);
    length += value.byteLength;
  }
}

/** The release a tab's files are held to, the same order as enforcement: lock, mirror folder, newest. */
function releaseOf(snapshot: Snapshot, { site, lock }: TabContext): AcceptedRelease | undefined {
  return lock ?? site?.mirror ?? (site && snapshot.dapps[site.dapp]?.releases[0]);
}

/** The manifest key of a URL in this site, if the release has that file. */
function manifestPath(site: Site, release: AcceptedRelease, url: string): string | undefined {
  const { files } = release.manifest;
  try {
    const inSite = pathIn(site, url);
    if (inSite === undefined) return undefined;
    const path = resolvePath(inSite, files);
    return Object.hasOwn(files, path) ? path : undefined;
  } catch {
    return undefined; // a URL that can't be decoded isn't a file of the release
  }
}

async function fetchVerified(gateway: string, ref: string, path: string, expected: string, fetchBytes: FetchBytes): Promise<FileReply> {
  try {
    const bytes = await fetchBytes(gatewayUrl(gateway, ref, path));
    if ((await sha256Hex(bytes)) !== expected) return { error: "mirror copy doesn't match" };
    return { body: new TextDecoder().decode(bytes) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { error: `couldn't fetch the mirror copy: ${reason}` };
  }
}

/** The verified copy of a URL from the release's mirror, trying each ref until one checks out. */
export async function verifiedFile(snapshot: Snapshot, tab: TabContext, url: string, fetchBytes: FetchBytes = fetchCapped): Promise<FileReply> {
  const { site } = tab;
  const entry = site && snapshot.dapps[site.dapp];
  if (!site || !entry) return { error: "this tab isn't on a dapp Unforged knows" };
  const gateway = entry.policy.recovery?.gateway;
  const release = releaseOf(snapshot, tab);
  const refs = release?.swarmRefs.filter((ref) => mirrorBase(gateway, ref) !== undefined) ?? [];
  if (!release || !gateway || refs.length === 0) return { error: "no mirror for this release" };
  const path = manifestPath(site, release, url);
  if (path === undefined) return { error: "file not in the release" };
  let reply: FileReply = { error: "no mirror for this release" };
  for (const ref of refs) {
    reply = await fetchVerified(gateway, ref, path, release.manifest.files[path]!, fetchBytes);
    if ("body" in reply) return reply;
  }
  return reply;
}
