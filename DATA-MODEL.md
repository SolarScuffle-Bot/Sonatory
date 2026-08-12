# Sonatory Data Model

**Status:** Final Draft supporting authority  
**Authoritative product contract:** [FINAL-DRAFT-SPEC.md](FINAL-DRAFT-SPEC.md)

This document defines durable identity, ECS semantics, built-in data, invariants, and serialization. It intentionally separates user-visible terminology from storage implementation.

## 1. Identity and primitive types

| Type | Contract |
|---|---|
| `Guid` | 128 random bits generated with a cryptographically secure RNG, encoded canonically as lowercase UUID text for interchange. Never inferred from a display name. |
| `EntityId` | Session-local dense integer plus generation. Never serialized or placed in durable component data. |
| `OperationId` | Actor/device identity plus monotonically increasing local counter and random boot nonce; globally unique without a server. |
| `ExactDecimal` | Sign, arbitrary-precision coefficient, and base-10 scale in canonical form; never IEEE-754 for durable numeric values. |
| `Instant` | UTC millisecond timestamp used for display/expiry, not causal ordering. |
| `LogicalPosition` | Canonical Group sequence or private-branch causal coordinate. |
| `ContentHash` | Version-prefixed SHA-256 digest over canonical bytes. Hashes accelerate comparison; they do not replace collision-safe verification where equality grants a merge. |

Every Entity has one durable `Guid`. The runtime maintains a one-to-one `Guid ↔ EntityId` index for the loaded world.

## 2. ECS rules

1. A component definition is an Entity with `ComponentDefinition` data.
2. A Tag is a data-less component Entity carrying the `Tag` component.
3. Applying a Tag adds that component’s presence to a target Entity.
4. Data-component values live in typed archetype columns keyed by the target Entity.
5. A component instance is not an Entity.
6. A relationship assignment is a sparse pair `(predicate Entity, target Entity)` attached to a subject Entity; the assignment is not an Entity.
7. Durable component values must not contain `EntityId` values or lists of Entity references. Use a sparse pair when an Entity-to-Entity predicate and query are actually required.
8. Tags are exact and direct. Tags on Tags are metadata about those Tag Entities, not implicit inheritance.
9. Removing a component definition that still has instances is a migration/delete operation with a dependency preview, not a blind field deletion.

## 3. Core component definitions

Stable built-in component GUIDs are assigned once in the schema registry. Names below are symbolic; display labels are editable/localizable without changing identity.

### 3.1 Universal and presentation data

| Component | Fields | Invariant |
|---|---|---|
| `EntityMeta` | created operation, last-changing operation, tombstone state | Exists on every durable Entity. |
| `DisplayName` | plain Unicode string | User-visible, non-unique, trimmed only for validation; identity remains GUID. |
| `Description` | plain text | No executable markup. |
| `Notes` | plain text plus concurrent-version metadata | Conflicting concurrent replacements remain recoverable. |
| `ImageAsset` | content hash, media type, crop/focal metadata | Optional. Absence renders no image and reserves no image area. |
| `Provenance` | source kind, source version, external stable key, imported instant | Contains external identifiers, not Entity references. |
| `ManagedOverlay` | base revision hash, overridden field mask, suppressed flag, detached flag | Local changes survive managed-source refresh. |

### 3.2 Definition data

| Component | Fields | Invariant |
|---|---|---|
| `ComponentDefinition` | stable codec ID, schema version, storage class, validation descriptor | Definition Entity is itself queryable. |
| `Tag` | no value | Marks a data-less component definition. |
| `NumericFieldDefinition` | label, decimal precision, optional min/max, optional help text, presentation icon as short Unicode or normalized WebP asset hash | The definition Entity is itself a data-component definition whose attached value codec is one `ExactDecimal`; no formulas or aggregation rule. |
| `SearchOperatorDefinition` | operator ID, syntax version, operand kind, accessible label | Executable planner remains reviewed app code, not user data. |
| `RolePolicy` | permission bitset, policy version | Authority honored only when signed/authorized by Group policy. |

### 3.3 Inventory and collection data

