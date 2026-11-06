# Why Arkiv

Unforged exists to remove one kind of trust: trusting a single company's servers to deliver the code it published. A registry run on our own database would bring that trust straight back, just pointed at us.

## If we swapped Arkiv for Postgres, what would users lose?

- **Independence from us.** With a database we run, we could delete a builder's attestation, add a fake one, or show different users different data, and nobody could tell. On Arkiv, an attestation's owner is the builder's own wallet, it's readonly, and the extension checks that the signature inside matches that owner. We can't edit or forge what a builder said.
- **Permissionless builders.** Anyone with a funded key can rebuild Lido and publish an attestation, today, without an account with us: fork the repo and run the GitHub Action. Whether it counts is up to the dapp's policy, but publishing doesn't need our permission. Our second builder did exactly this from a GitHub Actions run.
- **A protection that outlives us.** If the Unforged team disappears, every policy and attestation stays readable on Arkiv until it expires, and installed extensions keep syncing and enforcing them. With Postgres, users would be protected only as long as we pay for a server.
- **Public, checkable evidence.** Anyone can see in the [explorer](https://rabdi.explorer.arkiv.network/address/0x9125c7F8A2001c3f0C902f4eEAEFC414Db339ACD) who attested which build, with which manifest root, and when. A judge, a dapp team or a journalist can check a verdict without asking us.
- **Privacy without our server.** The extension reads Arkiv directly over the public RPC and syncs everything in bulk. With our own API, every user's sync would come to us, and per-dapp lookups would tell us who uses which dapp.
- **Queries we didn't have to build.** Filtering by creator, dapp and manifest root, with ownership and expiry built in, is exactly what sync needs. On Postgres we'd also be writing and running the API, authentication and access control around it.

We don't trust Arkiv blindly either. Policies and attestations are signed inside their payloads, so a lying RPC can't forge or relabel them. It can withhold newer entities, which we list as a known gap in the [threat model](../docs/threat-model.md#gaps-outside-this-ranking).

## What we kept off Arkiv, and why

| Kept off | Where it lives | Why |
|---|---|---|
| The build output itself (Lido is 170 files, and its start page alone loads 5.8 MB) | A static mirror, [`http://intelears.me/unforged-mirror/`](http://intelears.me/unforged-mirror/) | Too big for entities (128 KiB limit), and it doesn't need to be: every file is checked against the manifest on Arkiv, so the host needn't be trusted |
| The curator's address | Hardcoded in the extension (`apps/extension/src/config.ts`) | It's the root of trust. If it were read from Arkiv, whoever controls the read controls the trust |
| Recipes | Git, in `recipes/` | They're reviewed like code, and the attestation carries their sha256 digest |
| Private keys | Each builder's `.env` or GitHub secret | Never leave the signer |
| Anything about users | Nowhere | The extension never writes, and browsing never triggers a read |
| The extension's verdicts | Local storage in the user's browser | Per-user and private |
