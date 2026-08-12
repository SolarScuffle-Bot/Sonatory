# Sonatory Implementation Plan

**Status:** Implementation in progress; the local core and implemented Stage 2–8 slices are under continuous verification  
**Authoritative product contract:** [FINAL-DRAFT-SPEC.md](FINAL-DRAFT-SPEC.md)  
**Traceability:** [ACCEPTANCE-MATRIX.md](ACCEPTANCE-MATRIX.md)

The user approved the Final Draft package and implementation began. Stages are vertical, demonstrable increments. A stage is complete only when its tests, accessibility evidence, recovery behavior, and mapped acceptance rows pass; a visual mock that bypasses the real model is not stage completion. Current retained exploratory evidence is indexed in [QA-EVIDENCE.md](QA-EVIDENCE.md).

## 1. Working rules

### 1.1 Runtime and repository

- Production client: static HTML, CSS, images, and plain ES modules.
- Source: strict JSDoc-typed JavaScript with `// @ts-check`; `checkJs` runs in CI.
- Production runtime: no framework, package-loader, remote module, analytics, or runtime CDN.
- Narrow exception: a pinned licensed PDF.js distribution, vendored and lazy-loaded only for D&D Beyond PDF import.
- Development dependencies may provide type checking, formatting, unit/property tests, browser automation, accessibility testing, local HTTP/TLS, fixture generation, relay emulation, and deployment tooling.
- Tests must work against an unbundled static-client development server. Any release optimization produces a reproducible manifest and must not make a bundler semantically required.

### 1.2 Definition of done for every stage

Each stage must provide:

- usable behavior through the real deterministic command/ECS/journal path;
- error, empty, loading, offline, stale, and constrained-viewport states relevant to that stage;
- automated unit/invariant/integration tests and mapped acceptance evidence;
- keyboard, pointer, and touch-equivalent behavior for introduced actions;
- translatable semantic text and no text baked into visual assets;
- no known data-loss path at its persistence boundaries;
- updated schema/protocol/interface versions and migration fixtures when applicable;
- advanced diagnostics sufficient to explain a failure without telemetry.

### 1.3 Change control

Normative product changes update `FINAL-DRAFT-SPEC.md` first, record rationale in `SPEC-DECISIONS.md`, then update support docs and acceptance rows. Architecture discoveries may refine supporting documents but cannot silently narrow product behavior. Security or legal blockers stop the affected release capability, not local core work.

## 2. Test fixtures and performance profiles

No copyrighted proprietary D&D dataset or D&D Beyond PDF is committed. Synthetic/legal SRD fixtures are deterministic and generated from documented seeds. Lawfully obtained local PDFs may live only in ignored developer directories.

### 2.1 Standard data profiles

| Profile | Deterministic contents | Purpose |
|---|---|---|
| **Everyday** | 5,000 Entities; 300 Containers; 25,000 component instances; 12,000 containment edges; depth 8; 20,000 journal events; 200 images | Common interaction, responsive layout, warm start |
| **Large** | 100,000 Entities; 10,000 Containers; 600,000 component instances; 250,000 edges; depth 32; 250,000 events; 10,000 Collections | Indexing, virtualization, incremental derivation, storage pressure |
| **Deep** | Several wide trees plus a legal containment chain depth 512; nested stack splits and moves; attempted cycles | Iterative traversal, dirty ancestors, copy-on-write, no stack overflow/exponential work |
| **Long History** | 1,000,000 mixed events with checkpoints, undo/redo, branches, schema migrations, and cold segments | History remains unlimited while startup/replay is checkpointed/resumable |
| **Multi-device** | 32 devices, 12 concurrent/offline branches, 100,000 reordered/duplicated/dropped deliveries, joins/revocations/rotations | Protocol determinism, conflicts, permissions, idempotency |
| **Adversarial** | malformed codecs; hash-collision test doubles; corrupt folders; archive/PDF/image bombs; huge text; ambiguous names; invalid signatures; hostile ordering | Fail-closed validation, recovery, bounded work, injection defense |

