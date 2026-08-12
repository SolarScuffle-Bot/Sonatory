import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { SyncSpace } from '../relay/worker.js';
import { createSyncIdentity, SyncClient } from '../src/sync.js';

class MemoryKv {
  constructor() { this.values = new Map(); }
  get(key) { return structuredClone(this.values.get(key)); }
  put(key, value) { this.values.set(key, structuredClone(value)); }
  delete(key) { return this.values.delete(key); }
}

class MemoryStorage {
  constructor() { this.kv = new MemoryKv(); this.alarmAt = null; }
  transactionSync(callback) { return callback(); }
  async setAlarm(value) { this.alarmAt = value; }
  async deleteAll() { this.kv.values.clear(); this.alarmAt = null; }
}

test('Cloudflare reference Worker matches the client contract, CORS policy, hard caps, and hibernation', async () => {
  const storage = new MemoryStorage();
  const ctx = { storage };
  let durable = new SyncSpace(ctx, {});
  const env = {
    ALLOWED_ORIGINS: 'https://app.example',
    SYNC_SPACES: {
      idFromName: name => name,
      get: () => ({ fetch: request => durable.fetch(request) })
    }
  };
  const boundaryGuid = 'vault-worker-12345';
  const endpoint = `https://relay.example/v1/spaces/vault/${boundaryGuid}`;
  const callWorker = (input, init = {}) => {
    const headers = new Headers(init.headers || {});
    headers.set('origin', 'https://app.example');
    return worker.fetch(new Request(input, { ...init, headers }), env);
  };

  const forbidden = await worker.fetch(new Request(endpoint, { headers: { origin: 'https://evil.example' } }), env);
  assert.equal(forbidden.status, 403);
  const preflight = await worker.fetch(new Request(endpoint, { method: 'OPTIONS', headers: { origin: 'https://app.example' } }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://app.example');

  const identity = await createSyncIdentity('vault', boundaryGuid, boundaryGuid, 'device-worker-1234');
  const writer = new SyncClient({ endpoint, identity, fetchImpl: callWorker });
  const created = await writer.initialize(900_000_000);
  assert.equal(created.maxBytes, 25_000_000, 'official personal Vault allocation is hard-capped');
  assert.ok(Date.parse(created.expiresAt) > Date.now());
  const payload = { private: 'opaque through the Worker' };
  const pushed = await writer.push(payload);
  assert.equal(pushed.receipt.canonicalSequence, 1);
  assert.doesNotMatch(JSON.stringify([...storage.kv.values.values()]), /opaque through the Worker/);

  durable = new SyncSpace(ctx, {}); // Simulate Durable Object eviction/rehydration.
  const reader = new SyncClient({ endpoint, identity, fetchImpl: callWorker });
  assert.deepEqual((await reader.pull(0)).map(event => event.payload), [payload]);
  assert.equal(storage.kv.get('meta').head, 1);
  assert.ok(storage.kv.get('event:000000000001'));
});
