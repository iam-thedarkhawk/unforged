#!/usr/bin/env bash
# Aave: same tree, moved to a different absolute path, built again. Compare with out1.
set -u
ST=/tmp/claude-0/-home-claude/d134fb79-f2ae-5250-b39a-482f33de2716/scratchpad/study
source <(sed -n '1,/^# name | repo dir/p' "$ST/run_study.sh")
D=$ST/diag_aave; W=$WORK/aaveD; W2=$WORK/a_much_longer_directory_name/aave_moved
mkdir -p "$(dirname "$W2")"; mv "$W" "$W2"; cd "$W2"
export PATH="$(node_path 24):$T/shims:$BASEPATH" PINNED_BUILD_ID=36acdefbb8bcdeafb781a0c9c124cd539f6ae82a
rm -rf .next out node_modules/.cache
NODE_OPTIONS=--max-old-space-size=6144 STATIC_EXPORT=true pnpm build > "$D/b3.log" 2>&1
cp -a out "$D/out3"
python3 -I "$ST/../compare.py" "$D/out1" "$D/out3" > "$D/diff_path.json"
grep -rl "aaveD\|aave_moved" "$D/out1" "$D/out3" > "$D/path_leaks.txt" 2>/dev/null
echo "$(date -u +%H:%M) diag_aave_path done" >> "$RES/progress.txt"
