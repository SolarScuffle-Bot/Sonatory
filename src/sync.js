// @ts-check
import { canonicalJson, sha256, signableEnvelope } from '../relay/core.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** @param {Uint8Array|ArrayBuffer} value */
function base64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} value */
function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new SyncError('invalid_encoding', 'Encrypted bytes use invalid base64url.');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

/** @param {Response} response */
async function jsonResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new SyncError(String(body.error || `http_${response.status}`), String(body.message || 'The relay request failed.'), response.status);
  return body;
}

export class SyncError extends Error {
  /** @param {string} code @param {string} message @param {number} [status] */
  constructor(code, message, status = 0) { super(message); this.code = code; this.status = status; }
}

/**
 * Creates runtime cryptographic material. Production persistence stores private
 * CryptoKey objects in IndexedDB; it never serializes them into relay messages.
 * @param {'vault'|'group'} boundaryKind
 * @param {string} boundaryGuid
 * @param {string} actorVaultGuid
 * @param {string} actorDeviceGuid
 */
export async function createSyncIdentity(boundaryKind, boundaryGuid, actorVaultGuid, actorDeviceGuid) {
  const signing = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const signingPublicKey = await crypto.subtle.exportKey('jwk', signing.publicKey);
  const authorization = { version: 1, boundaryKind, boundaryGuid, devices: [{ vaultGuid: actorVaultGuid, deviceGuid: actorDeviceGuid, signingPublicKey }] };
  return { boundaryKind, boundaryGuid, actorVaultGuid, actorDeviceGuid, signing, contentKey, authorization, authorizationHash: await sha256(canonicalJson(authorization)) };
}

/** @param {Record<string,unknown>} envelope */
function authenticatedHeader(envelope) {
  const fields = ['protocolVersion','suiteId','codecVersion','boundaryKind','boundaryGuid','operationId','actorVaultGuid','actorDeviceGuid','actorCounter','priorDeviceEventHash','basedOnCanonicalSequence','policyEpoch','contentKeyEpoch','capabilityClass','eventSchemaId','eventSchemaVersion'];
  return Object.fromEntries(fields.map(field => [field, envelope[field]]));
}

export class SyncClient {
  /** @param {{endpoint:string,identity:Awaited<ReturnType<typeof createSyncIdentity>>,fetchImpl?:typeof fetch}} options */
  constructor(options) {
    this.endpoint = options.endpoint.replace(/\/$/, '');
    this.identity = options.identity;
    // Keep the browser's fetch receiver intact; storing it directly and later
    // calling `client.fetch()` binds the SyncClient as `this` in Chromium.
    this.fetch = options.fetchImpl || ((...args) => fetch(...args));
    this.token = '';
    this.actorCounter = 0;
    this.priorDeviceEventHash = '0'.repeat(64);
    this.canonicalSequence = 0;
    this.canonicalHash = '0'.repeat(64);
    this.remoteHead = 0;
    this.verificationKeys = new Map([[this.identity.actorDeviceGuid, this.identity.signing.publicKey]]);
  }

  /** @param {{actorCounter?:number,priorDeviceEventHash?:string,canonicalSequence?:number,canonicalHash?:string}} runtime */
  restoreRuntime(runtime = {}) {
    this.actorCounter = Number(runtime.actorCounter || 0);
    this.priorDeviceEventHash = String(runtime.priorDeviceEventHash || '0'.repeat(64));
    this.canonicalSequence = Number(runtime.canonicalSequence || 0);
    this.canonicalHash = String(runtime.canonicalHash || '0'.repeat(64));
    return this;
  }

  exportRuntime() {
    return { actorCounter: this.actorCounter, priorDeviceEventHash: this.priorDeviceEventHash, canonicalSequence: this.canonicalSequence, canonicalHash: this.canonicalHash };
  }

