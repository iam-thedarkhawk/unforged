#!/usr/bin/env bash
# Extend the study with more dapp frontends, same harness as run_study.sh.
set -u
ST=/tmp/claude-0/-home-claude/d134fb79-f2ae-5250-b39a-482f33de2716/scratchpad/study
source <(sed -n '1,/^# name | repo dir/p' "$ST/run_study.sh")
export SKIP_CONFIG_PULL=true
run_one yearn      yearn__yearn.fi        22 "bun install --frozen-lockfile" "cd apps/yearn && bun run build" apps/yearn/.next/static "apps/yearn/.next node_modules/.cache"
run_one hop        hop-protocol__hop      20 "pnpm install --frozen-lockfile" "cd packages/frontend && pnpm build" packages/frontend/dist "packages/frontend/dist node_modules/.cache node_modules/.vite"
run_one safe-txb   gnosis__safe-react-apps 20 "corepack yarn@1.22.22 install --frozen-lockfile" "cd apps/tx-builder && corepack yarn@1.22.22 build" apps/tx-builder/build "apps/tx-builder/build node_modules/.cache"
run_one uniswap    Uniswap__interface     22 "bun install --frozen-lockfile" "cd apps/web && bunx nx build web -c ipfs --skip-nx-cache" apps/web/build/client "apps/web/build node_modules/.cache .nx"
echo NEWDONE >> "$RES/progress.txt"
