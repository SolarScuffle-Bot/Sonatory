import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RelayError, RelayRegistry } from './relay/core.js';

const root = new URL('.', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1');
const port = Number(process.env.PORT || 4173);
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif']
]);

function safePath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname.split('?')[0]); } catch { return null; }
  const requested = normalize(join(root, decoded === '/' ? 'index.html' : decoded));
  const rel = relative(root, requested);
  if (rel.startsWith('..') || rel.includes(':')) return null;
  return requested;
}

export function createSonatoryServer() {
  const relay = new RelayRegistry();
  return createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const relayMatch = /^\/api\/relay\/spaces\/(vault|group)\/([a-zA-Z0-9-]{8,128})(?:\/(handshake|events))?$/.exec(url.pathname);
    if (relayMatch) {
      const [, kind, guid, action] = relayMatch;
      const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); response.end(JSON.stringify(value)); };
      const readBody = async () => {
        if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new RelayError(415, 'unsupported_media_type', 'Relay requests require application/json.');
        let body = '';
        for await (const chunk of request) { body += chunk; if (body.length > 2_000_000) throw new RelayError(413, 'body_too_large', 'Request body is too large.'); }
        try { return body ? JSON.parse(body) : {}; } catch { throw new RelayError(400, 'invalid_json', 'Request must contain valid JSON.'); }
      };
      try {
        if (request.method === 'POST' && !action) { const body = await readBody(); send(201, (await relay.createSecure(kind, guid, String(body.authorizationHash || ''), body.authorization, body.maxBytes === undefined ? undefined : Number(body.maxBytes))).status()); return; }
        const space = relay.get(kind, guid);
        if (request.method === 'POST' && action === 'handshake') { send(200, await space.handshake(await readBody())); return; }
        const token = /^Bearer\s+([A-Za-z0-9]+)$/.exec(String(request.headers.authorization || ''))?.[1] || '';
        if (!space.authorize(token)) throw new RelayError(401, 'authentication_required', 'Complete a signed device handshake before Push or Pull.');
        if (request.method === 'DELETE' && !action) { relay.delete(kind, guid); response.writeHead(204, { 'Cache-Control': 'no-store' }); response.end(); return; }
        if (request.method === 'GET' && action === 'events') { send(200, space.pull(Number(url.searchParams.get('after') || 0), Number(url.searchParams.get('limit') || 200))); return; }
        if (request.method === 'POST' && action === 'events') { const body = await readBody(); send(200, await space.push(body.envelopes)); return; }
        throw new RelayError(405, 'method_not_allowed', 'Method is not allowed.');
      } catch (error) {
        const status = error instanceof RelayError ? error.status : 500;
        send(status, { error: error instanceof RelayError ? error.code : 'internal_error', message: status === 500 ? 'Relay error.' : error.message });
        return;
      }
    }
    if (url.pathname.startsWith('/api/relay/')) {
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify({ error: 'not_found', message: 'Relay endpoint not found.' }));
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD', 'X-Content-Type-Options': 'nosniff' });
      response.end('Method not allowed');
      return;
    }
    let file = safePath(url.pathname);
    if (!file) {
      response.writeHead(400).end('Bad request');
      return;
    }
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
    } catch {
      if (!extname(file)) file = join(root, 'index.html');
    }
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime.get(extname(file)) || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error?.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createSonatoryServer().listen(port, '127.0.0.1', () => {
    process.stdout.write(`Sonatory available at http://127.0.0.1:${port}/\n`);
  });
}