All counts describe test coverage, not user-visible limits. Implementations may page/cold-store data; they may not impose a product history limit to pass a benchmark.

### 2.2 Reference environments and budgets

Before Stage 9, CI records exact hardware/browser versions for a reference desktop (4 modern CPU cores, 8 GB RAM) and reference mid-range mobile device (4 GB RAM). Budgets are measured after deterministic fixture creation, at 100% browser zoom unless the test says otherwise.

| Interaction | Desktop target | Mobile target |
|---|---:|---:|
| Warm open, Everyday, to usable shell | ≤ 1.0 s p95 | ≤ 2.0 s p95 |
| Warm open, Large, from checkpoint to usable shell | ≤ 2.5 s p95 | ≤ 5.0 s p95 |
| Common local edit, Everyday, command to visible commit | ≤ 50 ms p95 | ≤ 100 ms p95 |
| Search refinement, Everyday | ≤ 50 ms p95 | ≤ 100 ms p95 |
| Search refinement, Large after index warmup | ≤ 150 ms p95 | ≤ 300 ms p95 |
| Carousel/panel interaction | no sustained long tasks; 60 Hz target where hardware permits | no sustained long tasks; native-refresh target where hardware permits |
| Coordinator recovery after tab loss | ≤ 2 s plus platform lease timeout | ≤ 3 s plus platform lease timeout |

A feature may show progressive, cancellable work beyond a budget; it may not freeze input, lose focus, or present incomplete state as complete. Performance regressions require a recorded explanation and approval, not quieter tests.

## 3. Stage sequence

## Stage 0 — Foundation and executable contracts

**Goal:** a dependency-light static shell with enforceable code, test, schema, accessibility, and release rules.

Deliver:

- repository layout matching [ARCHITECTURE.md](ARCHITECTURE.md);
- static semantic application shell and development server configuration;
- strict JSDoc `checkJs`, lint/format boundaries, unit/property/browser/accessibility test runners;
- stable ID/schema registries, canonical codec primitives, exact-decimal primitive, deterministic RNG/test clock interfaces;
- capability/extension registration and compatibility validation skeleton;
- generated legal/synthetic fixtures and test-profile builders;
- secure headers/CSP development assertions and reproducible release manifest;
- CI gates for tests, type checks, licenses, secrets, broken links, and acceptance evidence index.

Exit gate:

- supported browsers load the same static modules with JavaScript disabled/failed state explained;
- canonical GUID/decimal/codec vectors match across browsers;
- no undeclared production dependency/network request exists;
- baseline semantic/keyboard/200%/400% zoom smoke tests pass.

## Stage 1 — ECS, scheduler, journal, and replay

**Goal:** establish deterministic durable state before building domain UI.

Deliver:

- GUID-to-dense-ID generational mapping;
- archetype/SoA component columns and component-definitions-as-Entities;
- documented JECS/b226/Flecs reference mapping and applicable source-license attribution for any translated code;
- data-less exact Tags and sparse pair storage/query indexes;
- changed-Entity/query change sets;
- declared ordered phase scheduler, event queues, idle sleep, diagnostics;
- immutable event registry/reducers, branches, append-only history, compensating Undo/Redo;
- canonical hashes, atomic materialization/checkpoints, replay/rebuild/migration harness;
- multi-tab coordinator election and generation fencing.

Exit gate:

- permutation/replay produces identical state hashes in every supported browser;
- scheduler rejects cycles/undeclared conflicting writes;
- crash injection across all commit points restores the last coherent world;
- two tabs cannot commit as coordinator under forced lease races;
- Long History loads from checkpoints without loading the entire journal into memory.

## Stage 2 — Vault identity, local storage, and portability

**Goal:** a user can create/open/use/recover multiple persistent identities entirely locally.

Deliver:

