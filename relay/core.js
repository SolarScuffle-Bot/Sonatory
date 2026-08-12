// @ts-check

const encoder = new TextEncoder();

/** @param {unknown} value @returns {string} */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

/** @param {string} value */
export async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** @typedef {{protocolVersion:number,suiteId:string,codecVersion:number,boundaryKind:'vault'|'group',boundaryGuid:string,operationId:string,actorVaultGuid:string,actorDeviceGuid:string,actorCounter:number,priorDeviceEventHash:string,basedOnCanonicalSequence:number,policyEpoch:number,contentKeyEpoch:number,capabilityClass:string,eventSchemaId:string,eventSchemaVersion:number,iv:string,ciphertext:string,ciphertextHash:string,deviceSignature:string}} Envelope */
/** @typedef {{boundaryKind:'vault'|'group',boundaryGuid:string,canonicalSequence:number,operationId:string,previousCanonicalHash:string,envelopeHash:string,authorizationHash:string,receivedAt:string,canonicalHash:string}} Receipt */
/** @typedef {{version:number,boundaryKind:'vault'|'group',boundaryGuid:string,devices:Array<{vaultGuid:string,deviceGuid:string,signingPublicKey:JsonWebKey}>}} Authorization */

/** @param {Envelope} envelope */
export function signableEnvelope(envelope) {
  const unsigned = { ...envelope };
  delete unsigned.deviceSignature;
  return canonicalJson(unsigned);
}

/** @param {string} value */
function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new RelayError(400, 'invalid_signature', 'Device signature encoding is invalid.');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

/** @param {unknown} value @param {'vault'|'group'} kind @param {string} guid @param {string} expectedHash */
export async function authorizationVerifier(value, kind, guid, expectedHash) {
  if (!value || typeof value !== 'object') throw new RelayError(400, 'invalid_authorization', 'A device authorization genesis is required.');
  const authorization = /** @type {Authorization} */(value);
  if (authorization.version !== 1 || authorization.boundaryKind !== kind || authorization.boundaryGuid !== guid || !Array.isArray(authorization.devices) || !authorization.devices.length || authorization.devices.length > 500) throw new RelayError(400, 'invalid_authorization', 'Authorization genesis does not match this synchronization boundary.');
  if (await sha256(canonicalJson(authorization)) !== expectedHash) throw new RelayError(400, 'authorization_hash_mismatch', 'Authorization genesis hash does not match its canonical bytes.');
  const keys = new Map();
  for (const device of authorization.devices) {
    if (!device || typeof device.vaultGuid !== 'string' || typeof device.deviceGuid !== 'string' || !device.signingPublicKey || keys.has(device.deviceGuid)) throw new RelayError(400, 'invalid_authorization', 'Authorization contains an invalid or duplicate device.');
    try {
      const key = await crypto.subtle.importKey('jwk', device.signingPublicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      keys.set(device.deviceGuid, { vaultGuid: device.vaultGuid, key });
    } catch { throw new RelayError(400, 'invalid_authorization', 'A device signing key is not a valid P-256 public key.'); }
  }
  const verify = async envelope => {
    const device = keys.get(envelope.actorDeviceGuid);
    if (!device || device.vaultGuid !== envelope.actorVaultGuid) return false;
    try {
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, device.key, decodeBase64Url(envelope.deviceSignature), encoder.encode(signableEnvelope(envelope)));
    } catch { return false; }
  };
  verify.challenge = async challenge => {
    if (!challenge || typeof challenge !== 'object') return false;
    const { deviceGuid, timestamp, nonce, signature } = challenge;
    if (typeof deviceGuid !== 'string' || !Number.isSafeInteger(timestamp) || typeof nonce !== 'string' || nonce.length < 16 || typeof signature !== 'string') return false;
    const device = keys.get(deviceGuid);
    if (!device) return false;
    try {
      const signed = canonicalJson({ boundaryKind: kind, boundaryGuid: guid, deviceGuid, timestamp, nonce });
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, device.key, decodeBase64Url(signature), encoder.encode(signed));
    } catch { return false; }
  };
  return verify;
}

