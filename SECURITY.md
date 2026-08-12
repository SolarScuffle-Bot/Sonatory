# Sonatory Security, Privacy, and Legal Boundaries

**Status:** Final Draft supporting authority  
**Authoritative product contract:** [FINAL-DRAFT-SPEC.md](FINAL-DRAFT-SPEC.md)

This is a design and verification contract, not a claim that an unreviewed implementation is secure. Production collaboration release requires independent cryptographic/application security review and remediation of material findings.

## 1. Protected assets

Sonatory protects:

- Vault root and device private keys;
- personal-Vault/Group content keys and invitation secrets;
- inventory, notes, images, Groups, memberships, and activity history;
- permission manifests and author identity;
- local and remote journal integrity;
- user control over export, deletion, relay choice, and managed defaults;
- availability of local work when network/relay is unavailable.

The public static application, schema identifiers, managed SRD data, protocol definitions, and public keys are not secrets.

## 2. Threat model

### 2.1 In scope

- curious or compromised relay operator reading stored/network payloads;
- network attacker modifying/replaying traffic despite HTTPS;
- malicious or revoked Group member submitting unauthorized/stale events;
- forged/tampered archives, Vault folders, managed sources, PDFs, or images;
- XSS/content injection through names, Notes, source data, SVG/HTML/PDF features;
- cross-site request abuse and invite enumeration;
- compromised/stale device keys and copied Vault folders;
- browser crash, partial storage/folder write, quota eviction, and rollback;
- supply-chain compromise of vendored/runtime dependencies;
- denial-of-service through deep graphs, decompression bombs, huge files, event floods, or pathological queries;
- accidental user deletion, wrong-target import, and misleading stale state.

### 2.2 Outside the guarantee

- malware, browser extensions, or a hostile OS reading plaintext while the Vault is open;
- a person who possesses a complete unlocked Vault folder or exported recovery secret;
- a Group member copying content they were legitimately allowed to read;
- endpoint screenshots, shoulder surfing, compromised clipboard, or physical coercion;
- permanent availability from a hard-free third-party service;
- legal advice or a warranty that user-entered copyrighted material is lawful.

The UI must not imply protection against these limits.

## 3. Identity and key custody

Vault creation generates random GUIDs and separate root signing/agreement keys in a secure context. Routine work uses independently generated device keys certified by the root. Private keys are non-extractable in IndexedDB where feasible, while explicit portable/hosted recovery serializes root recovery material encrypted by the high-entropy secret in a user-held Recovery Kit.

A valid complete Vault folder is bearer identity by design. Opening it is sufficient to act as that Vault; copying it copies authority. On first open from a new browser, Sonatory explains this and offers:

- **Open this Vault** — preserve identity and history;
- **Clone as New** — copy user data, generate new Vault/device GUIDs and root keys, strip Group authority/invite secrets unless re-invited.

The application never uploads a plaintext root private key or Recovery Kit secret. If hosted backup is selected, it uploads only the authenticated encrypted root recovery envelope needed for cloud-only restore. Folder and archive exports containing identity material are plainly labelled sensitive. Clipboard copy of recovery secrets is explicit and auto-clearing is only best-effort, never promised.

A complete Vault folder can recover identity without a Kit. Hosted recovery requires both the encrypted relay replica and the Kit; loss of either without another complete replica is unrecoverable. Existing-device QR/one-time enrollment requires explicit approval and fingerprint display. Passkeys may unlock or approve locally but are never sole recovery authority.

Device loss/revocation changes the signed Vault authorization and any affected Group manifests, rotates current personal/Group content keys, and blocks future Push. It cannot erase earlier knowledge. A user without any surviving identity-bearing replica or Recovery Kit secret cannot be “account recovered” by a centralized operator because there is no central password account.

## 4. Cryptographic controls

The versioned suite is normative in [SYNC-PROTOCOL.md](SYNC-PROTOCOL.md). Controls include:

