// Cloudflare hard-free reference relay. It stores only opaque encrypted envelopes,
// public authorization data, chain receipts, and operational metadata.
import { authorizationVerifier, RelayError, RelaySpace } from './core.js';

const YEAR_MS = 365 * 24 * 60 * 60 * 1_000;
const WARNING_MS = 90 * 24 * 60 * 60 * 1_000;
const MAX_BODY_BYTES = 2_000_000;
const HARD_CAPS = Object.freeze({ vault: 25_000_000, group: 100_000_000 });

export class SyncSpace {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.kv = ctx.storage.kv;
    this.queue = Promise.resolve();
  }

  fetch(request) {
    const operation = this.queue.then(() => this.handle(request));
    this.queue = operation.catch(() => {});
    return operation;
  }

  meta() { return this.kv.get('meta') || null; }

  status(meta) {
    return {
      kind: meta.kind, guid: meta.guid, head: meta.head, canonicalHash: meta.canonicalHash,
      authorizationHash: meta.authorizationHash, bytes: meta.bytes, maxBytes: meta.maxBytes,
      expiresAt: new Date(meta.expiresAt).toISOString(),
      expiryWarning: Date.now() >= meta.expiresAt - WARNING_MS
    };
  }

  persistMeta(meta) { this.kv.put('meta', meta); }

  async touch(meta) {
    meta.lastActivityAt = Date.now();
    meta.expiresAt = meta.lastActivityAt + YEAR_MS;
    this.persistMeta(meta);
    await this.ctx.storage.setAlarm(meta.expiresAt);
  }

  async authorizer(meta) {
    return authorizationVerifier(meta.authorization, meta.kind, meta.guid, meta.authorizationHash);
  }

  hydrate(meta, operationIds = []) {
    const space = new RelaySpace({ kind: meta.kind, guid: meta.guid, authorizationHash: meta.authorizationHash, maxBytes: meta.maxBytes });
    space.authorization = meta.authorization;
    space.records = new Array(meta.head);
    space.canonicalHash = meta.canonicalHash;
    space.bytes = meta.bytes;
    space.deviceHeads = new Map(meta.deviceHeads || []);
    space.sessions = new Map((meta.sessions || []).filter(([, expiresAt]) => expiresAt > Date.now()));
    space.challengeNonces = new Set(meta.challengeNonces || []);
    for (const operationId of operationIds) {
      const stored = this.kv.get(`op:${operationId}`);
      if (stored) space.operations.set(operationId, stored);
    }
    return space;
  }

  async readBody(request) {
    if (!String(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new RelayError(415, 'unsupported_media_type', 'Relay requests require application/json.');
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new RelayError(413, 'body_too_large', 'Request body is too large.');
    try { return text ? JSON.parse(text) : {}; }
    catch { throw new RelayError(400, 'invalid_json', 'Request must contain valid JSON.'); }
  }

  async create(body) {
    const existing = this.meta();
    const kind = body.kind;
    const guid = body.guid;
    const hardCap = HARD_CAPS[kind];
    if (!hardCap || !/^[a-zA-Z0-9-]{8,128}$/.test(String(guid || ''))) throw new RelayError(400, 'invalid_boundary', 'Boundary kind or GUID is invalid.');
    await authorizationVerifier(body.authorization, kind, guid, body.authorizationHash);
    if (existing) {
      if (existing.kind !== kind || existing.guid !== guid || existing.authorizationHash !== body.authorizationHash) throw new RelayError(409, 'boundary_exists', 'Boundary genesis does not match.');
      await this.touch(existing);
      return this.status(existing);
    }
    const requested = Number.isSafeInteger(body.maxBytes) && body.maxBytes > 0 ? body.maxBytes : hardCap;
    const now = Date.now();
    const meta = {
      kind, guid, authorizationHash: body.authorizationHash, authorization: body.authorization,
      maxBytes: Math.min(requested, hardCap), head: 0, canonicalHash: '0'.repeat(64), bytes: 0,
      deviceHeads: [], sessions: [], challengeNonces: [], createdAt: now, lastActivityAt: now, expiresAt: now + YEAR_MS
    };
    this.persistMeta(meta);
    await this.ctx.storage.setAlarm(meta.expiresAt);
    return this.status(meta);
  }

  async handshake(meta, body) {
    const verify = await this.authorizer(meta);
    const space = this.hydrate(meta);
    space.verifyChallenge = verify.challenge;
    const result = await space.handshake(body);
    meta.sessions = [...space.sessions];
    meta.challengeNonces = [...space.challengeNonces].slice(-2_000);
    await this.touch(meta);
    return { ...result, ...this.status(meta) };
  }

  authorize(meta, token) {
    const sessions = new Map((meta.sessions || []).filter(([, expiresAt]) => expiresAt > Date.now()));
    meta.sessions = [...sessions];
    return sessions.has(token);
  }

  async pull(meta, after, limit) {
    if (!Number.isSafeInteger(after) || after < 0) throw new RelayError(400, 'invalid_cursor', 'Cursor must be a non-negative integer.');
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    const records = [];
    for (let sequence = after + 1; sequence <= Math.min(meta.head, after + safeLimit); sequence += 1) {
      const record = this.kv.get(`event:${String(sequence).padStart(12, '0')}`);
      if (!record) throw new RelayError(500, 'storage_incomplete', 'Relay storage is missing a canonical event.');
      records.push(record);
    }
    await this.touch(meta);
    return { ...this.status(meta), records };
  }

  async push(meta, envelopes) {
    if (!Array.isArray(envelopes) || !envelopes.length || envelopes.length > 100) throw new RelayError(400, 'invalid_batch', 'Push requires 1 to 100 envelopes.');
    const verify = await this.authorizer(meta);
    const operationIds = envelopes.map(envelope => String(envelope?.operationId || ''));
    const space = this.hydrate(meta, operationIds);
    space.verify = verify;
    space.verifyChallenge = verify.challenge;
    const originalHead = meta.head;
    const result = await space.push(envelopes);
    const appended = space.records.slice(originalHead);
    const nextMeta = {
      ...meta, head: space.records.length, canonicalHash: space.canonicalHash, bytes: space.bytes,
      deviceHeads: [...space.deviceHeads], sessions: [...space.sessions], lastActivityAt: Date.now()
    };
    nextMeta.expiresAt = nextMeta.lastActivityAt + YEAR_MS;
    this.ctx.storage.transactionSync(() => {
      for (let index = 0; index < appended.length; index += 1) {
        const record = appended[index];
        const sequence = originalHead + index + 1;
        this.kv.put(`event:${String(sequence).padStart(12, '0')}`, { envelope: record.envelope, receipt: record.receipt });
        this.kv.put(`op:${record.envelope.operationId}`, { envelopeHash: record.receipt.envelopeHash, receipt: record.receipt });
      }
      this.persistMeta(nextMeta);
    });
    await this.ctx.storage.setAlarm(nextMeta.expiresAt);
    return { ...this.status(nextMeta), receipts: result.receipts };
  }

  async handle(request) {
    try {
      const url = new URL(request.url);
      const action = url.pathname.endsWith('/handshake') ? 'handshake' : url.pathname.endsWith('/events') ? 'events' : 'create';
      const body = request.method === 'GET' || request.method === 'DELETE' ? null : await this.readBody(request);
      const boundary = /^\/v1\/spaces\/(vault|group)\/([a-zA-Z0-9-]{8,128})/.exec(url.pathname);
      if (request.method === 'POST' && action === 'create') return json(await this.create({ ...body, kind: boundary?.[1], guid: boundary?.[2] }), 201);
      const meta = this.meta();
      if (!meta) throw new RelayError(404, 'not_found', 'Synchronization boundary was not found.');
      if (request.method === 'POST' && action === 'handshake') return json(await this.handshake(meta, body));
      const token = /^Bearer\s+([A-Za-z0-9]+)$/.exec(String(request.headers.get('authorization') || ''))?.[1] || '';
      if (!this.authorize(meta, token)) throw new RelayError(401, 'authentication_required', 'Complete a signed device handshake before Push or Pull.');
      if (request.method === 'DELETE' && action === 'create') { await this.ctx.storage.deleteAll(); return new Response(null, { status: 204 }); }
      if (request.method === 'GET' && action === 'events') return json(await this.pull(meta, Number(url.searchParams.get('after') || 0), Number(url.searchParams.get('limit') || 200)));
      if (request.method === 'POST' && action === 'events') return json(await this.push(meta, body.envelopes));
      throw new RelayError(405, 'method_not_allowed', 'Method is not allowed.');
    } catch (error) {
      const status = error instanceof RelayError ? error.status : isStorageFull(error) ? 507 : 500;
      return json({ error: error instanceof RelayError ? error.code : status === 507 ? 'quota_exhausted' : 'internal_error', message: status === 500 ? 'Relay error.' : status === 507 ? 'Hosted replica is full; local work must remain queued.' : error.message }, status);
    }
  }

  async alarm() {
    const meta = this.meta();
    if (!meta) return;
    if (Date.now() >= meta.expiresAt) { await this.ctx.storage.deleteAll(); return; }
    await this.ctx.storage.setAlarm(meta.expiresAt);
  }
}

function isStorageFull(error) { return error instanceof Error && /SQLITE_FULL|database or disk is full/i.test(error.message); }

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
}

function withCors(response, origin) {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const allowed = allowedOrigins(env);
    if (origin && !allowed.includes(origin)) return json({ error: 'origin_not_allowed', message: 'This application origin is not allowed to use the relay.' }, 403);
    if (request.method === 'OPTIONS') {
      if (!origin) return json({ error: 'origin_required', message: 'CORS preflight requires an Origin.' }, 400);
      return withCors(new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '86400' } }), origin);
    }
    const match = /^\/v1\/spaces\/(vault|group)\/([a-zA-Z0-9-]{8,128})(?:\/(handshake|events))?$/.exec(url.pathname);
    if (!match) return withCors(json({ error: 'not_found', message: 'Endpoint not found.' }, 404), origin);
    const id = env.SYNC_SPACES.idFromName(`${match[1]}:${match[2]}`);
    return withCors(await env.SYNC_SPACES.get(id).fetch(request), origin);
  }
};
