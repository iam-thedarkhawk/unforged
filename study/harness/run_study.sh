#!/usr/bin/env bash
# Reproducibility study harness.
# For each dapp: copy the pristine clone, install from the lockfile, build, hash the output,
# move the tree to a different path, clean build outputs and caches, build again, compare.
set -u
ST=/tmp/claude-0/-home-claude/d134fb79-f2ae-5250-b39a-482f33de2716/scratchpad/study
REPOS=$ST/repos; WORK=$ST/work; RES=$ST/results; T=$ST/tools
mkdir -p "$WORK" "$RES"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1 CI=1 HUSKY=0 NX_NO_CLOUD=true NX_DAEMON=false
# This sandbox can only reach package registries. Skip optional binary downloads (dev tools,
# test browsers) that postinstall scripts fetch from vendor CDNs; they don't affect build output.
export SENTRYCLI_SKIP_DOWNLOAD=1 CYPRESS_INSTALL_BINARY=0 PUPPETEER_SKIP_DOWNLOAD=1 \
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 ELECTRON_SKIP_BINARY_DOWNLOAD=1 SKIP_SENTRY_SOURCEMAPS=1
BASEPATH="$PATH"

node_path() { case "$1" in 24) echo "$T/node24/node_modules/node/bin";; 20) echo "$T/node20/node_modules/node/bin";; *) echo "/opt/node22/bin";; esac; }

hash_tree() { # $1 dir -> json manifest on stdout
  python3 -I - "$1" <<'EOF'
import hashlib, os, sys, json
root=sys.argv[1]; out={}
for d,_,fs in os.walk(root):
    for f in fs:
        p=os.path.join(d,f)
        with open(p,'rb') as fh: out["/"+os.path.relpath(p,root)]=hashlib.sha256(fh.read()).hexdigest()
print(json.dumps(out,sort_keys=True))
EOF
}

run_one() {
  local name=$1 repo=$2 nodev=$3 install=$4 build=$5 outrel=$6 clean=$7
  local log=$RES/$name.log; : > "$log"
  local A=$WORK/A_$name B=$WORK/rebuilt_$name
  rm -rf "$A" "$B"; cp -a "$REPOS/$repo" "$A"
  export PATH="$(node_path $nodev):$T/shims:$T/bun/node_modules/.bin:$BASEPATH"
  echo "node $(node -v)" >> "$log"
  local status=ok t0 t1
  cd "$A"
  t0=$(date +%s)
  if ! timeout 2400 bash -c "$install" >> "$log" 2>&1; then status=install_failed; fi
  t1=$(date +%s); echo "install_seconds $((t1-t0))" >> "$log"
  if [ $status = ok ]; then
    t0=$(date +%s)
    if ! timeout 2700 bash -c "$build" >> "$log" 2>&1; then status=build1_failed; fi
    t1=$(date +%s); echo "build1_seconds $((t1-t0))" >> "$log"
  fi
  if [ $status = ok ] && [ ! -d "$A/$outrel" ]; then status=no_output_dir; fi
  if [ $status = ok ]; then
    hash_tree "$A/$outrel" > "$RES/$name.manifestA.json"
    cd /; mv "$A" "$B"; cd "$B"
    for c in $clean; do rm -rf "$B/$c"; done
    t0=$(date +%s)
    if ! timeout 2700 bash -c "$build" >> "$log" 2>&1; then status=build2_failed; fi
    t1=$(date +%s); echo "build2_seconds $((t1-t0))" >> "$log"
    if [ $status = ok ] && [ -d "$B/$outrel" ]; then
      hash_tree "$B/$outrel" > "$RES/$name.manifestB.json"
    fi
  fi
  python3 -I - "$name" "$status" "$RES" "$REPOS/$repo" <<'EOF' >> "$RES/results.jsonl"
import json, os, sys, subprocess
name,status,res,repo=sys.argv[1:5]
r={"dapp":name,"status":status,
   "commit":subprocess.run(["git","-C",repo,"log","-1","--format=%H %cs"],capture_output=True,text=True).stdout.strip()}
a=os.path.join(res,name+".manifestA.json"); b=os.path.join(res,name+".manifestB.json")
if os.path.exists(a) and os.path.exists(b):
    A=json.load(open(a)); B=json.load(open(b))
    common=set(A)&set(B); diff=sorted(p for p in common if A[p]!=B[p])
    r.update(files=len(A), files_b=len(B), identical=len(common)-len(diff), different=len(diff),
             only_a=sorted(set(A)-set(B))[:15], only_b=sorted(set(B)-set(A))[:15], different_files=diff[:25])
print(json.dumps(r))
EOF
  cd /; rm -rf "$A" "$B"
  echo "$(date -u +%H:%M) $name -> $status" >> "$RES/progress.txt"
}

# name | repo dir | node | install | build | output dir | paths to clean before rebuild
run_one snapshot   snapshot-labs__snapshot          22 "corepack yarn@1.22.22 install --frozen-lockfile" "corepack yarn@1.22.22 build" dist "dist node_modules/.vite node_modules/.cache"
run_one ens-app    ensdomains__ens-app-v3           20 "pnpm install --frozen-lockfile" "pnpm build && pnpm export" out ".next out node_modules/.cache"
run_one aave       aave__interface                  24 "pnpm install --frozen-lockfile" "STATIC_EXPORT=true pnpm build" out ".next out node_modules/.cache"
run_one liquity    liquity__bold                    24 "pnpm install --frozen-lockfile" "cd frontend/app && pnpm build" frontend/app/out "frontend/app/.next frontend/app/out frontend/uikit/dist node_modules/.cache"
run_one curve      curvefi__curve-frontend          24 "yarn install --immutable" "cd apps/main && yarn build" apps/main/dist "apps/main/dist node_modules/.cache node_modules/.vite"
run_one cowswap    cowprotocol__cowswap             22 "pnpm install --frozen-lockfile" "pnpm build:cowswap" build/cowswap "build dist .nx node_modules/.cache"
run_one safe       safe-global__safe-wallet-monorepo 24 "yarn install --immutable" "cd apps/web && yarn build" apps/web/out "apps/web/.next apps/web/out node_modules/.cache"
run_one revoke     RevokeCash__revoke.cash          22 "yarn install --immutable" "yarn build" apps/web/.next/static "apps/web/.next node_modules/.cache"
echo ALLDONE >> "$RES/progress.txt"