- HTTPS for transport plus application-layer authenticated encryption for synchronized personal-Vault and Group payloads;
- distinct signing, key-agreement, and symmetric keys;
- signed device certificates, manifests, events, receipts, checkpoints, and relay migrations;
- AES-GCM additional authenticated data binding ciphertext to boundary, actor, schema, epoch, and operation headers;
- unique operation IDs and per-device counter/hash chains;
- random unique IVs tracked per key epoch; reuse is an integrity failure;
- key epochs and rewrapping on revocation/rotation;
- domain-separated HKDF contexts for content-key wrapping and future purposes;
- constant-time platform cryptography rather than handwritten primitives;
- cipher/codec identifiers and fail-closed version negotiation.

No plaintext synchronized Vault/Group content, display name, Container name, Notes, image bytes, or search terms are required at the relay. The relay necessarily sees disclosed metadata: boundary/actor/device pseudonymous GUIDs and public keys, role/capability class where applicable, event type/size/timing, canonical position, IP/TLS connection data, invite status, and quota/expiry counters. This disclosure is described in product privacy text.

Cryptographic code has known-answer, mutation, cross-browser, nonce-reuse, key-rotation, and corrupted-envelope tests. Release artifacts pin and hash reviewed sources. The security review explicitly evaluates Web Crypto use, canonical encoding, ECDSA signature representation/malleability handling, random generation, key extraction, backup encryption, and metadata leakage.

## 5. Authorization

Authority is the intersection of:

1. a valid Vault/device certificate chain;
2. active Group membership in the latest applicable signed manifest;
3. the bound role’s capability bits;
4. object ownership/scope and command-specific policy;
5. local permission freshness and canonical sequence context.

All five are checked at local command creation and again during sync acceptance/application. The relay checks what it can authenticate from clear signed headers; clients independently reject semantically invalid decrypted events.

Role Tags remain general ECS data, but the permission manifest is a protected signed policy document. An ordinary “add Owner Tag” command has no authorization effect. Manifest transitions require preceding policy authority and reject zero-Owner results. Owner grant, Group disband, earlier-history grant, relay migration, and destructive purge receive distinct command types and confirmations.

After 30 days without permission revalidation, Group edits go to a private branch. This avoids both a bad online-only default and the surprise of presenting potentially unauthorized edits as shared.

## 6. Browser application hardening

The deployed client uses:

- a restrictive Content Security Policy: default deny; same-origin pinned scripts/styles/workers; no inline/eval; constrained image/blob sources; narrowly declared connections; frame denial;
- `Trusted Types` where supported, with no feature depending on unsupported behavior;
- safe DOM APIs (`textContent`, element properties, reviewed templates), never user HTML injection;
- Subresource Integrity or build-time content hashes for immutable vendored assets where applicable;
- `Referrer-Policy: no-referrer`, MIME sniffing prevention, strict permissions policy, and secure-context feature detection;
- no third-party runtime CDN, analytics, advertising, remote font, or embedded tracker;
- sanitized, typed URL construction; external links labelled and opened without opener access;
- service-worker cache partitioning by version and no caching of authenticated relay responses as public assets.

Names and Notes are plain text. Markdown/HTML rendering is out of Final Draft. Uploaded SVG is not rendered as active SVG; it is rejected or rasterized in an isolated decoder and stored as safe output. Object URLs are scoped and revoked.

## 7. Untrusted files and imports

### 7.1 General archives

Import processing begins in a worker and enforces:

- allowlisted file types and magic-byte checks, not extension alone;
- configurable compressed/uncompressed byte, entry-count, nesting, and time budgets;
- no absolute paths, `..`, device names, symlinks, or filesystem writes from archive entry names;
- canonical schema/codec validation, hash verification, and stable-ID collision plan;
- no executable code, service worker, HTML, script, macro, or arbitrary plugin from user data;
- dry-run diff and explicit target before any world mutation.

An invalid import leaves the current Vault untouched and returns a translatable reason plus safe next actions.

### 7.2 Images

