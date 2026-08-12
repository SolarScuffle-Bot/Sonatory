# Sonatory Architecture

**Status:** Final Draft supporting authority  
**Authoritative product contract:** [FINAL-DRAFT-SPEC.md](FINAL-DRAFT-SPEC.md)  
**Scope:** implementation boundaries, execution order, extension points, and operational constraints

If this document conflicts with the product contract, the product contract wins. Architecture must be changed rather than silently weakening a requirement.

## 1. Architectural shape

Sonatory is one local-first browser application with optional collaboration services:

```text
Input adapters       DOM events, file picker, folder watcher, worker messages,
                     service worker, BroadcastChannel, network responses
        │
        ▼ enqueue only
Command/event queue  validated, immutable intent records
        │
        ▼
Deterministic world  ECS storage + ordered systems + journal + derived indexes
        │                         │
        │                         ├── IndexedDB working replica
        │                         ├── optional Vault folder mirror
        │                         ├── optional encrypted relay journal
        │                         └── export/archive snapshots
        ▼
Projection layer     keyed semantic-DOM patches, accessibility state, workers
```

The browser world is treated like a game simulation rendered to HTML: outside callbacks do not mutate durable state or the DOM directly. They enqueue work for a defined phase. The scheduler sleeps when no work, timer, animation, or transport deadline is pending.

The production client remains a static application. The official optional relay is a separate, replaceable Cloudflare Worker/Durable Object deployment. A custom relay implements the same versioned protocol.

## 2. Source layout and module boundaries

The implementation should converge on these plain-ES-module packages. Exact filenames may evolve; dependency direction may not be inverted casually.

| Module | Owns | Must not own |
|---|---|---|
| `kernel` | scheduler, phases, clocks, queues, capability registration, diagnostics | domain rules or DOM markup |
| `ecs` | Entity allocation, archetypes, component columns, sparse pairs, queries, change sets | inventory semantics |
| `schema` | stable component/operator/event identifiers, codecs, validators, migrations | UI state |
| `journal` | append, signing, hashes, checkpoints, replay, branches, undo metadata | relay transport |
| `domain` | Tags, Containers, stacks, weight, Collections, Groups, permissions | browser APIs |
| `search` | parser, token model, operator registry, AST, indexes, query plans | panel layout |
| `commands` | user-intent validation and atomic event production | direct storage/DOM writes |
| `projection` | view models, keyed DOM patching, focus restoration, localization-safe text | durable mutation |
| `panels` | window-manager layout, navigation/back stack, panel registrations | domain persistence |
| `storage` | IndexedDB, folder mirror, archive import/export, blob store | conflict policy |
| `sync` | protocol, transport, canonical positions, retries, freshness | plaintext synchronized Vault/Group content at relay |
| `security` | keys, signatures, encryption envelopes, capability checks | product authorization policy by itself |
| `workers` | PDF parse, image normalization, hashing, compaction, large query work | unsynchronized world mutation |
| `service-worker` | app-shell cache and safe update discovery | durable user data authority |
| `adapters` | managed sources, importer profiles, relay connectors | arbitrary third-party scripts |

There is no global mutable application singleton exposed to feature modules. A bootstrap composition root creates scoped services, registers built-ins, validates version compatibility, and starts the coordinator.

## 3. Deterministic execution

### 3.1 Frame phases

One coordinator advances these phases in order:

1. **Collect** — drain queued browser, worker, storage, and transport messages into a fixed batch.
2. **Decode** — parse and schema-validate without mutating the world.
3. **Authorize** — evaluate local capabilities and applicable signed Group policy.
4. **Command** — turn accepted user intent into atomic durable events.
5. **Apply** — order accepted events and mutate ECS columns/pairs through journal reducers.
6. **Derive** — update indexes, Merkle fingerprints, weights, permissions, and query results from change sets.
7. **Persist** — commit journal, materialized state, and outbox atomically to IndexedDB.
8. **Project** — compute dirty view models and patch only affected semantic DOM regions.
9. **Effects** — dispatch workers, folder writes, downloads, notifications, and network work already authorized by the committed state.
10. **Idle** — publish diagnostics, schedule the next real deadline, and sleep.

