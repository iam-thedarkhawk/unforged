// The attacker's server: hosts the script that inject mode adds to the dapp's page.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const PORT = 9090;
const EVIL_FILE = fileURLToPath(new URL('attacker/evil.js', import.meta.url));

createServer(async (req, res) => {
  const headers = { 'Cache-Control': 'no-store' };
  if (new URL(req.url, 'http://localhost').pathname !== '/evil.js') {
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
    return res.end('not found\n');
  }
  try {
    const body = await readFile(EVIL_FILE);
    res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    console.error(err.message);
    res.writeHead(500, { ...headers, 'Content-Type': 'text/plain' });
    res.end(`attacker server error: ${err.message}\n`);
  }
}).listen(PORT, 'localhost', () => {
  console.log(`attacker on http://localhost:${PORT}`);
});
