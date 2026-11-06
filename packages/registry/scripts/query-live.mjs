// Reads Unforged's live data from Arkiv Rabdi the way the extension does, and prints what it accepts.
// Keyless: it uses the public RPC, like the extension. Needs `pnpm i && pnpm -r build` first.
//
//   node packages/registry/scripts/query-live.mjs [dapp]
//
// 1. One raw query: every attestation for the dapp, with its creator and indexed attributes.
// 2. The curator's signed policy (signature, creator and version checked by fetchPolicies).
// 3. Each allowlisted builder's attestations, then acceptReleases: the k-of-n verdict the popup shows.
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { asc, eq } from "@arkiv-network/sdk/query";
import { http } from "viem";
import { acceptReleases } from "@unforged/core";
import { fetchAttestations, fetchPolicies } from "../dist/index.js";

const CURATOR = "0x60422cB6937125250f829ed2d06B02AE2679dE09"; // apps/extension/src/config.ts
const dapp = process.argv[2] ?? "lido-staking-widget";

const client = createPublicClient({ chain: rabdi({ accessKey: "" }), transport: http() });

console.log(`# 1. Raw query: attestations for ${dapp} (anyone can write these; step 3 decides which count)`);
const { entities } = await client
  .select({ $key: true, $creator: true, release: true, commit: true, manifest_root: true, swarm_ref: true })
  .where([eq("project", "unforged"), eq("entity_type", "attestation"), eq("dapp", dapp)])
  .orderBy(asc("$key"))
  .limit(100)
  .fetch();
for (const e of entities) {
  console.log(`${e.$key}  creator ${e.$creator}  release ${e.release?.value}  root ${e.manifest_root?.value}  mirror ${e.swarm_ref?.value}`);
}

console.log(`\n# 2. Policies signed by the curator ${CURATOR}`);
const policies = await fetchPolicies({ accessKey: "" }, CURATOR);
const current = policies.find((p) => p.policy.dapp === dapp);
if (!current) {
  console.log("no valid policy for this dapp");
  process.exit(1);
}
const { policy, version } = current;
console.log(`version ${version}: ${policy.threshold} of ${policy.builders.length} builders [${policy.builders.join(", ")}], origins ${policy.origins.join(", ")}`);

console.log("\n# 3. Accepted releases (what the extension enforces)");
const entries = [];
for (const builder of policy.builders) {
  const found = await fetchAttestations({ accessKey: "" }, builder, dapp);
  console.log(`builder ${builder}: ${found.length} attestation(s)`);
  entries.push(...found);
}
const accepted = await acceptReleases(policy, entries);
if (accepted.length === 0) console.log(`none yet: no release has ${policy.threshold} matching builders`);
for (const r of accepted) {
  console.log(`🟢 ${r.dapp}@${r.release} commit ${r.commit.slice(0, 7)} root ${r.manifestRoot}`);
  console.log(`   ${r.builders.length} of ${policy.builders.length} builders: ${r.builders.join(", ")}; ${Object.keys(r.manifest.files).length} files; mirror ${r.swarmRefs.join(", ") || "none"}`);
}