An event observed during a phase enters the next eligible frame. Re-entrant state mutation is forbidden.

### 3.2 System declarations

Every system registers:

- stable system ID and version;
- phase;
- component/pair/index resources read and written;
- explicit `before`/`after` constraints only where resource ordering is insufficient;
- deterministic or explicitly effectful classification;
- budget class and incremental cursor strategy.

Bootstrap topologically sorts systems, rejects cycles and undeclared write conflicts, and emits the resolved schedule in diagnostics. Deterministic systems receive a logical clock and seeded operation context, never wall time or ambient randomness.

### 3.3 Atomicity and failure

A command produces either one valid event batch or no durable change. Apply and derived computation operate on a staging change set. Persist commits the journal tail, materialized ECS deltas, index deltas, outbox, and last-good marker in one IndexedDB transaction. Only then may projection/effects observe the new state.

If a system throws, its frame is abandoned before commit, the last coherent world stays visible, unsafe effects remain undispatched, and diagnostics identify the system and input. If IndexedDB persistence fails, the identified command/event batch remains in an in-memory recovery buffer, is never published to cloud, and can be retried or exported without a false **Saved locally** state. Repeated poison inputs are quarantined with an exportable report.

## 4. ECS runtime

The ECS follows the normative model in [DATA-MODEL.md](DATA-MODEL.md):

- persistent 128-bit GUIDs are the durable identity and interchange format;
- dense runtime Entity IDs are session-local and may be recycled with generations;
- component definitions are themselves Entities;
- Tags are data-less component Entities;
- data components live in archetype-oriented structure-of-arrays columns;
- entity-to-entity predicates use sparse pairs only where justified, including explicit Collection membership that would otherwise embed Entity lists;
- no implicit Tag inheritance or effective-Tag traversal exists.

