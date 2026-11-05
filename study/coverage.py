"""Attack-coverage matrix: front-end and adjacent incidents, 2021-2026.

Loss figures are the reported USD amount at the time (lower published estimate where sources differ).
Classes:
  A1 hosting/CDN/bucket tampering        A2 DNS/registrar hijack
  A3 runtime third-party script          A4 build-time dependency (in the public lockfile)
  A5 signer device / browser malware     A6 exchange backend or custody infrastructure
  A7 wallet software supply chain
Defence verdicts: Y blocks, N doesn't, C conditional (see note), - not applicable.
Columns: ours (unforged), WEBCAT-if-enrolled, SRI+CSP, IPFS+ENS (verified locally), at the time of attack WEBCAT enrolled?
"""
rows = [
 # name, date, loss_musd, class, open_source_frontend, ours, webcat, sri_csp, ipfs, note
 ("Bybit via Safe{Wallet}", "2025-02", 1500.0, "A1", "yes", "Y", "Y", "C", "C", "SRI only helps if the attacker can't also rewrite the HTML; IPFS only for users loading the IPFS release"),
 ("BadgerDAO", "2021-12", 120.0, "A3", "yes", "Y", "Y", "C", "N", "script injected at the CDN edge (Cloudflare Worker); strict CSP would have blocked the extra script"),
 ("Polymarket", "2026-06", 2.94, "A3", "no", "C", "Y", "C", "N", "runtime vendor script; closed-source frontend, so vendor-attested level only"),
 ("Aerodrome + Velodrome", "2025-11", 0.70, "A2", "not found", "C", "Y", "N", "C", "DNS hijack; reproduced level needs a public frontend repo"),
 ("Ledger Connect Kit", "2023-12", 0.60, "A3", "mostly (Sushi, Revoke.cash)", "Y", "Y", "C", "N", "library loaded at runtime from a CDN without pinning"),
 ("Curve Finance", "2022-08", 0.57, "A2", "yes", "Y", "Y", "N", "C", ""),
 ("CoW Swap", "2026-04", 0.50, "A2", "yes", "Y", "Y", "N", "C", "early estimate; later unverified estimate ~$1.2M"),
 ("KyberSwap", "2022-09", 0.265, "A3", "yes", "Y", "Y", "C", "N", "Google Tag Manager script"),
 ("Balancer", "2023-09", 0.238, "A2", "yes", "Y", "Y", "N", "C", "ZachXBT figure; Arkham ~$253K"),
 ("Galxe", "2023-10", 0.16, "A2", "no", "C", "Y", "N", "C", "registrar account (Dynadot) compromised"),
 ("Squarespace hijacks (Compound, Celer, Pendle...)", "2024-07", None, "A2", "mixed", "C", "Y", "N", "C", "not totalled"),
 ("Lottie Player", "2024-10", None, "A3", "mixed", "C", "Y", "C", "N", "no confirmed losses; ~$750K blocked by Blockaid"),
 ("eth.limo", "2026-04", 0.0, "A2", "yes (gateway)", "Y", "Y", "N", "C", "DNSSEC stopped it"),
 ("Curvance", "2026-02", 0.0, "A2", "unknown", "C", "Y", "N", "C", "caught in time"),
 ("Bonk.fun", "2026-03", None, "A1/A2", "unknown", "C", "Y", "N", "C", "'minimal' losses"),
 ("Adform script", "2026-07", None, "A3", "n/a (ad script)", "C", "Y", "C", "N", "hit sites that load it; covered on supported sites"),
 ("Udesk widget", "2026-10", None, "A3", "n/a (support widget)", "C", "Y", "C", "N", "hit exchanges; vendor-attested level only"),
 # out of scope
 ("npm chalk/debug (qix)", "2025-09", 0.0, "A4", "-", "N", "N", "N", "N", "malicious versions land in the lockfile, so every rebuild reproduces them; visible in the public diff"),
 ("Radiant Capital", "2024-10", 50.0, "A5", "-", "N", "N", "N", "N", "malware on signers' devices showed correct data in the Safe UI"),
 ("WazirX", "2024-07", 230.0, "A5/A6?", "-", "C", "C", "N", "N", "signers saw a benign tx in Liminal's interface; whether the served interface or the devices were compromised is disputed"),
 ("Trust Wallet extension", "2025-12", 7.0, "A7", "-", "N", "N", "N", "N", "malicious wallet release; the analogous fix is reproducible wallet builds"),
 ("Binance", "2026-10", 6300.0, "A6", "-", "N", "N", "N", "N", "engineer laptop -> service container -> hot-wallet signing; no web page involved"),
]

in_scope = [r for r in rows if r[3].split('/')[0] in ("A1", "A2", "A3")]
out_scope = [r for r in rows if r not in in_scope]
def total(rs): return sum(r[2] for r in rs if r[2])
print(f"in-scope incidents: {len(in_scope)}, reported losses ${total(in_scope):,.1f}M")
for k in ("Y", "C"):
    rs = [r for r in in_scope if r[5] == k]
    print(f"  ours={k}: {len(rs)} incidents, ${total(rs):,.1f}M")
rs = [r for r in in_scope if r[5] == "Y"]
print(f"  ours=Y share of in-scope losses: {100*total(rs)/total(in_scope):.1f}%")
print(f"out-of-scope incidents: {len(out_scope)}, ${total(out_scope):,.1f}M")
print("WEBCAT-enrolled at time of attack: 0 of", len(in_scope), "(WEBCAT is alpha; no Ethereum dapps in its tested list)")
