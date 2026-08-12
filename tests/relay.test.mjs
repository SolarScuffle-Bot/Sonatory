import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, RelayError, RelayRegistry, sha256 } from '../relay/core.js';

const registry = () => new RelayRegistry({ verify: async () => true });

async function envelope(overrides = {}) {
  const ciphertext = overrides.ciphertext || 'opaque-ciphertext';
  return {
    protocolVersion: 1, suiteId: 'S1', codecVersion: 1, boundaryKind: 'vault', boundaryGuid: 'vault-12345678', operationId: overrides.operationId || crypto.randomUUID(),
    actorVaultGuid: 'vault-12345678', actorDeviceGuid: 'device-12345678', actorCounter: overrides.actorCounter || 1,
    priorDeviceEventHash: '0'.repeat(64), basedOnCanonicalSequence: 0, policyEpoch: 1, contentKeyEpoch: 1,
    capabilityClass: 'content.write', eventSchemaId: 'entity.change', eventSchemaVersion: 1,
    iv: 'random-iv', ciphertext, ciphertextHash: await sha256(ciphertext), deviceSignature: 'opaque-signature', ...overrides
  };
}

test('relay assigns gap-free canonical order and bounded pull', async () => {
  const relay = registry();
  const space = relay.create('vault', 'vault-12345678', 'a'.repeat(64));
  const first = await envelope({ actorCounter: 1 });
  const second = await envelope({ actorCounter: 2, priorDeviceEventHash: await sha256(canonicalJson(first)) });
  const result = await space.push([first, second]);
  assert.deepEqual(result.receipts.map(item => item.canonicalSequence), [1, 2]);
  assert.equal(space.pull(0, 1).records.length, 1);
  assert.equal(space.pull(1).records[0].receipt.canonicalSequence, 2);
});

test('relay retry is idempotent and altered operation reuse fails', async () => {
  const space = registry().create('vault', 'vault-12345678', 'a'.repeat(64));
  const item = await envelope({ operationId: 'operation-12345678' });
  const first = await space.push([item]);
  const second = await space.push([item]);
  assert.equal(first.receipts[0].canonicalSequence, second.receipts[0].canonicalSequence);
  assert.equal(space.status().head, 1);
  await assert.rejects(() => space.push([{ ...item, ciphertext: 'altered' }]), error => error instanceof RelayError && error.code === 'operation_reuse');
});

test('quota exhaustion rejects whole batch without losing canonical head', async () => {
  const space = registry().create('vault', 'vault-12345678', 'a'.repeat(64), 100);
  const item = await envelope();
  await assert.rejects(() => space.push([item]), error => error instanceof RelayError && error.code === 'quota_exhausted');
  assert.equal(space.status().head, 0);
});

test('boundaries are isolated and genesis is idempotent only when identical', () => {
  const relay = registry();
  relay.create('vault', 'vault-12345678', 'a'.repeat(64));
  relay.create('group', 'vault-12345678', 'b'.repeat(64));
  assert.notEqual(relay.get('vault', 'vault-12345678'), relay.get('group', 'vault-12345678'));
  assert.throws(() => relay.create('vault', 'vault-12345678', 'c'.repeat(64)), error => error instanceof RelayError && error.code === 'boundary_exists');
});

test('relay rejects malformed encrypted bytes and duplicate operations atomically', async () => {
  const space = registry().create('vault', 'vault-12345678', 'a'.repeat(64));
  const item = await envelope({ operationId: 'operation-duplicate' });
  await assert.rejects(() => space.push([item, item]), error => error instanceof RelayError && error.code === 'duplicate_batch_operation');
  assert.equal(space.status().head, 0);
  await assert.rejects(() => space.push([{ ...item, ciphertextHash: 'f'.repeat(64) }]), error => error instanceof RelayError && error.code === 'ciphertext_hash_mismatch');
  assert.equal(space.status().head, 0);
});

test('relay enforces device counter/hash chain and rejects future bases', async () => {
  const space = registry().create('vault', 'vault-12345678', 'a'.repeat(64));
  const skippedCounter = await envelope({ actorCounter: 2 });
  await assert.rejects(() => space.push([skippedCounter]), error => error instanceof RelayError && error.code === 'device_chain_conflict');
  const futureBase = await envelope({ basedOnCanonicalSequence: 1 });
  await assert.rejects(() => space.push([futureBase]), error => error instanceof RelayError && error.code === 'future_base');
  assert.equal(space.status().head, 0);
});

test('relay spaces reject every Push when no signature verifier is configured', async () => {
  const space = new RelayRegistry().create('vault', 'vault-12345678', 'a'.repeat(64));
  const item = await envelope();
  await assert.rejects(() => space.push([item]), error => error instanceof RelayError && error.code === 'invalid_signature');
  assert.equal(space.status().head, 0);
});