Images are optional and never an Icon field. The image pipeline validates declared/decoded dimensions and total pixels, rejects bombs/unsupported animation where budgets demand, strips metadata by decode/re-encode, normalizes to an allowlisted raster format, and makes a square-crop derivative without destroying the original safe raster unless the user chooses. Failed images show no reserved placeholder in item/chip views.

### 7.3 D&D Beyond PDF

Only the recognized D&D Beyond Export-to-PDF structural profile is accepted. The pinned vendored PDF.js build runs locally in a dedicated worker with PDF JavaScript/actions, form submission, embedded file launch, and external navigation disabled. Parsing has byte/page/object/depth/time ceilings.

The adapter extracts only agreed inventory-relevant fields. It does not upload the PDF, scrape D&D Beyond, bypass access controls, or retain the original unless the user explicitly attaches it. Generic, unofficial, flattened when structure is required, encrypted, malformed, and unrecognized PDFs fail with a specific warning and no partial import.

Proprietary PDF fixtures are not committed. Developers may use ignored, lawfully obtained local fixtures; CI uses synthetic structure-compatible fixtures and legally redistributable SRD names.

## 8. Relay and invitation hardening

The relay:

- accepts only HTTPS, strict methods/content types, and bounded bodies;
- authenticates signed challenges before synchronized Vault/Group data access;
- performs idempotency, counter/hash, manifest, capability, epoch, and signature checks transactionally;
- rate-limits by privacy-preserving combinations of endpoint, synchronization boundary/invite, and network signals;
- stores invite-secret hashes, not reusable plaintext secrets;
- avoids putting invite secrets in HTTP query/path/server logs by using URL fragments;
- returns uniform invite failures to reduce enumeration;
- isolates Vault/Group synchronization boundaries by Durable Object/storage key and tests cross-tenant access;
- applies exponential client backoff and overload responses rather than unbounded queues;
- keeps payload-free operational logs for at most seven days unless a documented abuse/legal hold applies;
- has no configuration that can silently begin paid usage in the hard-free reference deployment.