| Component | Fields | Invariant |
|---|---|---|
| `Container` | presentation preferences only | Presence means Entity can contain Entities. |
| `Stack` | positive integer quantity | Quantity is external to contained graph. Zero becomes tombstone/removal, never a stored stack. |
| `Weight` | non-negative `ExactDecimal` per logical copy | Unit is intentionally implied by user context. |
| `CollectionDefinition` | kind (`query` or `selection`), saved query AST when query-based, stable sort/presentation options | Explicit selection membership uses `SelectedIn` pairs rather than an embedded Entity list. |
| `ItemSourceDefinition` | source adapter ID, command preset data, ordering, enabled state | Data configures reviewed behavior; never contains script. |
| `SourceSubscription` | adapter ID, channel, last checked revision, overlay policy | Managed data can be refreshed/detached/reset/compared. |

### 3.4 Vault, Group, and collaboration data

| Component | Fields | Invariant |
|---|---|---|
| `VaultManifest` | Vault GUID, schema versions, root public keys, created instant | Exactly one root manifest per Vault. |
| `Profile` | display name, optional image hash | Profile initials derive from current display name when no image. |
| `Device` | device public keys, label, created/last-seen instant, key epoch | Devices are authorized by a Vault root signature. |
| `RecoveryState` | recovery-envelope hash/version, backing locations, last verified instant | Never contains the Recovery Kit secret; complete folder remains independent bearer recovery. |
| `GroupState` | name, current policy/key epochs, lifecycle state | Used on an Entity carrying the `Group` Tag; Entity GUID is the Group GUID; never implicitly a Container. |
| `Invite` | random secret hash, expiry, use limit/count, approval mode, paused/revoked state | `OwnedBy(Group)` identifies its Group and `InvitesAs(Role)` its proposed role; plaintext secret is not persisted by relay after creation where avoidable. |
| `PermissionManifest` | Group GUID, epoch, member/device keys, role bindings, signatures | Must leave at least one Owner and validate chain of authority. |
| `SyncCursor` | relay ID, canonical sequence, acknowledged hashes, freshness times | Transport-derived, not domain truth. |
| `Branch` | branch GUID, base position, kind, label | Preserves offline/rejected/undo alternatives. |

### 3.5 History and application data

| Component | Fields | Invariant |
|---|---|---|
| `ActivitySummary` | operation range, actor, action ID, affected GUIDs, user-visible summary data | Derived from journal; may be rebuilt. |
| `UserSetting` | setting ID, value, scope | Accessibility density/theme is device-local unless explicitly exported. |
| `PanelState` | route, selected Entity GUID, transient selection/query | Session/device state, never Group authority. |

## 4. Built-in Tags

The initial schema includes exact Tags for at least:

- `Tag` — marks component definitions that are data-less Tags;
- `Item` — marks inventory-capable entities;
- `Party` — marks a Container used as a party inventory/context;
- `Character` — marks a Container used as a character inventory/context;
- `Group` — marks a collaboration-principal Entity carrying `GroupState`; it is not a Container;
- `Unique` — indicates an item created/imported without a managed match;
- `Managed` — indicates a managed source definition/entity;
- `Viewer`, `Editor`, `Manager`, `Owner` — shipped role Tags whose effective permissions are defined by signed Group policy.

These Tags are ordinary Entities and can receive components/Tags as metadata. Their protected GUID and structural meaning cannot be reassigned by renaming them. Applying `Character` or `Party` does not create a Group. Applying a role Tag does not grant authority unless an authorized policy binds it.

There is no built-in promise that a Tag name implies behavior. For example, an Entity tagged `Potion` matches `+Potion`; it matches `+Consumable` only if `Consumable` is also directly applied.

## 5. Initial sparse relationships

| Predicate | Subject → target | Cardinality/invariant | Reason for pair |
|---|---|---|---|
| `ContainedBy` | inventory Entity → Container Entity | At most one active parent; graph acyclic | Fast exact `=Container`, move validation, recursive aggregates |
| `OwnedBy` | Entity → Vault or Group principal | At most one governing principal per shared object | Permission and visibility queries without embedded refs |
| `MemberOf` | Vault-profile/member Entity → Group Entity | Many Groups allowed | Membership queries and lifecycle |
| `LinkedTo` | Entity → Entity | Sparse, purpose-qualified by command context | Explicit user links where containment/ownership is false |
| `SelectedIn` | selected Entity → explicit-selection Collection Entity | Many Collections allowed; set membership | Avoids embedded Entity lists and accelerates collection membership queries |
| `InvitesAs` | Invite Entity → role Tag Entity | Exactly one proposed role per active invite | Avoids embedding the role Entity reference and supports invite-policy validation |