- one-panel first-run setup with visible defaults: display name, optional image, Vault create/open choice;
- recent cached Vault direct-open and Vault switcher;
- explicit opt-in recommended hosted backing, no email/phone identity dependency, and contextual offline recovery help;
- IndexedDB working replica, persistence/quota status, blob store;
- optional File System Access folder mirror, valid metadata recognition, external-change reconciliation;
- Vault root/device GUIDs and keys; folder-possession warning; Clone as New;
- hosted-backup Recovery Kit/encrypted root envelope, existing-device QR/one-time enrollment, and optional passkey convenience;
- complete/selected export, archive integrity verification, dry-run import and collision plan;
- backup freshness/status, safe folder permission loss, corrupt/partial mirror recovery.

Exit gate:

- clearing browser storage is recoverable from a valid Vault folder/archive;
- a copied folder preserves identity only through explicit Open; Clone as New changes all identity authority;
- hosted-only restore requires and verifies its Recovery Kit, while a complete folder restores without one;
- a non-empty non-Vault folder is never modified;
- browser-only use remains fully functional without folder/cloud;
- profile initials update from changed display name when no image.

## Stage 3 — Responsive UI shell and panel manager

**Goal:** the real application shell efficiently uses phones through huge displays.

Deliver:

- short header, stable recent tabs, global search entry, visible Undo/Redo, profile/Vault access;
- navigation routes and contextual `+` command;
- panel registrations, content-size constraints, focus restoration, tiled/tabbed/mobile back-stack manager;
- density/theme/hue/motion settings and semantic CSS design tokens;
- flat equal-card carousel primitive with centering, controls, touch, keyboard, boundary-aware wheel, reduced motion;
- responsive Container-card primitive, chips, optional square left images, overflow disclosure;
- searchable offline help and contextual Why? explanations without a forced tour/checklist;
- forced-colors, high zoom, coarse-pointer, safe-area, and browser-translation behavior.

Exit gate:

- viewport matrix includes phone portrait/landscape, square, portrait monitor, 1920×1080, ultrawide, and TV-sized viewport at multiple zoom levels;
- a singular panel is centered/content-sized; multi-panel layouts never force required controls offscreen;
- carousel is never a grid/overlapped/3D and every card has equal track dimensions;
- at 1920×1080, targets are ~6/~8/~10 horizontal cards for Spacious/Normal/Compact and ~2/~2/~3 complete carousel sections;
- functional text/control metrics meet the accessibility contract with no clipped localized stress strings.

## Stage 4 — Inventory, Containers, stacks, and managed defaults

**Goal:** complete local inventory use through the generalized ECS model.

Deliver:

- Container workspace and item preview grid/list panel variants required by context;
- create/edit/delete/restore Item, Container, Tag, Character Tag, Party Tag;
- optional image and square-left previews; quantities inside cards; total Weight contribution;
- `ContainedBy` move/link, cycle prevention, recursive exact Weight, dirty-ancestor cache;
- Container-as-Item nesting, stack split/edit/merge, lazy copy-on-write and collision-safe structural equality;
- custom numeric fields without formulas/units;
- data-defined Item Source tiles: Unique, Custom, Item, Created, D&D, `+`;
- SRD-only managed source, overlay/suppress/detach/reset/compare and provenance.

Exit gate:

- the chest/two-bags/two-swords scenario splits, diverges, re-equalizes, and re-stacks correctly at arbitrary legal depth;
- recursive insertion is gently rejected before mutation and malicious imported cycles quarantine;
- incremental/full Weight results match exact decimals;
- cards never show an Icon field, image placeholder, or overflowed tags;
- managed refresh never overwrites an override or revives a suppressed Entity silently.

## Stage 5 — Search, Collections, actions, and activity

**Goal:** fast browser-like discovery and low-click contextual workflows.

Deliver:

- free-text search plus accessible structured-token combobox;
- quoting/escaping for literal operators and the visible global-search-equivalent `Ctrl+K`/`Cmd+K` accelerator;
- modular versioned `+`, `-`, `=` operators with GUID operands and disambiguating autocomplete;
- direct exact-Tag and direct-Container indexes; visible locked/baked panel tokens;
- saved query AST, explicit selection Collections, missing-reference repair;
- click/keyboard chips that navigate to their target;
- contextual single/bulk actions and direct card actions with ellipsis fallback only when constrained;
- current result count, stable selection, no surprise hidden-scope action;
- Activity summaries, filters, actor/entity links, Undo relationship, non-spam notifications.

