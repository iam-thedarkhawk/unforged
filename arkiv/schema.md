# Arkiv schema

Unforged keeps two kinds of entity on Arkiv's Rabdi testnet (chain 7794095), written with `@arkiv-network/sdk` 1.0.1. The authoritative spec is [docs/formats.md](../docs/formats.md) §4; the code is [`packages/registry/src/arkiv.ts`](../packages/registry/src/arkiv.ts).

Shared by both kinds:

- `project = "unforged"` and `entity_type` are namespaces, not authentication. Anyone can write an entity with these values, so every read is scoped with `.createdBy(address)` to a key we already trust.
- **Who can edit:** nobody. Entities are created `readonly` with `permissionlessExtension: false`. A reader drops any entity whose `$creationFlags.readonly` is false, because a non-readonly entity could change after it was checked.
- **Owner:** the wallet that created it. For an attestation that is the builder; for a policy, the curator. The extension also requires the signature inside the payload to recover to that same owner.
- **Expiry:** `ExpirationTime.max()`, 7,884,000 blocks, about 182 days from inclusion, the longest Rabdi allows. See [how-you-use-arkiv.md](how-you-use-arkiv.md#expiry) for why that fits.
- **Payload:** a `bytes` column holding gzipped canonical JSON, with `content_type = "application/gzip"`. The CLI refuses a payload over 120 KB after gzip.

## `attestation`: one builder's signed rebuild of one release

Owner: a builder. One per builder per manifest root (`unforged publish` is idempotent).

| Field | Type | Indexed | Queried for | Value |
|---|---|---|---|---|
| `project` | str | yes | every read | `unforged` |
| `entity_type` | str | yes | every read | `attestation` |
| `dapp` | str | yes | extension sync: a builder's attestations for one dapp | `lido-staking-widget` |
| `release` | str | yes | people browsing the explorer | `0.161.0` |
| `commit` | str | yes | finding rebuilds of one commit | 40-hex git commit |
| `manifest_root` | str | yes | `publish`'s duplicate check; comparing builders | `13c7535a…26682` |
| `recipe_digest` | str | no | | sha256 of the recipe |
| `swarm_ref` | str | no | read with the row; drives **Open verified copy** | mirror folder, e.g. `lido-0.161.0`, or `none`. The name predates the switch from Swarm to a plain mirror |
| `content_type` | str | no | | `application/gzip` |
| `payload` | bytes | no | downloaded once per new entity | `{ attestation: SignedAttestation, manifest: Manifest }` |

The payload holds an in-toto Statement signed with EIP-191 over its canonical digest, and the full manifest (path → sha256 for every file). Lido's manifest is 8.7 KiB gzipped for 170 files.

## `policy`: the curator's rules for one dapp

Owner: the curator, `0x60422cB6937125250f829ed2d06B02AE2679dE09`, hardcoded in the extension.

| Field | Type | Indexed | Queried for | Value |
|---|---|---|---|---|
| `project` | str | yes | every read | `unforged` |
| `entity_type` | str | yes | every read | `policy` |
| `dapp` | str | yes | explorer browsing | `lido-staking-widget` |
| `version` | u64 | yes | the extension keeps the highest per dapp | `1`, `2`, … |
| `content_type` | str | no | | `application/gzip` |
| `payload` | bytes | no | | `{ policy, version, signature }` |

`policy` holds the dapp's origins, repo, allowlisted builders, threshold *k*, how many recent releases to accept, pinned third-party scripts, pinned config files and the mirror's base URL. The curator signs `{ policy, version }`. A row whose signature doesn't recover to the curator, whose creator isn't the curator, or whose signed version differs from its `version` attribute is dropped.

## The queries

Extension sync, every 10 minutes and on **Sync now**, keyless over the public RPC:

```js
// 1. All policies, from the curator only
client.select({ $key: true, $creator: true, $creationFlags: true, version: true, payload: true })
  .where([eq("project", "unforged"), eq("entity_type", "policy")])
  .createdBy(CURATOR).orderBy(asc("$key")).limit(100)

// 2. For each allowlisted builder of each policy: keys and attributes only
client.select({ $key: true, $creationFlags: true, swarm_ref: true })
  .where([eq("project", "unforged"), eq("entity_type", "attestation"), eq("dapp", policy.dapp)])
  .createdBy(builder).orderBy(asc("$key")).limit(100)

// 3. Payloads only for keys not already cached
client.getEntity(key)
```

Pages hold at most 100 rows, so both lists are walked by keyset (`gt("$key", last)`) with a page budget. Publishing checks for its own earlier attestation with `eq("manifest_root", root)` and `.createdBy(builder)`.

A runnable version: `node packages/registry/scripts/query-live.mjs lido-staking-widget`.