Its design references are JECS for archetype/query mechanics and compact API discipline, hardlyardi’s b226 for components-as-Entities ergonomics, and Flecs for pair/query semantics. These are behavioral references, not production runtime dependencies. Sonatory deliberately omits Flecs-style implicit hierarchy/transitive features that conflict with exact direct Tags and sparse relationships. Any source translated rather than independently reimplemented retains its applicable license notice and attribution; [Flecs relationship documentation](https://www.flecs.dev/flecs/md_docs_2Relationships.html) remains a semantic reference, not an imported library.

Archetype transitions are batched during Apply. Queries cache positive, negative, optional, and sparse-pair terms against matching archetypes/indexes, then consume change sets instead of rescanning the world. Purge cleans pairs whose subject or target disappears; tombstoned Entities retain repairable references. GUID resolution has a single indexed map; serialized component values never contain dense Entity IDs.

User-defined Tags and numeric fields extend the data model, not executable code. Built-ins are ordinary versioned definitions with reserved stable GUIDs and protected structural invariants.

## 5. Journal and materialized state

The signed append-only journal is the durable behavioral truth. The ECS is a replayable materialization. Each accepted event contains a versioned type, stable actor/device identity, logical operation ID, causal basis, payload, and integrity envelope as defined by [SYNC-PROTOCOL.md](SYNC-PROTOCOL.md).

Checkpoints contain:

- compatible schema and reducer versions;
- canonical position plus private-branch heads;
- ECS component/pair columns;
- derived-index rebuild markers, not unauditable authority;
- journal-chain hash and checkpoint content hash.

Checkpoints accelerate load but never truncate user-visible history. History segments may be compressed and moved to colder local storage while remaining restorable. Replay tests compare state hashes across current and supported migration versions.

Undo and redo append inverse/compensating events; they do not mutate or delete history.

## 6. Storage tiers

### 6.1 IndexedDB working replica

IndexedDB is the active store because it supports atomic transactions and works without a chosen folder. Databases are partitioned by Vault GUID. Recommended stores are:

- manifest and local settings;
- journal segments and branch metadata;
- materialized component/pair pages;
- derived indexes;
- content-addressed blobs and thumbnails;
- outbox/inbox/quarantine;
- checkpoint index and recovery markers.

Storage persistence is requested when supported. The application monitors quota, warns before eviction risk, and always keeps Export/Back Up reachable.

### 6.2 Vault folder mirror

The optional user-chosen folder is a complete, portable bearer copy. A folder adapter writes versioned manifests, encrypted or plaintext journal/checkpoint files according to the user’s backup choice, and content-addressed assets. Writes use a temporary sibling plus validated replacement where the File System Access API permits it. A hash manifest detects partial or external changes.

The browser never assumes permanent folder permission. Losing the handle pauses mirroring without blocking the working replica. Opening a valid folder reconciles by operation IDs and hashes. A non-empty folder without valid Vault metadata is rejected as a Vault target without modifying it.

### 6.3 Relay replica

The relay stores encrypted personal-Vault or Group journal envelopes, boundary-appropriate signed identity/policy/key records, invitation state for Groups, canonical sequence positions, encrypted snapshots, and minimal operational metadata. A personal Vault stream is authorized by the Vault root/device chain; it is not an implicit Group. The relay is a coordinator and optional remote replica, not a prerequisite for local use. Quota failures remain in the outbox and present **Waiting** or **Connection needed**; they never turn into a paid charge.

For cloud-only recovery, the relay may store a root recovery envelope encrypted by the high-entropy secret in the user’s Recovery Kit. It never receives the secret or plaintext root key. Existing-device enrollment, complete-folder open, and Recovery-Kit restore all converge on the same Vault identity; passkeys are optional local convenience only.

### 6.4 Export and archive

Exports are self-describing versioned graph snapshots with stable GUIDs, provenance, schema versions, hashes, and referenced blobs. Import always stages a dry-run plan before mutation. Full Vault archives include sufficient identity material only after an explicit warning that possession grants identity.

## 7. Multi-tab coordination

Exactly one tab per Vault is the coordinator. Preferred election uses Web Locks; fallback uses a renewable IndexedDB lease with generation fencing. BroadcastChannel carries wakeups, committed positions, and focus-safe UI notifications, not authoritative state.

Non-coordinator tabs submit commands with unique IDs and render committed changes. On coordinator loss, a successor validates the last-good marker, increments the fence, recovers any committed outbox entries, and resumes. An old coordinator whose fence is stale cannot commit.

Background tabs stop visual animation/render scheduling. The coordinator may continue bounded persistence/synchronization; a returning tab catches up from committed positions before claiming **Current**.

## 8. Rendering and panels

The projection layer outputs semantic view models keyed by stable GUID or view-instance ID. The DOM patcher:

- reuses keyed elements and never reorders selected tabs as a side effect of focus;
- preserves native focused input, selection, composition, and undo state;
- updates text nodes in place when unchanged to help browser translation;
- uses native elements before ARIA-authored widgets;
- restores focus to a logical successor after close/delete;
- does not virtualize the focused or accessibility-active item away.

The panel manager solves layout from viewport size, safe areas, minimum readable panel constraints, content-size hints, and task priority. A singular panel is centered and content-sized up to available space. Multiple panels tile and resize; when constraints cannot be met they become stable-order tabs, and on narrow mobile screens they become a one-panel back stack. Panels never persist pixel coordinates as user-authored layouts.

Carousels are horizontal, flat, equal-card tracks. CSS determines cards-per-view from density tokens and available width; the controller handles snap/centering, keyboard commands, buttons, touch pan, and boundary-aware wheel translation. Motion is projection-only and disabled/reduced without changing state.

## 9. Search architecture

The search parser is an operator registry, not punctuation-specific application code. Operators define lexical trigger, accessible label, operand kind, autocomplete provider, AST codec version, query planner hook, and serializer. Saved queries store operator IDs and GUID operands.

Free text and structured tokens compile into an intersecting query plan over:

- normalized user-visible text index;
- exact direct-Tag membership index;
- exact sparse-pair target index such as `ContainedBy`;
- panel-provided locked clauses;
- current permission visibility.

Locked clauses are visible tokens omitted from editable text but included in the AST. Query results are stable-sorted with an explicit tie-breaker GUID. Parsing and autocomplete can move to a worker for large datasets; final permission filtering and selection changes occur in the deterministic world.

## 10. Derived computations and performance

Weights, recursive content fingerprints, structural equality, query results, permission reachability, and carousel projections are derived caches. Each cache declares source dependencies, version, invalidation granularity, and rebuild path.

Container aggregates propagate through the acyclic `ContainedBy` graph using a dirty ancestor queue and memoized child totals. Stack identity first compares a versioned Merkle fingerprint, then performs collision-safe structural verification before merging. Editing a shared stack member materializes only the selected logical copy and affected path.

Long tasks use bounded slices or workers and publish progress without changing final ordering. Performance gates use the datasets in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md); an optimization that changes deterministic results or keyboard/accessibility semantics is invalid.