/** @param {unknown} envelope @param {'vault'|'group'} kind @param {string} guid */
export function validateEnvelope(envelope, kind, guid) {
  if (!envelope || typeof envelope !== 'object') throw new RelayError(400, 'invalid_envelope', 'Envelope must be an object.');
  const item = /** @type {Record<string, unknown>} */(envelope);
  if (item.protocolVersion !== 1) throw new RelayError(409, 'unsupported_protocol', 'Protocol version is not supported.');
  if (item.boundaryKind !== kind || item.boundaryGuid !== guid) throw new RelayError(400, 'wrong_boundary', 'Envelope boundary does not match the endpoint.');
  for (const field of ['suiteId','operationId','actorVaultGuid','actorDeviceGuid','priorDeviceEventHash','capabilityClass','eventSchemaId','iv','ciphertext','ciphertextHash','deviceSignature']) {
    if (typeof item[field] !== 'string' || !item[field]) throw new RelayError(400, 'invalid_envelope', `${field} is required.`);
  }
  if (!Number.isSafeInteger(item.actorCounter) || Number(item.actorCounter) < 1) throw new RelayError(400, 'invalid_counter', 'actorCounter must be a positive integer.');
  if (!Number.isSafeInteger(item.basedOnCanonicalSequence) || Number(item.basedOnCanonicalSequence) < 0) throw new RelayError(400, 'invalid_base', 'basedOnCanonicalSequence must be a non-negative integer.');
  for (const field of ['codecVersion','policyEpoch','contentKeyEpoch','eventSchemaVersion']) {
    if (!Number.isSafeInteger(item[field]) || Number(item[field]) < 1) throw new RelayError(400, 'invalid_envelope', `${field} must be a positive integer.`);
  }
  if (!/^[a-f0-9]{64}$/.test(String(item.priorDeviceEventHash)) || !/^[a-f0-9]{64}$/.test(String(item.ciphertextHash))) throw new RelayError(400, 'invalid_hash', 'Envelope hashes must be lowercase SHA-256 hex.');
  if (canonicalJson(item).length > 256_000) throw new RelayError(413, 'envelope_too_large', 'Envelope exceeds the 256 KB limit.');
}