Exit gate:

- operator truth tables prove direct—not effective/inherited—Tag semantics;
- ambiguous duplicate names bind through chosen GUID and remain stable after rename;
- Tag Manager’s locked `+Tag` cannot be removed yet is visibly explained;
- search/action latency meets Everyday/Large budgets;
- all pointer selection/action workflows have keyboard/touch equivalents.

## Stage 6 — Sync protocol and encrypted reference relay

**Goal:** deterministic encrypted multi-device convergence without weakening offline ownership.

Deliver:

- versioned Web Crypto suite, certificates, encrypted event envelopes, signatures, key envelopes;
- durable Pull–validate–Push outbox/inbox, receipts, snapshots, idempotency, backoff;
- Cloudflare Worker plus one SQLite-backed Durable Object per Vault/Group synchronization boundary, configured hard-free;
- custom/local relay reference implementing the same black-box contract;
- expensive-allocation/suspicious-action-only optional Turnstile gate, absent from routine sync;
- all conflict reducers, quarantine, private/rejected branch preservation;
- independent content/permission/source/backup/app freshness;
- quota, overload, loss, hosted-expiry, and relay-migration recovery;
- protocol/fault/fuzz test harness over Multi-device and Adversarial profiles.

Exit gate:

- offline/concurrent permutations converge to the same state and retain every losing intent;
- relay never receives synchronized Vault/Group plaintext and cross-boundary isolation tests pass;
- quota exhaustion causes **Waiting** without billing configuration, retry storm, local block, or data loss;
- 12-month inactivity/90-day warning is simulated and recoverable from peers/local export;
- independent security review of the design is commissioned before shipping collaboration publicly.

## Stage 7 — Groups, friends, invitations, and permissions

**Goal:** understandable collaboration built on the protocol and general Tag/ECS system.

Deliver:

- Group creation without Container creation; Group-owned Entity creation;
- Join a Group above Friends & Members; Friends, members, Groups, and Create Group views;
- member expansion owner-first and ellipsis permission entry;
- Viewer/Editor/Manager/Owner and custom role Tags backed by signed policy;
- inherited boundary permissions, visible exceptions, no unauthorized derived/search leakage, and explained Request access states;
- multiple Owners, last-Owner invariant, Owner disband/delete;
- Discord-like invite links, inline visible code/copy, local QR, expiry/use/role/approval/pause/revoke/regenerate;
- join-point history, optional Owner earlier-history grant;
- 30-day permission freshness private branches, 90-day device dormancy/key rotation;
- optional ephemeral Group presence.

Exit gate:

- ordinary Tag editing and ordinary invite can never grant Owner;
- member removal blocks future Push/key access while truthfully stating prior copies remain;
- Group creation makes no Party/Character Container, while authorized Group-owned creation works;
- invitation accessibility/security/expiry/rate-limit cases pass;
- stale unauthorized work remains private, exportable, and re-proposable rather than lost.

## Stage 8 — Import adapters, assets, and extensibility proof

**Goal:** safe provider-specific inventory import and proof that architecture generalizes.

Deliver:

- provider-neutral import-adapter contract and versioned profiles;
- Character preset options Blank / Import New / Update Existing with target chooser;
- pinned lazy PDF.js worker and recognized D&D Beyond profile detector;
- signed/versioned managed recognition and field-mapping profiles;
- inventory-only extraction, exact/alias/unique normalized matching, Unique fallback;
- dry-run and Update Existing three-way diff;
- generic graph/archive import/export and attachment policy;
- image validation/decode/re-encode/crop derivatives;
- a synthetic second adapter exercising the extension interface without promising Pathfinder support.

Exit gate:

- unsupported PDFs are rejected before partial mutation with a precise, graceful warning;
- original PDFs are never uploaded/retained absent explicit attach;
- malformed/bomb/script/action fixtures stay within budgets and cannot execute/navigation-launch;
- ambiguous item names do not fuzzy-match;
- second synthetic adapter requires no D&D-specific core change.

## Stage 9 — Hardening, audit, deployment, and production decision

**Goal:** turn the complete implementation into a defensible release.

Deliver:

- full acceptance-matrix evidence and unresolved-risk register;
- WCAG 2.2 AA automated/manual audit with keyboard, zoom, forced colors, reduced motion, and named screen-reader/browser matrix;
- performance profiling/budgets across all six profiles and viewport/density matrix;
- security review, fuzzing, threat-model update, remediation, incident/rollback exercise;
- legal/license/SRD attribution/product-name review;
- service-worker safe-update/migration/rollback verification;
- installable PWA metadata, offline app shell, static hosting artifact;
- hard-free Cloudflare reference deployment runbook, limit doctor, expiry/deletion job, custom-relay documentation;
- privacy, metadata, retention, backup, deletion, and recovery user documentation.

Exit gate:

- every acceptance row is Pass with linked evidence, or an explicitly approved release-blocking deferral means the product is not called production-complete;
- no Critical/High unresolved security or data-loss issue;
- deterministic replay/migrations pass on current and previous supported browsers;
- official deployment cannot incur charges without a maintainer deliberately changing configuration outside the shipped hard-free profile;
- disaster exercise restores a Vault/Group from every documented surviving-replica scenario.

## 4. Verification strategy

### 4.1 Automated layers

- **Pure unit/property tests:** exact decimal, canonical codec, parsers, reducers, conflict algebra, permission transitions, graph invariants.
- **Model tests:** compare incremental ECS/index/weight/fingerprint state to a deliberately slow reference model.
- **Replay/golden tests:** stable journals across browsers, versions, checkpoints, migrations, and crash positions.
- **Browser integration:** real IndexedDB, File System Access where available, Web Crypto, service workers, multi-tab locks, input/IME/focus.
- **Protocol contract:** one client suite against Cloudflare, local custom relay, and fault-injecting relay.
- **Accessibility:** static rules plus scripted keyboard/pointer/touch and manual assistive-technology evidence.
- **Security:** parser/protocol fuzzing, mutation, authorization matrix, CSP/injection, malicious files, dependency/build provenance.
- **Visual/responsive:** deterministic screenshots plus semantic measurements; screenshots supplement but never replace interaction tests.

### 4.2 Manual release matrix

At minimum:

- current and previous Chrome/Edge/Firefox/Safari where the platform vendor supports them;
- Windows + NVDA/Firefox and NVDA/Chrome;
- macOS + VoiceOver/Safari;
- iOS + VoiceOver/Safari;
- Android + TalkBack/Chrome;
- keyboard-only at 100%, 200%, and 400% zoom;
- forced-colors/high-contrast and reduced-motion;
- mouse, precision trackpad/wheel, coarse touch, landscape/portrait rotation;
- browser translation of representative screens and long-string/pseudo-locale stress.

Unavailable platform combinations are documented and must receive an equivalent device/service test before production-complete status.

## 5. Decision checkpoints

The user reviews demonstrable builds at the end of Stages 2, 3, 5, 7, and 8. These reviews tune presentation/workflows while preserving accepted invariants. Any proposed change to identity possession, legal dataset boundary, direct-Tag semantics, no-cycle rule, history retention, permission safety, offline ownership, or hard-free hosting returns to specification approval before implementation.

## 6. Explicitly deferred beyond Final Draft

- arbitrary user-authored scripts/formulas;
- user-designed page/window wireframes;
- weight unit definitions or conversions;
- broad Pathfinder or generic-PDF import (architecture supports later adapters);
- live character-sheet fields beyond inventory-relevant D&D Beyond extraction;
- public discovery/social directory;
- authoritative deletion from other members’ existing copies;
- paid cloud capacity, enterprise identity, or centralized password recovery;
- Tag inheritance/effective Tags or a relationship ontology.
