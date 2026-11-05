#!/usr/bin/env bash
# Robustness study: rebuild already-reproducible dapps under changed conditions and compare
# against a baseline. Each variant uses a fresh copy at its own path; "fresh" variants also use an
# empty HOME and package cache, so every dependency is downloaded again from the registry.
set -u
ST=/tmp/claude-0/-home-claude/d134fb79-f2ae-5250-b39a-482f33de2716/scratchpad/study
source <(sed -n '1,/^# name | repo dir/p' "$ST/run_study.sh")
RB=$RES/robust; mkdir -p "$RB"
LIDO_COMMIT=e256fd6db9f713433b5b95bcf2d2fd833131a547

lido_env() { # $1 = host suffix, $2 = walletconnect id
  local h=$1 wc=$2
  echo "SELF_ORIGIN=https://stake.$h"; echo "ROOT_ORIGIN=https://$h"; echo "DOCS_ORIGIN=https://docs.$h"
  echo "HELP_ORIGIN=https://help.$h"; echo "RESEARCH_ORIGIN=https://research.$h"
  for c in 1 17000 560048 11155111 10 11155420 130 1301 8453 59144 42161; do
    echo "EL_RPC_URLS_$c=https://rpc$c.$h"; echo "PREFILL_UNSAFE_EL_RPC_URLS_$c=https://prefill$c.$h"
  done
  echo "SUPPORTED_CHAINS=1,560048"; echo "DEFAULT_CHAIN=1"; echo "WALLETCONNECT_PROJECT_ID=$wc"
}

# variant name | repo dir | node | perturb(0/1) | fresh cache(0/1) | install | build | out | prep
variant() {
  local name=$1 repo=$2 nodev=$3 perturb=$4 fresh=$5 install=$6 build=$7 outrel=$8 prep=$9
  local W=$WORK/robust_${name}_$(printf '%s' "$name" | sha256sum | cut -c1-8)
  local log=$RB/$name.log; : > "$log"
  rm -rf "$W"; mkdir -p "$W"; cp -a "$REPOS/$repo" "$W/src"
  (
    cd "$W/src"
    export PATH="$(node_path $nodev):$T/shims:$BASEPATH"
    if [ "$fresh" = 1 ]; then
      mkdir -p "$W/home" "$W/cache"
      export HOME="$W/home" YARN_ENABLE_GLOBAL_CACHE=false YARN_CACHE_FOLDER="$W/cache/yarn" \
        npm_config_store_dir="$W/cache/pnpm-store" npm_config_cache="$W/cache/npm"
    fi
    if [ "$perturb" = 1 ]; then
      export TZ=Pacific/Kiritimati LANG=tr_TR.UTF-8 LC_ALL=tr_TR.UTF-8 HOSTNAME=builder-two USER=builder2
      umask 077
      PIN="taskset -c 0"
    else
      PIN=""
    fi
    echo "node $(node -v) perturb=$perturb fresh=$fresh path=$W/src TZ=${TZ:-} LC_ALL=${LC_ALL:-} umask=$(umask)" >> "$log"
    eval "$prep" >> "$log" 2>&1
    t0=$(date +%s); $PIN timeout 2700 bash -c "$install" >> "$log" 2>&1; echo "install_exit $? $(( $(date +%s)-t0 ))s" >> "$log"
    t0=$(date +%s); $PIN timeout 2700 bash -c "$build" >> "$log" 2>&1; echo "build_exit $? $(( $(date +%s)-t0 ))s" >> "$log"
  )
  if [ -d "$W/src/$outrel" ]; then hash_tree "$W/src/$outrel" > "$RB/$name.json"; else echo "{}" > "$RB/$name.json"; fi
  if [ "$name" = lido_v0 ]; then rm -rf "$RB/lido_v0_out"; cp -a "$W/src/$outrel" "$RB/lido_v0_out"; fi
  rm -rf "$W"
  echo "$(date -u +%H:%M) robust $name done" >> "$RES/progress.txt"
}

LIDO_INFO='printf "{\n  \"version\": \"0.161.0\",\n  \"branch\": \"main\",\n  \"commit\": \"'$LIDO_COMMIT'\"\n}\n" > build-info.json'
LIDO_ENV_A="$LIDO_INFO; lido_env example.org 00000000000000000000000000000000 > .env.production.local"
LIDO_ENV_B="$LIDO_INFO; lido_env other-builder.net ffffffffffffffffffffffffffffffff > .env.production.local"
export -f lido_env

variant lido_v0 lido_e256fd6 22 0 0 "yarn install --immutable" "yarn build:ipfs" out "$LIDO_ENV_A"
variant lido_v1 lido_e256fd6 24 1 1 "yarn install --immutable" "yarn build:ipfs" out "$LIDO_ENV_A"
variant lido_v2 lido_e256fd6 22 0 0 "yarn install --immutable" "yarn build:ipfs" out "$LIDO_ENV_B"
variant curve_v1 curvefi__curve-frontend 24 1 1 "yarn install --immutable" "cd apps/main && yarn build" apps/main/dist ":"
variant curve_v2 curvefi__curve-frontend 22 0 0 "yarn install --immutable" "cd apps/main && yarn build" apps/main/dist ":"
variant ens_v1 ensdomains__ens-app-v3 20 1 1 "pnpm install --frozen-lockfile" "pnpm build && pnpm export" out ":"
echo ROBUSTDONE >> "$RES/progress.txt"