The hard-free deployment is capacity-limited and fail-closed for remote writes. Cloudflare documents current free-plan request/storage ceilings and failure on exceeding them; deployment checks must read current official limits rather than assuming the values in design notes remain stable ([Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).

Cloudflare Turnstile may protect only expensive allocation or suspicious abuse-sensitive endpoints in the official deployment. It is absent from ordinary synchronization and local use, disclosed when invoked, and not treated as identity authority. A compatible custom relay may omit it while preserving protocol controls.

Invite links default to seven days/one use, can be paused/revoked/regenerated, cannot ordinarily grant Owner, and may require approval. QR rendering is local and encodes exactly the visible invitation link.

## 9. Availability and data integrity

- Local IndexedDB is the active replica; loss of relay never locks it.
- Journal/ECS/outbox commits share one transaction and last-good marker.
- Folder writes are staged and hash-verified; partial mirrors do not replace a verified copy.
- Checkpoints are validated against journal position/hash before trust.
- Deterministic replay and full rebuild can discard corrupt derived indexes.
- Coordinator leases use generation fencing to prevent dual writers.
- Storage quota monitoring warns early and never silently evicts history by application policy.
- Managed updates are verified/versioned and preserve overlays/tombstones.
- Service-worker updates activate only at a safe point with compatible migrations.

Recovery tools default to non-destructive actions: inspect, export, clone, rebuild derived data, resume from last-good, or preserve a branch. Repair never deletes the only known copy without an additional explicit export/confirmation.

## 10. Denial-of-service budgets

Every untrusted or recursively derived operation has a budget and cancellable progress path:

- maximum file bytes, pages, decoded pixels, archive expansion ratio, and record count;
- maximum per-relay envelope/batch and invitation attempts;
- iterative rather than call-stack-recursive graph traversal;
- cycle detection and visited sets at boundaries;
- incremental dirty-ancestor weight/fingerprint recomputation;
- query-cost estimation, bounded worker slices, and virtualization that preserves accessibility;
- journal pages/checkpoints and resumable migration/compaction;
- request backoff with jitter and circuit breaking.

Budgets are based on the performance fixtures, device capability, and security testing. When a budget is exceeded, the operation stops safely, state remains unchanged, and the UI explains how to reduce/split/export the work.

## 11. Privacy defaults

- No public user, Vault, Character, Party, Container, or Group directory.
- Friends and membership are explicit; presence is optional and Group-scoped.
- No last-seen history is exposed by default.
- No ads, trackers, behavioral analytics, or remote font beacons.
- Browser/device-local personalization does not sync unless explicitly exported/selected.
- Diagnostic export is local and user-initiated, with a preview/redaction option.
- Relay metadata and retention are disclosed before enabling sync.
- Hosted content expires after 12 months of no authenticated Group activity, with a 90-day warning when the app can reach the relay.

Product copy distinguishes **Disconnect**, **Remove local copy**, **Delete**, **Disband**, and **Purge**. Purge copy states that remote member copies cannot be guaranteed erased.

## 12. Legal content boundary

The application may ship only material the project has the right to redistribute. The managed D&D source is restricted to correctly attributed SRD 5.1/5.2.1 material under its applicable license. It must not ship proprietary D&D Beyond/official-book item text, logos, trade dress, scraped data, or a mechanism intended to bypass publisher access controls.

Users can create, edit, import, remove, and share general Entities/Collections using the same model. Their ability to enter a logo or proprietary item manually does not authorize the project to prepopulate or distribute it. Import warnings place responsibility accurately without claiming rights the user may not have.

Managed-source provenance records license/source/version, supports correction/removal updates, and preserves a user’s detached local data subject to their own rights. Legal review validates attribution and product naming before public release.

## 13. Retention and deletion

| Data | Default retention/control |
|---|---|
| Local Vault | Until user removes browser/folder/archive copy or browser platform evicts it; export/backup warnings mitigate eviction |
| Personal-Vault/Group ciphertext at official relay | Until root purge, disband/Group purge, or 12 months authenticated inactivity, subject to documented operational backup deletion window |
| Relay operational logs | Payload-free, maximum seven days absent documented abuse/legal hold |
| Invite state | Until expiry/revocation plus short abuse/audit window stated by deployment policy |
| Presence | Ephemeral TTL; no historical last-seen product feature |
| Original import PDF | Not retained unless user explicitly attaches it |
| Derived thumbnails/indexes | Rebuildable; removed with their local/hosted parent data |

Deletion jobs are idempotent and auditable by opaque IDs without retaining deleted payloads. Published deployment documentation must state backup deletion windows and lawful exceptions.

## 14. Dependency and release security

The production client remains dependency-light. Any vendored dependency has a documented purpose, exact version/hash/license, update owner, vulnerability monitoring path, and removal/fallback plan. PDF.js is lazy and isolated. Dev/test tooling never becomes an undeclared runtime requirement.

Release gates include:

- reproducible/minimally trusted build and generated asset manifest;
- secret scan, dependency/license audit, SAST, and CSP test;
- protocol/parser/property fuzzing and malicious fixture suite;
- cross-browser cryptographic and migration compatibility;
- authorization matrix and cross-Group isolation tests;
- external security review of sync/key design and implementation;
- incident response, relay key rotation, and compromised-release rollback exercise;
- current Cloudflare terms/limits and SRD attribution/legal review.

Security findings are severity-triaged. A known critical/high issue affecting confidentiality, authorization, durable integrity, or cross-tenant isolation blocks collaboration production release.

## 15. User-facing safety language

Warnings are concise, specific, and placed at the decision:

- “Anyone with a complete copy of this Vault can act as this identity.”
- “This work is saved privately until permissions can be checked.”
- “The relay is full/unavailable. Your local changes are safe and waiting.”
- “Removing a member prevents future access; it cannot erase copies they already received.”
- “This file is not a recognized D&D Beyond exported PDF; nothing was imported.”
- “This action purges your selected copies and cannot guarantee deletion from other members’ devices.”

Warnings do not use dark patterns, false guarantees, or unexplained cryptographic terminology.
