# Reproducibility study (pre-event research)

The evidence behind the whitepaper's sections 5, 7.1 and 8.1. Every number in the pitch should trace back to a file here.

## Headline

- 13 dapp frontends attempted. 7 build in a sandbox limited to package registries.
- 4 are byte-for-byte reproducible as published: Lido 0.161.0 (170 files), ENS (1,380), Curve (810), Safe Transaction Builder (21).
- 3 more became reproducible with small fixes we tested:
  - Uniswap web: 1,457/1,457 identical after a one-file patch (`harness/uni_patch.py`), which removes 6 tsconfig references to unpublished projects.
  - Aave: identical at a fixed build path with the build ID pinned.
  - Snapshot: identical after a one-line config change and a fixed path.
- Robustness: Curve and ENS stayed 100% identical with an empty package cache, UTC+14, Turkish locale, umask 077 and 1 CPU. Lido stayed identical for each factor changed alone. Its only unstable file is `_buildManifest.js`: there are two equivalent forms (see `results/robust/lido_buildManifest_form{A,B}.js`), appearing in 10 and 2 of 12 builds.

## Files

| Path | What |
|---|---|
| `results/results.jsonl` | One line per two-build comparison: status, file counts, differing files |
| `results/manifests/*.json` | path → SHA-256 for each reproducible build (Lido from the robustness baseline) |
| `results/robust/*.json` | Manifests of the robustness and one-factor-at-a-time Lido builds |
| `lido-0.161.0/` | Reference manifest plus the exact env and build-info.json, for building on another machine |
| `compare-official.sh` | Compares a rebuild with Lido's official release CAR file, file by file and by CID |
| `coverage.py` | The 22-incident coverage matrix behind whitepaper 7.1. Run it to print the totals |
| `harness/` | The scripts that ran the builds. They contain this sandbox's absolute paths, so edit `ST=` before reusing them |
| `harness/hashbench.mjs` | WebCrypto SHA-256 throughput benchmark |

The Snapshot diagnostic scripts are deliberately left out until Snapshot Labs has been told privately (whitepaper 5.3, item 3).