## 11. Workers and untrusted input

PDF parsing, image decoding/normalization, archive inspection, large hashes, and optional compaction run in dedicated module workers with narrow message schemas. Workers receive blobs or immutable snapshots, return proposals/results, and cannot commit world state.

The PDF worker lazily loads the pinned vendored PDF.js build. It disables script/action execution and external navigation, enforces size/page/time budgets, and emits only the provider-neutral inventory proposal. Images are decoded, dimension-checked, re-encoded to allowed formats, and stripped of metadata before display/storage where supported.

Import, managed-source refresh, repair, destructive preview, and complex merge/diff work use isolated staging worlds or immutable worker snapshots. Their results carry the source world/journal revision and become one validated atomic event batch; stale proposals are discarded or recomputed.

## 12. Service worker and application updates

The service worker caches only versioned application-shell assets and managed-source payloads with verified hashes. It does not own the Vault database or collaboration journal. A new build downloads beside the active build and reports **Update ready**. Activation waits until all tabs report a safe point; no editing/import/migration session is forcibly reloaded.

Schema compatibility is checked before activation. If the new build cannot read the current world, activation remains blocked with Export and diagnostic options.

## 13. Extension contracts

Supported extensions register declarative capabilities through narrow versioned interfaces:

- components and Tags;
- systems with read/write/order declarations;
- queries and search operators;
- commands and event reducers;
- panels and routes;
- managed-source adapters;
- import adapters;
- relay transports;
- migrations and diagnostic inspectors.

Extensions are shipped application modules reviewed with the release; user data never supplies arbitrary JavaScript. Unsupported interface versions fail closed with a useful compatibility report.

## 14. Observability without surveillance

Local advanced diagnostics provide scheduler timings, long frames, query/cardinality statistics, cache rebuilds, journal/outbox state, storage usage, sync freshness, relay quota, and anonymized protocol error codes. They are exportable only by explicit user action.

The official relay keeps payload-free operational logs for at most seven days unless an abuse investigation legally requires a separately documented hold. No behavioral analytics SDK or cross-site identifier is included.

## 15. Architectural release gates

Before production release:

- deterministic replay produces the same state hash across supported browsers;
- crash injection at every persistence boundary recovers to a coherent world;
- multi-tab fencing prevents dual commits;
- all extension registrations and migrations are version-checked;
- large/deep/history datasets remain interactive within agreed budgets;
- the UI passes keyboard, zoom, forced-colors, reduced-motion, and screen-reader gates;
- the collaboration cryptographic design and implementation receive independent security review.