Additional predicates require an architecture note demonstrating both (a) why an Entity reference in component data is undesirable and (b) which query/integrity rule benefits. `IsA`, effective-tag ancestry, and relationship metadata ontologies are out of scope.

Permission-role bindings may be stored as sparse role pairs in the materialized world, but the signed `PermissionManifest` is the validation authority. Managed provenance may add a `ManagedBy` pair only if source-Entity queries prove necessary; otherwise the external source key remains data.

The materialized `MemberOf` pair may carry its boundary-specific joined-sequence/state projection where the ECS pair implementation supports typed data; it is rebuilt from the signed manifest and is never authorization authority by itself. `SelectedIn` is data-less: presentation order comes from the Collection’s stable sort rather than relationship metadata.

## 6. Items, Containers, and stacks

An Entity may have both `Item` and `Container`. Its own fields describe the logical inventory entry; `ContainedBy` edges from children describe its contents.

`Stack.quantity` counts structurally identical logical copies. The visible contained graph represents the shared state of those copies. This is a logical model; the storage engine may use immutable structural sharing but must expose no aliasing surprises.

### 6.1 Copy-on-write edit

For a stack of quantity `n > 1`, an edit that would make only `k` selected copies differ performs one atomic command:

1. validate `0 < k ≤ n` and the proposed edit;
2. if `k = n`, edit the existing Entity graph;
3. otherwise reduce the original stack to `n - k`;
4. clone the selected Entity and only the container subgraph paths required by the edit, assigning fresh GUIDs and provenance linking the split operation;
5. assign quantity `k` to the clone;
6. apply the edit to the clone;
7. recompute dirty fingerprints/aggregates;
8. merge with an equivalent sibling stack if collision-safe equality succeeds.

Untouched immutable substructures may remain content-address-shared internally. Any later mutation first materializes an independent durable Entity path so editing one visible stack never silently edits another non-equivalent stack.

### 6.2 Stack equality

Two stack entries may combine only when all user-observable durable state is equal except GUID, history/provenance bookkeeping explicitly excluded from semantics, and quantity. Equality includes:

- exact direct component/Tag set and canonical component values;
- image/content asset identity;
- ordered or canonically sorted relationship state as defined per predicate;
- recursively equal contained children including quantities;
- no unresolved conflict/quarantine marker that would be hidden by merge.

Compare a versioned Merkle fingerprint first, then recursively compare canonical values and graph structure before merging. Equalizing a changed bag’s contents therefore makes it stackable again; hash equality alone is insufficient.

### 6.3 Cycle prevention

Before adding/moving `X ContainedBy Y`, the validator rejects when `X = Y` or `Y` is transitively contained by `X`. The UI explains that a container cannot contain itself, directly or indirectly, and leaves state unchanged. Imported or remote cycle attempts are quarantined rather than partially applied.

### 6.4 Weight

An Entity’s own contribution is `quantity × Weight`. A Container’s total contribution is its own contribution plus the recursively aggregated contributions of children, according to the direct `ContainedBy` graph. Weight has no stored unit. Displays use the active context’s implied label if one exists, otherwise a neutral numeric label.

The aggregate cache stores canonical decimals and dependency versions; it is never authoritative. Moving/editing a descendant dirties only affected ancestor paths.

Every user-defined numeric field is a component-definition Entity carrying `NumericFieldDefinition`. Applying that component to an Item/Container stores its `ExactDecimal` in the field’s own archetype column. No “values by component GUID” map is stored inside another component.

## 7. Groups and permissions

A Group Entity directly carries the `Group` Tag and `GroupState`. It is an authorization/collaboration principal that can own Containers and other Entities through `OwnedBy`; it is not one of those Containers.

The shipped roles form these default capabilities:

| Capability | Viewer | Editor | Manager | Owner |
|---|:---:|:---:|:---:|:---:|
| Read permitted Group content | yes | yes | yes | yes |
| Create/edit permitted content |  | yes | yes | yes |
| Create Group-owned Containers |  | when policy permits | yes | yes |
| Invite/manage non-Owner members |  |  | yes | yes |
| Change role/policy definitions |  |  | policy-limited | yes |
| Grant/revoke Owner |  |  |  | yes |
| Disband/delete Group |  |  |  | yes |

Custom roles are Tag Entities with a `RolePolicy`, but a role becomes authoritative only through a manifest change signed by a currently authorized key. Validation rejects any transition with zero Owners. Ordinary Tag/component edit commands cannot touch the signed permission manifest or elevate authority.

