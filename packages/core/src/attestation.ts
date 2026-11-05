import { getAddress, isAddressEqual, recoverMessageAddress } from "viem";
import { manifestRoot, recipeDigest, sha256Canonical } from "./hash.js";
import type { Hex, Manifest, Recipe, SignedAttestation, Statement } from "./types.js";

export type Toolchain = Statement["predicate"]["toolchain"];

export async function buildStatement(
  m: Manifest,
  recipe: Recipe,
  builder: Hex,
  toolchain: Toolchain,
  builtAt: string = new Date().toISOString(),
): Promise<Statement> {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: `${m.dapp}@${m.release}`, digest: { sha256: await manifestRoot(m) } }],
    predicateType: "https://unforged.dev/rebuild/v1",
    predicate: {
      repo: recipe.repo,
      commit: recipe.commit,
      recipeDigest: await recipeDigest(recipe),
      builder: getAddress(builder),
      builtAt,
      toolchain,
    },
  };
}

/** The 32 bytes a builder signs: sha256(canonicalJSON(statement)). */
export async function statementDigest(s: Statement): Promise<Hex> {
  return `0x${await sha256Canonical(s)}`;
}

/** Case-insensitive address comparison that returns false (not throws) on malformed input. */
export function sameAddress(a: string, b: string): boolean {
  try {
    return isAddressEqual(a as Hex, b as Hex);
  } catch {
    return false;
  }
}

/** The recovered signer must be both predicate.builder and the Arkiv entity's creator. */
export async function verifyAttestation(a: SignedAttestation, expectedCreator: Hex): Promise<boolean> {
  try {
    const signer = await recoverMessageAddress({
      message: { raw: await statementDigest(a.statement) },
      signature: a.signature,
    });
    return sameAddress(signer, a.statement.predicate.builder) && sameAddress(signer, expectedCreator);
  } catch {
    return false;
  }
}
