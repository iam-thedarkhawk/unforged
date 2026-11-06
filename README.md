# Unforged

A Firefox extension that blocks a dapp's code unless independent builders rebuilt it from the public source and got the same bytes.

- [Architecture](docs/architecture.md)
- [Threat model](docs/threat-model.md)

## Independent builders

A builder rebuilds a dapp from its public source and signs what it got. There are two ways to do it, and both run the same CLI commands.

**On your own machine.** You need Node at the recipe's version, and write access to the recipe's `buildPath` (`/unforged/build` here). After `pnpm i && pnpm -r build`, with `BUILDER_PRIVATE_KEY` and `ARKIV_ACCESS_KEY` set in your environment or a git-ignored `.env`, run:

```sh
R=recipes/lido-staking-widget@0.161.0.yaml; node apps/cli/dist/cli.js build "$R" && node apps/cli/dist/cli.js attest manifest.json "$R" && node apps/cli/dist/cli.js publish attestation.json manifest.json
```

**On GitHub, in your own organisation.** Fork this repo, add your key as the `BUILDER_PRIVATE_KEY` secret and your [Rabdi access key](https://hub.arkiv.network/access-keys) as `ARKIV_ACCESS_KEY`, then run the **Independent builder** workflow from the Actions tab. Fund the key's address with test GLM from the [Hub faucet](https://hub.arkiv.network/faucet) first. Without `ARKIV_ACCESS_KEY` the run still builds and attests, then fails at `publish`; the signed `attestation.json` is in the run's artifacts.

Set `expected-root` to the root other builders got, and the run stops before signing a build that differs. If the only difference is `_buildManifest.js`, a [known nondeterminism](docs/cli-registry.md), run it again.

Independence comes from who holds the key, not from the tool. A dapp team's own CI only ever counts as a vendor attestation, even when it runs this same workflow.
