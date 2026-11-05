# Lido staking widget 0.161.0: reference build

`manifest-linux-x64.json` maps every output file to its SHA-256. It came from our Linux x86-64 builds (Node 22 and 24 gave the same result).

To compare on another machine:

```bash
git clone https://github.com/lidofinance/ethereum-staking-widget lido && cd lido
git checkout e256fd6db9f713433b5b95bcf2d2fd833131a547
cp <kit>/study/lido-0.161.0/build-info.json .
cp <kit>/study/lido-0.161.0/env.production.local .env.production.local
node .yarn/releases/yarn-4.17.1.cjs install --immutable
node .yarn/releases/yarn-4.17.1.cjs build:ipfs
python3 - <<'PY'
import hashlib, json, os
ref = json.load(open("<kit>/study/lido-0.161.0/manifest-linux-x64.json"))
got = {"/" + os.path.relpath(os.path.join(d, f), "out"): hashlib.sha256(open(os.path.join(d, f), "rb").read()).hexdigest()
       for d, _, fs in os.walk("out") for f in fs}
diff = sorted(p for p in ref if ref[p] != got.get(p))
print(f"{len(ref) - len(diff)}/{len(ref)} identical", diff[:20])
PY
```

The env values are placeholders. Only `runtime/window-env.js` and the HTML pages depend on them, so use these exact values when comparing.