  async initialize(maxBytes) {
    const response = await this.fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ authorizationHash: this.identity.authorizationHash, authorization: this.identity.authorization, ...(maxBytes ? { maxBytes } : {}) }) });
    const status = await jsonResponse(response);
    this.remoteHead = Number(status.head || 0);
    return status;
  }

  async handshake() {
    const challengeBase = { boundaryKind: this.identity.boundaryKind, boundaryGuid: this.identity.boundaryGuid, deviceGuid: this.identity.actorDeviceGuid, timestamp: Date.now(), nonce: crypto.randomUUID() };
    const signature = base64Url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.identity.signing.privateKey, encoder.encode(canonicalJson(challengeBase))));
    const response = await this.fetch(`${this.endpoint}/handshake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...challengeBase, signature }) });
    const result = await jsonResponse(response);
    this.token = String(result.token || '');
    if (!this.token) throw new SyncError('invalid_session', 'Relay handshake returned no authenticated session.');
    return result;
  }

  /** @param {unknown} payload @param {{capabilityClass?:string,eventSchemaId?:string,eventSchemaVersion?:number,operationId?:string}} [options] */
  async makeEnvelope(payload, options = {}) {
    const header = {
      protocolVersion: 1, suiteId: 'S1', codecVersion: 1,
      boundaryKind: this.identity.boundaryKind, boundaryGuid: this.identity.boundaryGuid,
      operationId: options.operationId || crypto.randomUUID(), actorVaultGuid: this.identity.actorVaultGuid,
      actorDeviceGuid: this.identity.actorDeviceGuid, actorCounter: this.actorCounter + 1,
      priorDeviceEventHash: this.priorDeviceEventHash, basedOnCanonicalSequence: this.canonicalSequence,
      policyEpoch: 1, contentKeyEpoch: 1, capabilityClass: options.capabilityClass || 'content.write',
      eventSchemaId: options.eventSchemaId || 'entity.change', eventSchemaVersion: options.eventSchemaVersion || 1
    };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = base64Url(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(canonicalJson(authenticatedHeader(header))), tagLength: 128 }, this.identity.contentKey, encoder.encode(canonicalJson(payload))));
    const envelope = { ...header, iv: base64Url(iv), ciphertext, ciphertextHash: await sha256(ciphertext), deviceSignature: 'pending' };
    envelope.deviceSignature = base64Url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.identity.signing.privateKey, encoder.encode(signableEnvelope(envelope))));
    return envelope;
  }

  /** @param {unknown} payload @param {{capabilityClass?:string,eventSchemaId?:string,eventSchemaVersion?:number,operationId?:string}} [options] */
  async push(payload, options) {
    if (!this.token) await this.handshake();
    const envelope = await this.makeEnvelope(payload, options);
    const response = await this.fetch(`${this.endpoint}/events`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` }, body: JSON.stringify({ envelopes: [envelope] }) });
    const result = await jsonResponse(response);
    const receipt = result.receipts?.[0];
    await this.verifyReceipt(envelope, receipt, this.canonicalHash, this.canonicalSequence + 1);
    this.actorCounter = envelope.actorCounter;
    this.priorDeviceEventHash = await sha256(canonicalJson(envelope));
    this.canonicalSequence = receipt.canonicalSequence;
    this.canonicalHash = receipt.canonicalHash;
    return { envelope, receipt };
  }

  /** @param {Record<string,unknown>} envelope @param {Record<string,unknown>} receipt @param {string} previousHash @param {number} sequence */
  async verifyReceipt(envelope, receipt, previousHash, sequence) {
    if (!receipt || receipt.boundaryKind !== this.identity.boundaryKind || receipt.boundaryGuid !== this.identity.boundaryGuid || receipt.authorizationHash !== this.identity.authorizationHash || receipt.canonicalSequence !== sequence || receipt.previousCanonicalHash !== previousHash) throw new SyncError('invalid_receipt', 'Relay receipt does not extend the verified synchronization chain.');
    const envelopeHash = await sha256(canonicalJson(envelope));
    const canonicalHash = await sha256(`${previousHash}:${envelopeHash}:${sequence}`);
    if (receipt.envelopeHash !== envelopeHash || receipt.canonicalHash !== canonicalHash) throw new SyncError('invalid_receipt_hash', 'Relay receipt hash verification failed.');
  }

  /** @param {Record<string,unknown>} envelope */
  async decrypt(envelope) {
    if (envelope.boundaryKind !== this.identity.boundaryKind || envelope.boundaryGuid !== this.identity.boundaryGuid || await sha256(String(envelope.ciphertext)) !== envelope.ciphertextHash) throw new SyncError('invalid_envelope', 'Encrypted event does not belong to this boundary or failed its ciphertext hash.');
    const actorDeviceGuid = String(envelope.actorDeviceGuid || '');
    const authorizedDevice = this.identity.authorization.devices.find(device => device.deviceGuid === actorDeviceGuid && device.vaultGuid === envelope.actorVaultGuid);
    if (!authorizedDevice) throw new SyncError('unknown_device', 'Encrypted event was signed by a device outside the authorized boundary.');
    let verificationKey = this.verificationKeys.get(actorDeviceGuid);
    if (!verificationKey) {
      try { verificationKey = await crypto.subtle.importKey('jwk', authorizedDevice.signingPublicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
      catch { throw new SyncError('invalid_device_key', 'The authorized device signing key is invalid.'); }
      this.verificationKeys.set(actorDeviceGuid, verificationKey);
    }
    const validSignature = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verificationKey, fromBase64Url(String(envelope.deviceSignature)), encoder.encode(signableEnvelope(/** @type {any} */(envelope))));
    if (!validSignature) throw new SyncError('invalid_signature', 'Encrypted event signature is invalid.');
    try {
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(String(envelope.iv)), additionalData: encoder.encode(canonicalJson(authenticatedHeader(envelope))), tagLength: 128 }, this.identity.contentKey, fromBase64Url(String(envelope.ciphertext)));
      return JSON.parse(decoder.decode(plaintext));
    } catch { throw new SyncError('decryption_failed', 'Encrypted event authentication or decryption failed.'); }
  }

  /** @param {number} [after] */
  async pull(after = 0) {
    if (after !== 0 && after !== this.canonicalSequence) throw new SyncError('unverified_cursor', 'Pull can resume only from the locally verified synchronization head.');
    if (!this.token) await this.handshake();
    const response = await this.fetch(`${this.endpoint}/events?after=${after}&limit=200`, { headers: { authorization: `Bearer ${this.token}` } });
    const result = await jsonResponse(response);
    let priorHash = after === 0 ? '0'.repeat(64) : this.canonicalHash;
    const events = [];
    for (const record of result.records || []) {
      await this.verifyReceipt(record.envelope, record.receipt, priorHash, record.receipt.canonicalSequence);
      events.push({ payload: await this.decrypt(record.envelope), receipt: record.receipt });
      if (record.envelope.actorDeviceGuid === this.identity.actorDeviceGuid && Number(record.envelope.actorCounter) > this.actorCounter) {
        this.actorCounter = Number(record.envelope.actorCounter);
        this.priorDeviceEventHash = await sha256(canonicalJson(record.envelope));
      }
      priorHash = record.receipt.canonicalHash;
    }
    if (events.length) { this.canonicalSequence = events.at(-1).receipt.canonicalSequence; this.canonicalHash = events.at(-1).receipt.canonicalHash; }
    return events;
  }

  async purge() {
    if (!this.token) await this.handshake();
    const response = await this.fetch(this.endpoint, { method: 'DELETE', headers: { authorization: `Bearer ${this.token}` } });
    if (!response.ok) await jsonResponse(response);
    this.token = '';
    return true;
  }
}
