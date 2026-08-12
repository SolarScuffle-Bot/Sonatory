# Sonatory Synchronization Protocol

**Status:** Final Draft supporting authority  
**Protocol family:** `sonatory-sync` (independently versioned)  
**Authoritative product contract:** [FINAL-DRAFT-SPEC.md](FINAL-DRAFT-SPEC.md)

This protocol provides a canonical source of ordering for an encrypted personal Vault replica or shared Group data without making the network a prerequisite for local use. The relay coordinates and stores ciphertext; every authorized device keeps a usable local replica.

## 1. Guarantees and deliberate limits

The protocol guarantees:

- immediate local commands when locally authorized and policy freshness permits;
- durable offline outbox and deterministic later reconciliation;
- one canonical sequence per synchronized Vault or Group boundary at the configured relay;
- authenticated actors/devices and signed permission manifests;
- end-to-end encrypted personal-Vault and Group content and snapshots;
- explicit preservation of rejected, conflicting, and offline-private work;
- replaceable Cloudflare or custom relay implementations;
- hard-free operation: exhaustion pauses remote sync rather than billing or blocking local access.

It does not guarantee:

- availability while every replica containing desired data is offline;
- erasure from copies another member already downloaded;
- that a revoked member forgets prior plaintext;
- live multi-user keystroke co-editing of a Notes field;
- semantic enforcement by a relay that cannot decrypt payloads;
- unlimited official hosting capacity or permanence.

## 2. Actors, devices, synchronization boundaries, and relays

A **Vault root** is the user principal. A **device key** is authorized by a Vault-root signature and performs routine protocol actions. Multiple Vault folders intentionally act as different users even if operated by the same person.

A **synchronization boundary** is either:

- a **personal Vault space**, controlled only by that Vault root and its authorized devices; or
- a **Group space**, controlled by the Group’s signed permission manifest.

Each boundary has a stable kind/GUID, relay configuration, content-key epochs, canonical sequence, and encrypted checkpoints. A personal Vault space does not create a Group, membership list, Party, Character, or Container.

A **Group** has:

- a stable Group GUID;
- a configured relay identifier and protocol endpoint;
- a signed `PermissionManifest` chain;
- monotonically increasing policy and content-key epochs;
- one canonical event sequence;
- zero or more encrypted checkpoint snapshots;
- one or more Owners at all valid times.

A Group can migrate relays through a signed handoff record. Relay hostname/account is never identity authority.

## 3. Versioned cryptographic suite

Suite `S1` uses secure-context Web Crypto primitives available across the support baseline:

- ECDSA P-256 with SHA-256 for Vault/device signatures;
- ECDH P-256 plus HKDF-SHA-256 for member key wrapping;
- AES-256-GCM for content and key-envelope authenticated encryption;
- SHA-256 for canonical-record hashes and chains;
- `crypto.getRandomValues` for 256-bit content keys, invite secrets, and 96-bit GCM IVs.

Keys have separate signing and agreement purposes. Private keys are non-extractable in the browser working replica where platform behavior permits. A complete portable Vault backup necessarily includes an encrypted/exportable recovery representation and is therefore bearer authority.

