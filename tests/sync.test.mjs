import test from 'node:test';
import assert from 'node:assert/strict';
import { createSonatoryServer } from '../server.mjs';
import { createSyncIdentity, SyncClient, SyncError } from '../src/sync.js';
import { canonicalJson, sha256 } from '../relay/core.js';
import { cloudGenesis } from '../src/cloud.js';
import { createState } from '../src/core.js';

test('automatic cloud genesis excludes managed definitions while retaining empty Vault structure', () => {
  const state = createState('Fresh Cloud Vault', 'Cloud User');
  const genesis = cloudGenesis(state);
  assert.equal(Object.values(genesis.entities).some(entity => entity.managed), false);
  assert.equal(Object.values(genesis.entities).some(entity => !entity.tags.includes('Tag')), false);
  assert.deepEqual(genesis.collections.map(collection => collection.name), ['Characters', 'Parties', 'Bags']);
  assert.deepEqual(genesis.cloud, { enabled: true, status: 'Automatic' });
});

test('browser sync client encrypts, signs, pushes, verifies, pulls, and decrypts through HTTP relay', async () => {
  const server = createSonatoryServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const endpoint = `http://127.0.0.1:${address.port}/api/relay/spaces/vault/vault-sync-12345`;
  try {
    const identity = await createSyncIdentity('vault', 'vault-sync-12345', 'vault-sync-12345', 'device-sync-1234');
    const client = new SyncClient({ endpoint, identity });
    await client.initialize(100_000);
    await client.handshake();
    const payload = { kind: 'Rename', entityId: 'entity-1234', value: 'Private name' };
    const pushed = await client.push(payload);
    assert.notEqual(pushed.envelope.ciphertext, JSON.stringify(payload));
    assert.doesNotMatch(pushed.envelope.ciphertext, /Private|Rename/);

    const reader = new SyncClient({ endpoint, identity });
    const pulled = await reader.pull(0);
    assert.deepEqual(pulled.map(event => event.payload), [payload]);

    const altered = { ...pushed.envelope, ciphertext: pushed.envelope.ciphertext.slice(0, -1) + (pushed.envelope.ciphertext.endsWith('A') ? 'B' : 'A') };
    await assert.rejects(reader.decrypt(altered), error => error instanceof SyncError && error.code === 'invalid_envelope');
    await reader.purge();
    await assert.rejects(reader.pull(0), error => error instanceof SyncError && error.code === 'not_found');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('separately signed devices share encrypted state and verify each other through authorization', async () => {
  const server = createSonatoryServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const boundaryGuid = 'vault-multi-12345';
  const endpoint = `http://127.0.0.1:${address.port}/api/relay/spaces/vault/${boundaryGuid}`;
  try {
    const firstIdentity = await createSyncIdentity('vault', boundaryGuid, 'vault-owner-1234', 'device-first-1234');
    const secondIdentity = await createSyncIdentity('vault', boundaryGuid, 'vault-owner-1234', 'device-second-1234');
    secondIdentity.contentKey = firstIdentity.contentKey;
    const authorization = { version: 1, boundaryKind: 'vault', boundaryGuid, devices: [firstIdentity.authorization.devices[0], secondIdentity.authorization.devices[0]] };
    const authorizationHash = await sha256(canonicalJson(authorization));
    firstIdentity.authorization = authorization;
    firstIdentity.authorizationHash = authorizationHash;
    secondIdentity.authorization = authorization;
    secondIdentity.authorizationHash = authorizationHash;

    const first = new SyncClient({ endpoint, identity: firstIdentity });
    const second = new SyncClient({ endpoint, identity: secondIdentity });
    await first.initialize(100_000);
    const fromFirst = { entityId: 'private-one', name: 'First device' };
    await first.push(fromFirst);

    const existingStatus = await second.initialize();
    assert.equal(existingStatus.head, 1);
    assert.equal(second.canonicalSequence, 0, 'an untrusted relay status must not advance the verified local chain');
    assert.deepEqual((await second.pull(0)).map(event => event.payload), [fromFirst]);
    const fromSecond = { entityId: 'private-two', name: 'Second device' };
    await second.push(fromSecond);
    assert.deepEqual((await first.pull(first.canonicalSequence)).map(event => event.payload), [fromSecond]);
    await assert.rejects(second.pull(999), error => error instanceof SyncError && error.code === 'unverified_cursor');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