Users acting “as the Group” create Entities with `OwnedBy(Group)`, subject to policy. Ownership controls governance, while audit records retain the initiating Vault/device.

## 8. Managed defaults and overlays

Managed data is normal ECS data plus stable provenance. A source refresh compares `(adapter ID, external key, base revision)` and applies:

- untouched managed fields update to the new base;
- locally overridden fields retain the overlay;
- locally suppressed Entities remain hidden through a suppression tombstone;
- detached Entities stop receiving source updates and become normal local data;
- removed upstream Entities remain recoverable with source status shown;
- newly supplied Entities are added with stable deterministic source mapping recorded in the subscription.

The source package never overwrites an unrelated user Entity merely because display names match. Compare/Reset/Detach are explicit operations with history.

The bundled D&D managed source contains only legally redistributable SRD 5.1/5.2.1 material and attribution. Users may create their own lawful data; Sonatory does not fetch or reproduce proprietary item lists.

## 9. Search and Collections

Saved search is a versioned AST. Minimum nodes are:

- `All(children)` intersection;
- `Text(term, normalizationVersion)`;
- `Operator(operatorId, operatorVersion, operandGuid, displayHint)`;
- `Locked(child, sourcePanelId)`;
- explicit stable sort description.

Built-in operator semantics:

- `+A`: subject directly has exact Tag/component Entity `A` as a data-less Tag;
- `-B`: subject does not directly have exact Tag/component Entity `B`;
- `=C`: subject is directly related to Container `C` by the panel’s containment/link predicate, initially `ContainedBy` for inventory search.

Display names are hints and may be ambiguous; GUID operands are authoritative. Missing operands produce a visible unresolved token, never a silent name rebind.

A query Collection stores an AST. A selection Collection uses direct `SelectedIn` pairs and a declared stable sort. Tombstoned/missing members remain addressable through their GUID-backed Entity/tombstone state so references stay visible and repairable.

## 10. Deletion, purge, and recovery

Normal Delete applies a tombstone. References, history, and later offline edits remain recoverable and may appear in a recovery view. Restore is another event.

Purge is a distinct irreversible local operation that requires a dependency preview and explicit confirmation. In a Group it requests protocol-defined cryptographic/relay erasure where authorized, but cannot erase plaintext or historical copies already held by another member. The UI states that limit before confirmation.

Disband marks the Group closed, revokes invitations, rotates/destroys relay-accessible current keys where possible, and schedules hosted encrypted data deletion. Member devices may retain their lawful local copies.

## 11. Serialization and canonical form

All durable records have an explicit `kind`, integer schema version, and canonical codec. Canonical encoding rules are fixed per version:

- map keys sorted by encoded bytes;
- GUIDs lowercase canonical strings;
- decimals canonicalized with no redundant leading/trailing zeroes;
- Unicode preserved exactly after input validation; no hidden locale transform;
- sets sorted by GUID; user-meaningful arrays preserve order;
- unknown required fields reject; unknown declared extension fields round-trip where the schema permits;
- dense IDs, DOM IDs, object property insertion order, and localized display strings never affect hashes.

JSON may be used for readable exports, but signed/hashed records must pass through the same canonical byte codec before integrity operations. Protocol and archive codecs version independently.

## 12. Schema evolution

Every component, event, operator, importer profile, and managed-source format declares a version. A migration is deterministic, idempotent where possible, replay-tested, and accompanied by downgrade/export behavior.

Before migration, Sonatory records a recoverable checkpoint. Migration commits all affected state or none. A client must not emit an event version that collaborators or the configured relay cannot preserve. Unknown optional components remain opaque and round-trippable; unknown events block unsafe application and present compatibility recovery.

## 13. Required invariant tests

- GUID/dense-ID round trips never serialize a dense ID.
- Component definitions and Tags are queryable Entities.
- Tags on Tags never create implicit matches.
- Every active `ContainedBy` subject has at most one parent and the graph stays acyclic.
- Stack split/edit/merge preserves quantities and isolates mutations at arbitrary depth.
- Recursive equality does not rely on hashes alone.
- Incremental and full weight recomputation agree exactly.
- There is always at least one Group Owner.
- Applying an Owner Tag through ordinary editing never grants authority.
- Managed overlay/suppress/detach survives refresh and remains reversible.
- Tombstones and late offline edits remain recoverable.
- Canonical serialization and replay hashes agree across supported browsers.
