# How we use Arkiv

Arkiv is Unforged's registry: builders write attestations to it, the curator writes policies to it, and every user's extension reads both directly from it. There is no Unforged server. Entities and fields are in [schema.md](schema.md).

## Do the filters fit what the app does?

The extension's whole read path is three filters, and each one is a trust decision, not a convenience:

| Filter | Why | What breaks without it |
|---|---|---|
| `.createdBy(curator)` on policies | Only the hardcoded curator decides which builders count for a dapp | Anyone could publish a policy listing their own builders |
| `.createdBy(builder)` on attestations, once per allowlisted builder | An attestation counts only from a key the policy names | Anyone could flood the registry with attestations for a fake build |
| `eq("dapp", …)` | Sync fetches only dapps that have a policy | Every sync would scan every attestation ever written |

Two more indexed fields are used by tools rather than the extension: `manifest_root` (the CLI checks whether this builder already attested this exact build before spending gas again) and `release` / `commit` (finding every rebuild of one release in the explorer). `version` is indexed so the newest policy can be found. We indexed everything worth querying when we first wrote, because a readonly entity can never gain an index later.

`project` and `entity_type` narrow every query too, but we treat them as namespaces only: anyone can write `project = "unforged"`.

## Who can edit each entity?

Nobody, including its owner. Every entity is created `readonly`, with `permissionlessExtension: false`, and the extension ignores any entity that isn't readonly.

That is the point of an attestation: a builder's statement "commit e256fd6 builds to root 13c7535a…" must not change after other builders and users have relied on it. If a builder's key leaks, the fix is a new policy version that drops the builder, not editing history. A policy changes the same way: the curator publishes version *n*+1, signed, and the extension uses the highest valid version.

Ownership does real work. The entity's `$creator` must equal the address recovered from the signature inside the payload. Arkiv tells us who wrote the row, the signature tells us who vouched for its content, and the two must agree.

## Expiry

Everything is created with `ExpirationTime.max()`: 7,884,000 blocks, about 182 days, the longest Rabdi allows.

That fits attestations well. A policy accepts only the newest few releases (`acceptLatest: 3` for Lido), and Lido shipped 64 releases in the last 12 months, so an attestation stops mattering within weeks; after 182 days the registry cleans up after itself. For policies it's a real constraint: a policy that should outlive 182 days has to be extended (`extendEntity`, which the owner can still do on a readonly entity) or republished. We haven't automated that yet. If a policy expired, the next sync would drop its dapp and its origins would go back to unchecked. Extending live policies before expiry is the next thing to automate.

## Does each Arkiv feature change something users see?

| Arkiv feature | What the user sees |
|---|---|
| Querying attestations by creator | The popup's **Builders: 2 of 2** with each builder's address. A release goes green only when *k* distinct creators attested the same root |
| Querying the curator's policies | Which sites are protected at all, and the threshold behind the amber **Waiting for independent builders** state when fewer than *k* have attested |
| Indexed `dapp` | Sync downloads only dapps that have a policy, so a first sync stays small (about 1.5 MB for five dapps, three builders and three releases each) |
| The payload (manifest) | **Files checked**, and every block: a file whose hash isn't in an attested manifest is blocked before it runs |
| Readonly entities | A verdict can't be changed after the fact by editing the entity behind it |
| `swarm_ref` (the mirror folder) | The **Open verified copy** button on the blocked page, and the diff of the blocked file against the genuine one |
| Policy `version` | Fixing a policy (adding a builder, re-pinning config) takes effect at the next sync, without an extension update |
| Keyless public reads | Nothing to configure: the extension works without an account, key or server of ours |

Writes happen in the CLI (`unforged publish`, `unforged policy`) and the GitHub Action, so they're re-runnable by anyone with a funded key.