export class RelayError extends Error {
  /** @param {number} status @param {string} code @param {string} message */
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export class RelaySpace {
  /** @param {{kind:'vault'|'group',guid:string,authorizationHash:string,maxBytes?:number,verify?:((envelope:Envelope)=>Promise<boolean>) & {challenge?:(challenge:any)=>Promise<boolean>}}} options */
  constructor(options) {
    this.kind = options.kind;
    this.guid = options.guid;
    this.authorizationHash = options.authorizationHash;
    this.maxBytes = options.maxBytes ?? 25_000_000;
    this.verify = options.verify ?? (async () => false);
    this.verifyChallenge = options.verify?.challenge ?? (async () => false);
    /** @type {Array<{envelope:Envelope,receipt:Receipt,bytes:number}>} */ this.records = [];
    /** @type {Map<string,{envelopeHash:string,receipt:Receipt}>} */ this.operations = new Map();
    /** @type {Map<string,{counter:number,envelopeHash:string}>} */ this.deviceHeads = new Map();
    this.canonicalHash = '0'.repeat(64);
    this.bytes = 0;
    /** @type {Map<string,number>} */ this.sessions = new Map();
    /** @type {Set<string>} */ this.challengeNonces = new Set();
  }

  status() {
    return { kind: this.kind, guid: this.guid, head: this.records.length, canonicalHash: this.canonicalHash, authorizationHash: this.authorizationHash, bytes: this.bytes, maxBytes: this.maxBytes };
  }

  /** @param {{deviceGuid:string,timestamp:number,nonce:string,signature:string}} challenge */
  async handshake(challenge) {
    if (!challenge || !Number.isSafeInteger(challenge.timestamp) || Math.abs(Date.now() - challenge.timestamp) > 300_000) throw new RelayError(401, 'stale_challenge', 'Signed challenge is outside the five-minute acceptance window.');
    if (this.challengeNonces.has(challenge.nonce)) throw new RelayError(409, 'challenge_replay', 'Signed challenge nonce was already used.');
    if (!(await this.verifyChallenge(challenge))) throw new RelayError(401, 'invalid_challenge', 'Signed device challenge was rejected.');
    this.challengeNonces.add(challenge.nonce);
    if (this.challengeNonces.size > 2_000) this.challengeNonces.delete(this.challengeNonces.values().next().value);
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
    const expiresAt = Date.now() + 900_000;
    this.sessions.set(token, expiresAt);
    return { ...this.status(), token, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** @param {string} token */
  authorize(token) {
    const expiresAt = this.sessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) { if (token) this.sessions.delete(token); return false; }
    return true;
  }

  /** @param {number} after @param {number} [limit] */
  pull(after, limit = 200) {
    if (!Number.isSafeInteger(after) || after < 0) throw new RelayError(400, 'invalid_cursor', 'Cursor must be a non-negative integer.');
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    return { ...this.status(), records: this.records.slice(after, after + safeLimit).map(record => ({ envelope: record.envelope, receipt: record.receipt })) };
  }

  /** @param {Envelope[]} envelopes */
  async push(envelopes) {
    if (!Array.isArray(envelopes) || !envelopes.length || envelopes.length > 100) throw new RelayError(400, 'invalid_batch', 'Push requires 1–100 envelopes.');
    const staged = [];
    let stagedBytes = 0;
    const seen = new Set();
    const stagedDeviceHeads = new Map(this.deviceHeads);
    for (const envelope of envelopes) {
      validateEnvelope(envelope, this.kind, this.guid);
      const envelopeHash = await sha256(canonicalJson(envelope));
      const previous = this.operations.get(envelope.operationId);
      if (previous) {
        if (previous.envelopeHash !== envelopeHash) throw new RelayError(409, 'operation_reuse', 'Operation ID was reused with different bytes.');
        staged.push({ existing: previous.receipt });
        continue;
      }
      if (seen.has(envelope.operationId)) throw new RelayError(409, 'duplicate_batch_operation', 'An operation may appear only once in a Push batch.');
      seen.add(envelope.operationId);
      if (await sha256(envelope.ciphertext) !== envelope.ciphertextHash) throw new RelayError(400, 'ciphertext_hash_mismatch', 'Ciphertext hash does not match the encrypted payload.');
      const deviceHead = stagedDeviceHeads.get(envelope.actorDeviceGuid);
      const expectedCounter = (deviceHead?.counter ?? 0) + 1;
      const expectedPriorHash = deviceHead?.envelopeHash ?? '0'.repeat(64);
      if (envelope.actorCounter !== expectedCounter || envelope.priorDeviceEventHash !== expectedPriorHash) {
        throw new RelayError(409, 'device_chain_conflict', 'Device counter or prior event hash does not extend the accepted chain.');
      }
      if (envelope.basedOnCanonicalSequence > this.records.length) throw new RelayError(409, 'future_base', 'Operation is based on a canonical sequence the relay has not assigned.');
      if (!(await this.verify(envelope))) throw new RelayError(403, 'invalid_signature', 'Envelope signature was rejected.');
      const bytes = encoder.encode(canonicalJson(envelope)).byteLength;
      stagedBytes += bytes;
      staged.push({ envelope: structuredClone(envelope), envelopeHash, bytes });
      stagedDeviceHeads.set(envelope.actorDeviceGuid, { counter: envelope.actorCounter, envelopeHash });
    }
    if (this.bytes + stagedBytes > this.maxBytes) throw new RelayError(507, 'quota_exhausted', 'Hosted replica is full; local work must remain queued.');
    /** @type {Receipt[]} */ const receipts = [];
    for (const item of staged) {
      if (item.existing) { receipts.push(item.existing); continue; }
      const sequence = this.records.length + 1;
      const canonicalHash = await sha256(`${this.canonicalHash}:${item.envelopeHash}:${sequence}`);
      const receipt = { boundaryKind: this.kind, boundaryGuid: this.guid, canonicalSequence: sequence, operationId: item.envelope.operationId, previousCanonicalHash: this.canonicalHash, envelopeHash: item.envelopeHash, authorizationHash: this.authorizationHash, receivedAt: new Date().toISOString(), canonicalHash };
      this.records.push({ envelope: item.envelope, receipt, bytes: item.bytes });
      this.operations.set(item.envelope.operationId, { envelopeHash: item.envelopeHash, receipt });
      this.deviceHeads.set(item.envelope.actorDeviceGuid, { counter: item.envelope.actorCounter, envelopeHash: item.envelopeHash });
      this.canonicalHash = canonicalHash;
      this.bytes += item.bytes;
      receipts.push(receipt);
    }
    return { ...this.status(), receipts };
  }
}

export class RelayRegistry {
  /** @param {{verify?:(envelope:Envelope)=>Promise<boolean>}} [options] */
  constructor(options = {}) { /** @type {Map<string,RelaySpace>} */ this.spaces = new Map(); this.verify = options.verify; }
  key(kind, guid) { return `${kind}:${guid}`; }
  /** @param {'vault'|'group'} kind @param {string} guid @param {string} authorizationHash @param {number} [maxBytes] @param {(envelope:Envelope)=>Promise<boolean>} [verify] */
  create(kind, guid, authorizationHash, maxBytes, verify = this.verify) {
    if (!['vault','group'].includes(kind) || !/^[a-zA-Z0-9-]{8,128}$/.test(guid)) throw new RelayError(400, 'invalid_boundary', 'Boundary kind or GUID is invalid.');
    if (!/^[a-f0-9]{64}$/.test(authorizationHash)) throw new RelayError(400, 'invalid_authorization_hash', 'Authorization genesis hash must be lowercase SHA-256 hex.');
    if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_000_000_000)) throw new RelayError(400, 'invalid_quota', 'Space quota must be a positive integer no larger than 1 GB.');
    const key = this.key(kind, guid);
    const existing = this.spaces.get(key);
    if (existing) {
      if (existing.authorizationHash !== authorizationHash) throw new RelayError(409, 'boundary_exists', 'Boundary already exists with a different authorization genesis.');
      return existing;
    }
    const space = new RelaySpace({ kind, guid, authorizationHash, maxBytes, verify });
    this.spaces.set(key, space);
    return space;
  }
  /** @param {'vault'|'group'} kind @param {string} guid @param {string} authorizationHash @param {Authorization} authorization @param {number} [maxBytes] */
  async createSecure(kind, guid, authorizationHash, authorization, maxBytes) {
    const existing = this.spaces.get(this.key(kind, guid));
    if (existing) return this.create(kind, guid, authorizationHash, maxBytes);
    const verify = await authorizationVerifier(authorization, kind, guid, authorizationHash);
    return this.create(kind, guid, authorizationHash, maxBytes, verify);
  }
  get(kind, guid) {
    const space = this.spaces.get(this.key(kind, guid));
    if (!space) throw new RelayError(404, 'not_found', 'Synchronization boundary was not found.');
    return space;
  }
  delete(kind, guid) { return this.spaces.delete(this.key(kind, guid)); }
}
