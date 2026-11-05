#!/usr/bin/env bash
# Compare our independent Lido rebuild with Lido's official IPFS release, file by file and by CID.
#
# Usage: study/compare-official.sh <official-release.car> <our-out-dir>
#   official-release.car : the CAR file from the "Assets" of the GitHub release for the same tag
#   our-out-dir          : the out/ folder from `yarn build:ipfs` with build-info.json filled in
#
# What it proves:
#   1. Which files are byte-identical between the official release and our rebuild.
#   2. If only the config file (runtime/window-env.js) differs, it drops the official config file
#      into a copy of our build and repacks it. If that CID equals the official root CID, every
#      code file Lido shipped is exactly what the public source produces.
set -euo pipefail
CAR=$1; OURS=$2
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

OFFICIAL_ROOT=$(npx -y ipfs-car@1 roots "$CAR" | head -1)
echo "official root CID: $OFFICIAL_ROOT"
npx -y ipfs-car@1 unpack "$CAR" --output "$WORK/official" >/dev/null

python3 - "$WORK/official" "$OURS" <<'EOF'
import hashlib, os, sys, json
def tree(root):
    out = {}
    for d, _, fs in os.walk(root):
        for f in fs:
            p = os.path.join(d, f)
            out["/" + os.path.relpath(p, root)] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    return out
a, b = tree(sys.argv[1]), tree(sys.argv[2])
common = set(a) & set(b)
diff = sorted(p for p in common if a[p] != b[p])
print(json.dumps({
  "official_files": len(a), "our_files": len(b),
  "identical": len(common) - len(diff), "different": diff,
  "only_official": sorted(set(a) - set(b)), "only_ours": sorted(set(b) - set(a)),
}, indent=1))
EOF

cp -a "$OURS" "$WORK/ours_with_official_config"
cp "$WORK/official/runtime/window-env.js" "$WORK/ours_with_official_config/runtime/window-env.js"
OUR_ROOT=$(npx -y ipfs-car@1 pack "$WORK/ours_with_official_config" --output "$WORK/ours.car" 2>&1 | grep -o 'bafy[a-z0-9]*' | head -1)
echo "our root CID (with Lido's config file): $OUR_ROOT"
if [ "$OUR_ROOT" = "$OFFICIAL_ROOT" ]; then
  echo "MATCH: Lido's official release is exactly what the public source builds to, plus its config file."
else
  echo "NO MATCH: see the 'different' list above."
fi
