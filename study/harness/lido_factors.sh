#!/usr/bin/env bash
# Lido v1 differed from v0 only in _buildManifest.js. Change one factor at a time to find which.
set -u
ST=/tmp/claude-0/-home-claude/d134fb79-f2ae-5250-b39a-482f33de2716/scratchpad/study
source <(sed -n '1,/^export -f lido_env/p' "$ST/robust2.sh")
F=$RES/robust/factors; mkdir -p "$F"
one() { # name nodev envspec pin
  local name=$1 nodev=$2 envspec=$3 pin=$4 W=$WORK/factor_$1
  rm -rf "$W"; mkdir -p "$W"; cp -a "$REPOS/lido_e256fd6" "$W/src"
  ( cd "$W/src"; export PATH="$(node_path $nodev):$T/shims:$BASEPATH"; eval "export $envspec"
    eval "$LIDO_ENV_A"
    $pin node .yarn/releases/yarn-4.17.1.cjs install --immutable > "$F/$name.log" 2>&1
    $pin node .yarn/releases/yarn-4.17.1.cjs build:ipfs >> "$F/$name.log" 2>&1; echo "build_exit $?" >> "$F/$name.log" )
  hash_tree "$W/src/out" > "$F/$name.json"
  cp "$W/src/out/_next/static/$LIDO_COMMIT/_buildManifest.js" "$F/$name._buildManifest.js" 2>/dev/null
  rm -rf "$W"; echo "$(date -u +%H:%M) factor $name done" >> "$RES/progress.txt"
}
cp "$RES/robust/lido_v0_out/_next/static/$LIDO_COMMIT/_buildManifest.js" "$F/v0._buildManifest.js"
one node24 24 "DUMMY=1" ""
one locale_tr 22 "LANG=tr_TR.UTF-8 LC_ALL=tr_TR.UTF-8" ""
one cpu1 22 "DUMMY=1" "taskset -c 0"
echo FACTORSDONE >> "$RES/progress.txt"
