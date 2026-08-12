import test from 'node:test';
import assert from 'node:assert/strict';
import { createSonatoryServer } from '../server.mjs';
import { canonicalJson, sha256, signableEnvelope } from '../relay/core.js';

const base64Url = bytes => Buffer.from(bytes).toString('base64url');

async function makeEnvelope(privateKey) {
  const ciphertext = 'opaque-http-test';
  const envelope = {
    protocolVersion: 1,
    suiteId: 'S1',
    codecVersion: 1,
    boundaryKind: 'vault',
    boundaryGuid: 'vault-http-1234',
    operationId: 'operation-http-1234',
    actorVaultGuid: 'vault-http-1234',
    actorDeviceGuid: 'device-http-1234',
    actorCounter: 1,
    priorDeviceEventHash: '0'.repeat(64),
    basedOnCanonicalSequence: 0,
    policyEpoch: 1,
    contentKeyEpoch: 1,
    capabilityClass: 'content.write',
    eventSchemaId: 'entity.change',
    eventSchemaVersion: 1,
    iv: 'opaque-iv',
    ciphertext,
    ciphertextHash: await sha256(ciphertext),
    deviceSignature: 'pending'
  };
  envelope.deviceSignature = base64Url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(signableEnvelope(envelope))));
  return envelope;
}

test('HTTP server serves hardened static assets and relay contract end to end', async () => {
  const server = createSonatoryServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') || '', /object-src 'none'/);
    assert.doesNotMatch(page.headers.get('content-security-policy') || '', /connect-src[^;]*wss?:/);
    assert.equal(page.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(page.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.match(await page.text(), /<div id="app"/);

    const head = await fetch(`${base}/styles.css`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/api/relay/not-a-route`)).status, 404);

    const endpoint = `${base}/api/relay/spaces/vault/vault-http-1234`;
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const authorization = { version: 1, boundaryKind: 'vault', boundaryGuid: 'vault-http-1234', devices: [{ vaultGuid: 'vault-http-1234', deviceGuid: 'device-http-1234', signingPublicKey: await crypto.subtle.exportKey('jwk', keyPair.publicKey) }] };
    const authorizationHash = await sha256(canonicalJson(authorization));
    const noContentType = await fetch(endpoint, { method: 'POST', body: '{}' });
    assert.equal(noContentType.status, 415);
    const invalidGenesis = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ authorizationHash: 'short' }) });
    assert.equal(invalidGenesis.status, 400);
    const created = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ authorizationHash, authorization, maxBytes: 100_000 }) });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).head, 0);

    const envelope = await makeEnvelope(keyPair.privateKey);
    assert.equal((await fetch(`${endpoint}/events?after=0`)).status, 401);
    const challengeBase = { boundaryKind: 'vault', boundaryGuid: 'vault-http-1234', deviceGuid: 'device-http-1234', timestamp: Date.now(), nonce: crypto.randomUUID() };
    const challenge = { ...challengeBase, signature: base64Url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, new TextEncoder().encode(canonicalJson(challengeBase)))) };
    const handshake = await fetch(`${endpoint}/handshake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(challenge) });
    assert.equal(handshake.status, 200);
    const token = (await handshake.json()).token;
    const authorizationHeader = { authorization: `Bearer ${token}` };
    assert.equal((await fetch(`${endpoint}/handshake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(challenge) })).status, 409);
    const invalidEnvelope = { ...envelope, operationId: 'operation-invalid-signature', deviceSignature: base64Url(crypto.getRandomValues(new Uint8Array(64))) };
    const invalidPush = await fetch(`${endpoint}/events`, { method: 'POST', headers: { 'content-type': 'application/json', ...authorizationHeader }, body: JSON.stringify({ envelopes: [invalidEnvelope] }) });
    assert.equal(invalidPush.status, 403);
    const pushed = await fetch(`${endpoint}/events`, { method: 'POST', headers: { 'content-type': 'application/json', ...authorizationHeader }, body: JSON.stringify({ envelopes: [envelope] }) });
    assert.equal(pushed.status, 200);
    const pushBody = await pushed.json();
    assert.equal(pushBody.receipts[0].canonicalSequence, 1);
    assert.equal(pushBody.receipts[0].envelopeHash, await sha256(canonicalJson(envelope)));

    const pulled = await fetch(`${endpoint}/events?after=0&limit=1`, { headers: authorizationHeader });
    assert.equal(pulled.status, 200);
    const pullBody = await pulled.json();
    assert.equal(pullBody.records.length, 1);
    assert.equal(pullBody.records[0].envelope.ciphertext, 'opaque-http-test');
    assert.equal((await fetch(`${base}/api/relay/spaces/group/vault-http-1234/events?after=0`, { headers: authorizationHeader })).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
