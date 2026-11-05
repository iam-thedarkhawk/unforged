// Shared test fixtures. Keys are generated per run; never hardcode one.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildStatement, statementDigest } from "./index.js";
import type { AttestationEntry, Manifest, Policy, Recipe } from "./types.js";

export const REPO = "https://github.com/lidofinance/ethereum-staking-widget";

export function newBuilder() {
  return privateKeyToAccount(generatePrivateKey());
}
export type Builder = ReturnType<typeof newBuilder>;

export function manifest(release = "0.161.0", files: Record<string, string> = {}): Manifest {
  return {
    version: 1,
    dapp: "lido-staking-widget",
    release,
    commit: "e256fd6db9f713433b5b95bcf2d2fd833131a547",
    files: { "/index.html": "aa".repeat(32), "/app.js": "bb".repeat(32), ...files },
    config: {},
  };
}

export function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    dapp: "lido-staking-widget",
    release: "0.161.0",
    repo: REPO,
    commit: "e256fd6db9f713433b5b95bcf2d2fd833131a547",
    node: "24",
    packageManager: "yarn@4.17.1",
    files: {},
    env: {},
    envFile: ".env.production.local",
    buildPath: "/unforged/build",
    install: "yarn install --immutable",
    build: "yarn build:ipfs",
    output: "out",
    configFiles: {},
    ...overrides,
  };
}

export function policy(builders: Builder[], overrides: Partial<Policy> = {}): Policy {
  return {
    dapp: "lido-staking-widget",
    origins: ["http://localhost:8080"],
    repo: REPO,
    builders: builders.map((b) => b.address),
    threshold: 2,
    acceptLatest: 2,
    thirdParty: {},
    recovery: { gateway: "https://gateway.example/bzz/" },
    ...overrides,
  };
}

const toolchain = { node: "24.1.0", packageManager: "yarn@4.17.1", os: "linux" };

export async function attest(
  builder: Builder,
  m: Manifest,
  opts: { builtAt?: string; repo?: string; swarmRef?: string | null } = {},
): Promise<AttestationEntry> {
  const statement = await buildStatement(
    m,
    recipe({ release: m.release, repo: opts.repo ?? REPO }),
    builder.address,
    toolchain,
    opts.builtAt ?? "2026-11-01T00:00:00.000Z",
  );
  const signature = await builder.signMessage({ message: { raw: await statementDigest(statement) } });
  return {
    creator: builder.address,
    attestation: { statement, signature },
    manifest: m,
    swarmRef: opts.swarmRef === undefined ? "ab".repeat(32) : opts.swarmRef,
  };
}