Cipher suite IDs and canonical codecs are signed into every envelope. Unsupported suites fail closed with Export/Update guidance. No custom cryptographic primitive is invented. The suite and implementation require independent specialist review before a production security claim; Web Crypto is intentionally low-level and does not validate protocol design for us ([W3C Web Cryptography Level 2](https://www.w3.org/TR/webcrypto-2/), [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)).

For a hosted recovery envelope, the Recovery Kit supplies a random 256-bit secret. HKDF-SHA-256 with a random stored salt and a domain-separated context derives an AES-256-GCM wrapping key for the serialized Vault root recovery material. The relay stores salt, IV, suite/codec, ciphertext, and hash, but never the Kit secret. Human-memorable passwords are not substituted for this entropy in suite `S1`.

## 4. Canonical records

### 4.1 Device certificate

```text
DeviceCertificate {
  version, vaultGuid, deviceGuid,
  signingPublicKey, agreementPublicKey,
  issuedAt, optionalExpiresAt,
  rootSignature
}
```

The relay verifies the root signature and checks revocation in the current manifest. A device certificate is not proof of Group membership by itself.

### 4.2 Vault authorization

```text
VaultAuthorization {
  version, vaultGuid, authorizationRevision,
  previousAuthorizationHash,
  activeDeviceCertificateHashes[], revokedDeviceGuids[],
  contentKeyEpoch, keyEnvelopes[], issuedAt,
  rootSignature
}
```

This record controls only the personal Vault space. A valid transition is signed by the Vault root, preserves chain continuity, and wraps the current personal-space content key only to active devices. It creates no Group membership or role.

```text
RootRecoveryEnvelope {
  version, suiteId, vaultGuid,
  recoverySalt, iv, encryptedRootRecoveryMaterial,
  ciphertextHash, rootPublicKeyHash
}
```

The envelope is uploaded only after explicit hosted-backup selection and Recovery Kit acknowledgement. Opening a complete Vault folder needs neither this envelope nor the Kit. Restore verifies the recovered root public-key hash before accepting any data.

### 4.3 Permission manifest

```text
PermissionManifest {
  version, groupGuid, policyEpoch,
  previousManifestHash,
  memberEntries[{vaultGuid, deviceCertificates, roleGuid, state, joinedAtSequence}],
  roleDefinitions[{roleGuid, capabilityBits, definitionHash}],
  contentKeyEpoch, keyEnvelopes[],
  effectiveAtSequence, issuedAt,
  authorDeviceGuid, ownerSignatures[]
}
```

Manifest validation requires continuity from a trusted Group genesis, signatures sufficient under the preceding valid Owner policy, no unauthorized capability escalation, and at least one active Owner. Group disband is a separately typed Owner-signed terminal manifest/action.

### 4.4 Event envelope

```text
EventEnvelope {
  protocolVersion, suiteId, codecVersion,
  boundaryKind, boundaryGuid, operationId, actorVaultGuid, actorDeviceGuid,
  actorCounter, priorDeviceEventHash,
  basedOnCanonicalSequence, policyEpoch, contentKeyEpoch,
  capabilityClass, eventSchemaId, eventSchemaVersion,
  iv, ciphertext, ciphertextHash,
  deviceSignature
}
```

The authenticated additional data includes every clear header field through `eventSchemaVersion`. The signature covers canonical header bytes, IV, and ciphertext. For a Vault boundary, `policyEpoch` names the signed Vault device-authorization revision; for a Group boundary, it names the Group permission epoch. The relay can validate identity, authorization epoch, replay/counter rules, envelope size, declared capability class, and signature without seeing domain content.

Plaintext includes command-group ID, causal/base observations for affected fields/edges, immutable domain-event payload, undo provenance when applicable, and optional prior content hashes needed by conflict reducers.

The event-schema ID is visible metadata so the relay can enforce coarse capability classes and size/rate policy. It must not contain user text or Entity display names.

### 4.5 Canonical receipt

```text
CanonicalReceipt {
  boundaryKind, boundaryGuid, canonicalSequence, operationId,
  previousCanonicalHash, envelopeHash,
  activeManifestHash, receivedAt,
  relaySignature
}
```

The relay assigns a strictly increasing sequence in one strongly consistent transaction, stores the envelope and receipt, then acknowledges. Cloudflare’s reference deployment maps each Vault or Group synchronization boundary to a SQLite-backed Durable Object because each object combines globally addressable coordination with strongly consistent colocated storage ([Durable Objects overview](https://developers.cloudflare.com/durable-objects/)). A custom relay must provide the same single-writer sequence semantics.

Relay signatures prove which relay ordered a record; they do not replace actor signatures or make the relay a durable identity authority.

## 5. Local command path

1. The UI submits a unique command to the Vault coordinator.
2. Local authorization checks the latest valid cached manifest and its freshness.
3. The deterministic command system validates domain invariants and creates an atomic event batch.
4. Events are applied optimistically to the local branch, journaled, signed/encrypted, and committed to IndexedDB with the outbox.
5. The UI updates immediately with local/pending status when appropriate.
6. When connected, Pull runs before Push.

Personal Vault-only events do not require network/relay work when hosted backup is disabled. When the encrypted hosted replica is enabled, they use the same signed encrypted event/receipt path under a personal Vault boundary authorized by the Vault root/device chain. A Group event created after the permission cache has been offline for 30 days is recorded on a clearly identified private branch instead of being presented as accepted shared work. It may be proposed after revalidation.

## 6. Connection and reconciliation

### 6.1 Handshake

The client sends supported protocol/suite/codec versions, boundary kind/GUID, last canonical receipt/hash, current Vault-authorization or Group-manifest hash, device certificate, and a fresh signed challenge. The relay responds with negotiated versions, latest valid authorization/manifest hash, canonical head, hosted expiry/quota status, and a signed challenge response.

Mismatch rules:

- unsupported required version: stop shared mutation, keep local access, offer Update/Export;
- unknown relay identity after initial trust: require explicit verification/migration flow;
- broken manifest/receipt chain: mark **Action needed**, preserve both chains, do not auto-trust;
- device revoked: stop Push and preserve unpublished work privately;
- hosted record missing/expired: allow authorized peer/snapshot reseeding or start a newly confirmed remote history.

### 6.2 Pull

The client requests receipts/envelopes after its last verified sequence, in bounded pages. For each page it verifies:

1. relay receipt chain and boundary/protocol fields;
2. active Vault-device authorization or Group-manifest chain at that sequence;
3. actor signature and per-device hash/counter chain;
4. ciphertext hash, unique `(key epoch, IV)` pair, and authenticated decryption;
5. schema codec, capability declaration, domain validation, and invariant-safe conflict reduction.

The page applies in canonical order in one local transaction. Invalid events are quarantined and halt advancement past an integrity break; a semantically unauthorized event is retained as evidence but never applied to shared state.

### 6.3 Validate pending work

After Pull, every outbox command is re-evaluated against current content, permission manifest, and key epoch. The original intent and base observations are retained. Validation may:

- keep an event unchanged;
- deterministically transform it to a rebased event with provenance;
- split a batch into a valid proposal and private remainder only if the original command declared that safe;
- move it to a private branch with a plain explanation;
- require a focused user choice for true ambiguity.

No unpublished operation is silently discarded.

### 6.4 Push

The client re-encrypts under the current content-key epoch if needed, then sends bounded idempotent batches. The relay transaction checks operation-ID uniqueness, actor counter/hash, active Vault authorization or Group manifest, capability, epoch, quotas/rate limits, and signature; assigns canonical positions; stores; and returns receipts.

Retrying the same operation ID and identical envelope returns the existing receipt. Reuse with different bytes is an integrity error. If another client advanced the head, the relay may require another Pull–validate pass before accepting operations whose base policy or command class demands it.

### 6.5 Acknowledge

Receipts move optimistic events onto the canonical branch without replaying the user action twice. The client persists receipts, advances cursor/freshness, and later creates checkpoints according to local policy.

## 7. Conflict semantics

Canonical ordering is an audit order, not permission to use last-write-wins for every field.

| Concurrent intent | Deterministic treatment | User attention |
|---|---|---|
| Relative quantity `+n` / `-n` | Apply commutatively to the observed stack identity; guard against invalid negative result and preserve rejected remainder | Only if domain constraint prevents full result |
| Absolute quantity set | Compare base value/version; non-overlapping change applies, competing sets retain named versions | Choose value when neither intent can dominate |
| Different scalar fields | Combine | None |
| Same scalar field | Preserve both values/provenance; deterministic visible winner may be chosen for continuity | **Action needed** when the difference matters and cannot be auto-merged |
| Add/remove independent direct Tags | Set-intent with observed membership; combine independent Tags | Competing add/remove of same Tag retains intent and uses versioned policy |
| Concurrent moves | Entity has one parent; canonical valid move becomes active, losing valid destination retained as alternative | Usually nonblocking recovery action |
| Move causing containment cycle | Quarantine invalid move; keep prior valid placement | Explain and offer safe destinations |
| Delete vs later offline edit | Tombstone remains active; edit is attached to recovery branch | Restore-with-edits or discard branch |
| Notes replacements | Preserve concurrent full versions; never splice arbitrary characters | Manual compare/merge |
| Stack split/edit | Operation targets logical quantity and base structural fingerprint; rebase against intervening splits by operation provenance | Ask only when copies cannot be identified safely |
| Permission change vs offline edit | Manifest sequence decides authorization; unauthorized edit stays private | Owner/member may export or re-propose if allowed |

Conflict reducers are schema-versioned pure functions and must produce identical results across supported clients. A later reducer upgrade does not rewrite old canonical meaning without a signed migration event.

## 8. Snapshots, joins, and history access

An encrypted checkpoint snapshot includes materialized Group state, canonical head/hash, compatible schema versions, content hashes, and signer attestations. At least one authorized client validates it against replay before advertising it.

Default join flow:

1. invite is redeemed and any approval completes;
2. an Owner/authorized Manager publishes a new manifest with member device keys and join sequence;
3. current state is checkpointed and encrypted for the new content-key epoch/member;
4. new member receives current state plus canonical events from the join sequence forward;
5. earlier encrypted history/key epochs remain unavailable.

An Owner may explicitly grant earlier history, which distributes selected prior epoch keys or a separately encrypted historical archive and records that grant. Current state necessarily reflects prior actions even when prior audit history is withheld.

## 9. Key rotation and revocation

Personal Vault content keys rotate when an authorized device is revoked, after suspected exposure, and on explicit root request. The new key is wrapped to remaining active Vault devices through a root-signed `VaultAuthorization`; prior ciphertext is not automatically made unreadable to a revoked device that already possessed its old key.

Group content keys rotate:

- when a device/member with access is revoked;
- at least every 90 days for active shared Groups;
- after suspected key exposure;
- during configured relay migration if Owner policy requires it.

Rotation creates a new random content key, wraps it independently to each active authorized device agreement key, advances the epoch in a signed manifest, and uses the new epoch for all later content. It does not re-encrypt all old history by default.

A device not seen for 90 days is marked dormant and requires reauthorization/current envelopes before new Push. Dormancy is not automatic deletion. Revocation cannot retract plaintext already accessed.

## 10. Invitations

Invite links use an HTTPS application URL whose fragment contains a 256-bit random secret so normal HTTP requests and server logs do not receive it. The QR encodes the same link. The relay stores the secret hash plus Group, role, expiry, use limit, approval, pause, and revoke state.

Defaults: seven-day expiry, one use unless the inviter chooses reusable, role no higher than policy permits, and no Owner grant through an ordinary invite. Redemption proves the secret, supplies device certificates, and returns only the minimum encrypted bootstrap after authorization. Regeneration revokes the prior secret.

Human-readable short codes may be displayed/copied inline but must carry equivalent entropy or be rate-limited and paired with approval; a cosmetic low-entropy code alone is not an authentication secret.

New-device authorization uses a separate short-lived enrollment credential delivered by local QR or one-time code. The new device contributes its signing/agreement public keys; an already authorized device shows the new-device fingerprint and requires approval before the Vault root signs its certificate. Hosted Recovery-Kit restore and complete-folder open are independent fallback paths. No Group invite can authorize a Vault device.

## 11. Presence and freshness

Presence is optional, Group-scoped, ephemeral, and not journaled as last-seen history. Clients may publish coarse online/editing state with short expiry. Turning it off does not affect collaboration.

Freshness domains are independent:

| Domain | Current when | Stale behavior |
|---|---|---|
| Content | canonical head recently checked | local work queues; normal offline indicator |
| Permissions | valid manifest checked within 30 days | shared edits become private proposals until revalidated |
| Managed source | configured source revision checked | existing data remains usable; show source update state |
| Backup | selected backup target confirms checkpoint/journal | warn without blocking local work |
| Application | shell version checked | offline app continues; update check waits |

User-visible states remain **Current**, **Waiting**, **Connection needed**, and **Action needed**. Technical domains appear in detail only when useful.

## 12. Quotas, expiry, and hard-free hosting

The official reference relay uses only resources enabled on Cloudflare’s free plan and ships with billing-incurring bindings/configuration absent. Current Cloudflare documentation says free-plan Durable Object operations fail after a free-tier limit is exceeded rather than automatically converting that usage into paid service ([Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). Sonatory nevertheless treats provider terms and limits as deploy-time inputs, not timeless constants.

The official deployment may invoke Cloudflare Turnstile only for expensive new hosted allocations or a suspicious abuse-sensitive action. It is not part of ordinary opening, editing, Pull, Push, or search. The UI explains the check if it becomes visible. Custom relays may disable it while retaining signature, authorization, replay, rate, and resource validation.

The client:

- batches, compresses, and checkpoints responsibly;
- displays remote usage/expiry when reported;
- stops retry storms with exponential backoff and jitter;
- leaves rejected quota work safely in the local outbox;
- offers export, custom relay, peer reseed, or wait-for-reset choices;
- never blocks the local Vault or asks a normal user to understand relay internals.

Official hosted personal-Vault or Group data expires after 12 months without authenticated activity in that boundary. When the app is opened and the relay is reachable, warnings begin 90 days before expiry. Expiry deletes that hosted encrypted replica and, for a Group, its invites according to policy; local device/member copies remain. Merely loading a public page does not reset expiry.

## 13. Relay API surface

The protocol can use HTTP plus optional WebSocket wakeups. Generic synchronization endpoints use `kind` (`vault` or `group`) and boundary GUID; invitation/member policy endpoints remain Group-specific:

- `POST /v1/spaces/{kind}` — create a Vault authorization genesis or Group genesis;
- `POST /v1/spaces/{kind}/{guid}/handshake` — negotiate and return head/status;
- `GET /v1/spaces/{kind}/{guid}/events?after=&limit=` — bounded canonical Pull;
- `POST /v1/spaces/{kind}/{guid}/events` — idempotent Push batch;
- `GET/PUT /v1/spaces/{kind}/{guid}/authorizations/...` — Vault authorization or Group manifest chain;
- `GET/PUT /v1/spaces/{kind}/{guid}/snapshots/...` — encrypted checkpoints;
- `POST /v1/invites/...` — create/redeem/approve/pause/revoke;
- `POST /v1/spaces/{kind}/{guid}/handoff` — relay migration record;
- `DELETE /v1/groups/{guid}` — Owner-signed disband/purge request;
- `DELETE /v1/spaces/vault/{guid}` — Vault-root-signed hosted-copy purge request;
- optional WebSocket/SSE — head-change and presence hints only.

All mutations use bounded bodies, authenticated challenges, request IDs, idempotency, rate limits, and strict origin/content-type handling. Polling remains a functional fallback; wakeups are never authority.

## 14. Relay migration and recovery

The Vault root for a personal boundary, or Owners for a Group boundary, export the verified canonical envelopes, authorization/manifest chain, snapshots, and receipts; configure the new endpoint; seed it; verify head/hash; then sign a handoff naming both relay identities and cutoff. Clients accept the new relay only through that chain or explicit out-of-band confirmation by the applicable authority.

If the old relay disappears, authorized devices compare verified heads. The longest valid canonical receipt chain is proposed, divergent valid local branches remain visible, and Owners sign a recovery genesis at a new relay. No device’s unpublished work is discarded.

## 15. Protocol conformance tests

- identical operation retry is idempotent; altered reuse fails.
- canonical sequences are gap-free and never double-assigned under concurrency.
- per-device counters/hash chains detect replay and omission.
- Pull interruption at every record boundary resumes without duplicate application.
- encryption/authentication failure exposes no plaintext and does not advance cursor.
- manifest rules prevent zero Owners, ordinary Owner invites, and revoked-device Push.
- 31-day-offline shared edits remain private until permission revalidation.
- every conflict row above has commutative/permutation and recovery tests.
- join-point members cannot decrypt earlier event history without explicit grant.
- quota/expiry/network failure never blocks local access or loses the outbox.
- Cloudflare and custom reference relays pass the same black-box suite.
