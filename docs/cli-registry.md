# CLI rebuilder, registry and GitHub Action (owner: Varun)

## CLI: `unforged`

| Command | Does |
|---|---|
| `unforged build <recipe.yaml>` | Clone `repo` at `commit` (shallow) into `recipe.buildPath`, write `files`, write `env` to `envFile`, run `install` then `build` using the pinned Node, then hash `output` into a Manifest (config files go to `manifest.config`, not `files`). Writes `manifest.json` and prints `manifestRoot` |
| `unforged attest <manifest.json> <recipe.yaml>` | Build the Statement, sign the digest with `BUILDER_PRIVATE_KEY` (env var, never logged), write `attestation.json` |
| `unforged publish <attestation.json> <manifest.json> [--out-dir <dir>]` | Optionally upload `out-dir` to Swarm (gets `swarm_ref`), then create the Arkiv `attestation` entity. Idempotent: if an entity with the same `manifest_root` already exists for this creator, print it and exit 0 |
| `unforged policy <policy.json>` | Curator only. Create a `policy` entity with `version = previous + 1` |
| `unforged verify <url>` | Debug helper: fetch a live site's files listed in the accepted manifest and report matches. Not used by the extension |

Pinned Node: the CLI checks `node --version` against `recipe.node` and refuses to build on a mismatch, unless `--allow-node-mismatch` is given (recorded in `predicate.toolchain`).

Exit codes: 0 ok, 2 build failed, 3 nondeterminism detected (`--check` builds twice and compares), 4 registry error.

Known nondeterminism: Lido's Next.js 12 build sometimes writes `_buildManifest.js` with two minified parameter names swapped (2 of 12 builds in our study). The code is equivalent but the hash differs. If `--check` reports only that file, rebuild. With 3 builders and threshold 2, at least two always agree, because there are only two forms.

## Registry package (`packages/registry`)

Two entry points, because the extension bundles this package and must not pull in Node code:
- `@unforged/registry` (browser-safe, used by the extension and CLI): Arkiv functions + `gatewayUrl`.
- `@unforged/registry/swarm` (Node only, used by the CLI): `uploadDir`.

```ts
// Arkiv (SDK @arkiv-network/sdk >=0.8.1 <0.9, chain: tiramisu, id 7738577)
publishAttestation(walletClient, payload: { attestation, manifest }, attrs): Promise<{ entityKey, txHash }>
publishPolicy(walletClient, policy, version): Promise<{ entityKey, txHash }>
fetchPolicies(publicClient, curator): Promise<{ version: number; policy: Policy }[]>
fetchAttestations(publicClient, builder, dapp, skipKeys?: Set<string>): Promise<{ entityKey, creator, attestation, manifest, swarmRef }[]>
  // lists keys + attributes first, then fetches payloads only for keys not in skipKeys (incremental sync)
gatewayUrl(gateway, ref, path): string
// Swarm (@ethersphere/bee-js), Node only
uploadDir(beeUrl, batchId, dir): Promise<string /* swarm ref */>
```
Gzip with `fflate` (works in both Node and the browser).
SDK facts that save research time:
- Write: `createWalletClient({ chain: tiramisu, account, transport: http() })`, then `walletClient.createEntity({ payload, contentType, attributes: {...}, expires: ExpirationTime.fromDays(365), flags: { readonly: true, permissionlessExtension: false } })`. It returns `{ entityKey, txHash, expiresAt }`. Check the receipt.
- Read: `publicClient.select({ key: true, payload: true, attributes: true }).where(eq("project","unforged"), eq("entity_type","attestation"), eq("dapp", d)).createdBy(addr).limit(200).fetch()`. Pages hold at most 200; loop with `hasNextPage()` / `next()`.
- Imports: `createPublicClient, createWalletClient, ExpirationTime` from `@arkiv-network/sdk`; `eq` from `@arkiv-network/sdk/query`; `tiramisu` from `@arkiv-network/sdk/chains`; `u64` from `@arkiv-network/sdk/attr`.
- Limits: payload ≤128 KiB, string attribute ≤128 bytes, ≤30 user attributes, lowercase `snake_case` names. Gas is paid in test GLM (Hub faucet).
- Install Arkiv's agent skills for Claude Code before starting: `npx skills add https://github.com/arkiv-network/skills`.
- Swarm: `new Bee(url).uploadFilesFromDirectory(batchId, dir, { indexDocument: "index.html" })` returns `reference.toHex()`. Needs a Bee node with a postage batch. Get the event setup from Swarm's team (pre-event task).

## GitHub Action (`action/action.yml`, composite)

Inputs: `recipe` (path), `arkiv-rpc` (optional), `bee-url`, `postage-batch` (optional). Secret: `BUILDER_PRIVATE_KEY`. Steps: setup-node with `recipe.node` → `unforged build` → `unforged attest` → `unforged publish`. Outputs `manifest-root`, `entity-key`, `swarm-ref`.

Independence rule (README): builders run this Action in **their own** GitHub organisations with their own keys. The dapp team's own CI produces at most a vendor attestation, never an independent one.

## Supported dapps for the demo

| Dapp | Release | Status from our study |
|---|---|---|
| Lido staking widget | 0.161.0 (`e256fd6`) | 170/170 identical. **Demo target** |
| ENS app | pin a commit at the event | 1,380/1,380 identical |
| Curve | pin a commit at the event | 810/810 identical |
| Uniswap web | main at `bdbace6` (22 Oct); pin a `web/*` release tag at the event | 1,457/1,457 identical with one recipe patch (`files` overrides `tsconfig.json` to drop 6 references to unpublished projects, see `study/harness/uni_patch.py`). Node exactly 22.23.4, Bun |
| Aave | pin a release tag | identical at a fixed `buildPath`, but only with a `generateBuildId` patch, so its live site can't match until Aave adopts that line |
| Safe{Wallet} | latest `web-v*` tag | needs a 16 GB machine. Vendor-attested only (stretch) |
