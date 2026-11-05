// WebCrypto SHA-256 throughput, the same API the extension uses (crypto.subtle).
const sizes = [50e3, 500e3, 5e6];
for (const n of sizes) {
  const buf = new Uint8Array(n); for (let i = 0; i < n; i++) buf[i] = (i * 31) & 255;
  for (let w = 0; w < 5; w++) await crypto.subtle.digest('SHA-256', buf);
  const runs = 50, t0 = performance.now();
  for (let r = 0; r < runs; r++) await crypto.subtle.digest('SHA-256', buf);
  const ms = (performance.now() - t0) / runs;
  console.log(`${(n/1e3).toFixed(0).padStart(5)} KB: ${ms.toFixed(3)} ms per hash, ${(n/1e6/(ms/1000)).toFixed(0)} MB/s`);
}
