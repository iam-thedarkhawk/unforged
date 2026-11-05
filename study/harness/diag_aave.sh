#!/usr/bin/env bash
# Aave: build twice at the SAME path with a pinned build ID, keep both outputs for content diffing.
set -u
ST=/tmp/claude-0/-home-claude/d134fb79-f2ae-5250-b39a-482f33de2716/scratchpad/study
source <(sed -n '1,/^# name | repo dir/p' "$ST/run_study.sh")
D=$ST/diag_aave; rm -rf "$D"; mkdir -p "$D"
W=$WORK/aaveD; rm -rf "$W"; cp -a "$REPOS/aave__fixedid" "$W"
export PATH="$(node_path 24):$T/shims:$BASEPATH" PINNED_BUILD_ID=36acdefbb8bcdeafb781a0c9c124cd539f6ae82a
cd "$W" && pnpm install --frozen-lockfile > "$D/install.log" 2>&1
for i in 1 2; do
  NODE_OPTIONS=--max-old-space-size=6144 STATIC_EXPORT=true pnpm build > "$D/b$i.log" 2>&1
  cp -a out "$D/out$i"; rm -rf .next out node_modules/.cache
done
python3 -I "$ST/../compare.py" "$D/out1" "$D/out2" > "$D/same_path.json"
echo "$(date -u +%H:%M) diag_aave done" >> "$RES/progress.txt"
