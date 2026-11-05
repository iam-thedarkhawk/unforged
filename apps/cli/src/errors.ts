// Exit codes from docs/cli-registry.md.
export const EXIT_BUILD_FAILED = 2;
export const EXIT_NONDETERMINISM = 3;

/** A failure the user should see as one message and an exit code, without a stack trace. */
export class CliError extends Error {
  constructor(
    readonly exitCode: number,
    message: string,
  ) {
    super(message);
  }
}
