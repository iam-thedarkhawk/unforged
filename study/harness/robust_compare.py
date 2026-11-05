"""Compare robustness variants with their baselines. Prints one line per comparison."""
import json, os, sys
RB = os.path.join(os.path.dirname(__file__), "results", "robust")
R = os.path.join(os.path.dirname(__file__), "results")
ROOT = os.path.dirname(os.path.dirname(__file__))

def load(p):
    try:
        return json.load(open(p))
    except Exception:
        return None

def cmp(label, a, b, config=()):
    if not a or not b:
        print(f"{label:58s} missing ({'a' if not a else 'b'} empty)"); return
    common = set(a) & set(b)
    diff = sorted(p for p in common if a[p] != b[p])
    code_diff = [p for p in diff if p not in config]
    only = sorted(set(a) ^ set(b))
    print(f"{label:58s} files {len(a)}/{len(b)}  identical {len(common)-len(diff)}  "
          f"differ {len(diff)} (code {len(code_diff)}, config {len(diff)-len(code_diff)})  only-one-side {len(only)}")
    for p in (code_diff + only)[:8]:
        print("    ", p)

cfg = ("/runtime/window-env.js",)
v = {n: load(os.path.join(RB, n + ".json")) for n in
     ("lido_v0", "lido_v1", "lido_v2", "curve_v1", "curve_v2", "ens_v1")}
cmp("Lido v0 (today) vs original study build (28 Oct, Node 22)", load(os.path.join(ROOT, "lido-manifest.json")), v["lido_v0"], cfg)
cmp("Lido v1 (Node 24, fresh cache, TZ/locale/umask, 1 CPU) vs v0", v["lido_v0"], v["lido_v1"], cfg)
cmp("Lido v2 (different config values) vs v0", v["lido_v0"], v["lido_v2"], cfg)
cmp("Curve v1 (fresh cache, TZ/locale/umask, 1 CPU) vs study", load(os.path.join(R, "curve.manifestA.json")), v["curve_v1"])
cmp("Curve v2 (Node 22 instead of 24) vs study", load(os.path.join(R, "curve.manifestA.json")), v["curve_v2"])
cmp("ENS v1 (fresh store, TZ/locale/umask, 1 CPU) vs study", load(os.path.join(R, "ens-app.manifestA.json")), v["ens_v1"])
