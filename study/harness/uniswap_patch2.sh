#!/usr/bin/env bash
# The public Uniswap repo's root tsconfig.json references ./apps/unilens, which isn't published.
# Drop that one reference (a recipe-level patch, visible and auditable), then build as before.
set -u
ST=/tmp/claude-0/-home-claude/d134fb79-f2ae-5250-b39a-482f33de2716/scratchpad/study
source <(sed -n '1,/^# name | repo dir/p' "$ST/run_study.sh")
node_path() { echo "$T/node2223/node_modules/node/bin"; }
export SKIP_CONFIG_PULL=true
PATCH="python3 -I /tmp/claude-0/-home-claude/d134fb79-f2ae-5250-b39a-482f33de2716/scratchpad/study/uni_patch.py"
run_one uniswap-patched2 Uniswap__interface 22 "$PATCH && bun install --frozen-lockfile" "cd apps/web && bunx nx build web -c ipfs --skip-nx-cache" apps/web/build/client "apps/web/build node_modules/.cache .nx"
echo UNIP2DONE >> "$RES/progress.txt"
