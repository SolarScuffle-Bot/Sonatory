# Sonatory — Final Draft product specification

Status: **Final Draft awaiting approval**  
Implementation status: **not started**  
Last synthesized: 2026-08-11

This document is the authoritative product specification for Sonatory. It supersedes the prototype specification, the iterative decision register, and any earlier conflicting language. Supporting documents provide implementation detail but may not weaken or contradict this file.

The words **must**, **must not**, **should**, and **may** are normative. When implementation exposes an inconsistency, apply requirements in this order:

1. Safety, authorization, privacy, and data-preservation invariants.
2. The latest explicit requirement in this document.
3. The linked supporting document.
4. The decision register as historical rationale.

## 1. Product definition

Sonatory is a free, local-first, single-page inventory application for individuals and small collaborative Groups. It is system-independent, D&D-inclusive, offline-capable, installable as a PWA, and rendered as semantic HTML.

Its central purpose is to make items, stacks, Containers, nested inventories, Tags, collections, ownership, and shared work quick to understand and manipulate without imposing game-specific rules. Weight is the only built-in recursively aggregated number.

Sonatory must feel like a compact, calm desktop application:

- immediate local response;
- short paths to common actions;
- high information density without unreadably small text;
- predictable spatial composition;
- complete keyboard, pointer, and touch operation;
- quiet synchronization and exception-only interruption;
- simple exact rules that combine into more capable behavior.

### 1.1 Product guarantees

- Personal inventory work is fully usable without an account, relay, or network.
- Every active Vault has a complete local browser replica.
- Cloud synchronization is optional and never becomes a prerequisite for local access.
- The official hosted transport follows a hard-zero-cost policy. Quota exhaustion may delay cloud work but may never create a charge.
- Rejected, conflicting, unauthorized, or unsynchronized user work is preserved rather than silently discarded.
- Users can export their data and migrate away from the official deployment.
- The browser client remains framework-free, statically deployable JavaScript. Audited development tools, relay dependencies, and narrowly scoped vendored libraries are permitted.

### 1.2 Explicit non-goals

The first production release does not provide:

- arbitrary user JavaScript, UI wireframing, or plugin code execution;
- a privileged built-in-library, share-pack, Character, Party, or D&D entity type;
- formal weight units or automatic unit conversion;
- user-defined formulas or aggregation beyond Weight;
- a full D&D character sheet, spell manager, combat tracker, or rules engine;
- proprietary D&D book data, D&D Beyond scraping, or account automation;
- public user discovery, advertising, behavioral analytics, or paid hosting features;
- automatic Tag inheritance or an ontology of effective Tags;
- a canvas-rendered application or a permanent 60 FPS idle loop.

## 2. Terminology

| Term | Meaning |
|---|---|
| Vault | The top-level private identity and data boundary. Multiple Vaults act as different users. |
| Entity | A durable GUID-addressed subject in Sonatory's event-sourced ECS. |
| Component | A data definition that is itself an Entity. Its values are stored on subject Entities. |
| Tag | A data-less component Entity used as an exact fact or metadata marker. |
| Relationship | A sparse `(predicate, target)` pair attached to a source Entity. |
| Container | Any Entity directly carrying the `Container` Tag. |
| Character | A Container carrying the `Character` Tag. It is not a distinct type. |
| Party | A Container carrying the `Party` Tag. It is not a collaboration principal. |
| Group | A collaboration principal with members and capability policies. Creating one does not create a Container. |
| Collection | A saved explicit selection or saved query rendered on the Collections home. |
| Item Source | A data-defined tile that starts a supported create or browse workflow. |
| Managed source | A signed, versioned external source layered beneath local overrides. |
| Entry | An item or Container state physically placed inside a Container with a stack quantity. |
| Relay | An optional transport, canonical sequencer, encrypted mailbox, and hosted recovery replica. |
| Durable event | A signed, versioned description of an accepted durable mutation. |

Names are mutable and non-unique. References and saved query operands always use stable GUIDs even when the interface displays names.

## 3. Supported environment and deployment

### 3.1 Browser support

The supported matrix is the current and previous major versions of Chrome, Edge, Firefox, and Safari. The application must document graceful degradation for browser features that are unavailable in part of this matrix.

It must support:

- installation as a PWA and an offline application shell;
- phone portrait and landscape;
- tablets and coarse-pointer hybrids;
- square and portrait monitors;
- standard landscape and ultrawide monitors;
- large televisions;
- resized windows and browser zoom through 400%.

### 3.2 Deployment artifacts

The project produces separate artifacts:

1. Static browser application and service worker.
2. Optional Cloudflare Worker and SQLite-backed Durable Object relay.
3. Managed-source manifests and importer profiles.
4. Development, test, audit, and deployment tooling.

The browser application must remain usable if artifacts 2–4 are unavailable. A compatible custom relay may replace the official relay without changing Vault or Entity identity.

The static application is built from an explicit allowlist and verified before release. GitHub CI runs syntax, domain, persistence, security, relay, importer, HTTP, service-worker, UI-contract, build-graph, and security-header checks on the supported Node maintenance lines under Windows and Linux. A production deployment may consume only the artifact produced after every required quality job passes. The hard-free Cloudflare Pages profile enables no database, analytics, or paid binding by default.

## 4. Vaults, identity, and onboarding

### 4.1 Vault identity

Every Vault contains:

- a securely randomized Vault GUID;
- a root cryptographic identity;
- a non-unique display name;
- an optional square profile image;
- durable Entity history and blobs;
- memberships and credentials required to act as that Vault.

Multiple Vaults on one device intentionally behave as different users. Creating a Vault creates a new identity. Copying or recovering a Vault preserves its identity. **Clone as New Vault** copies selected content while generating a new identity.

A complete valid Vault folder is a bearer of that identity: possession grants access and authority. Sonatory must clearly explain that copying or sharing the folder copies the identity.

### 4.2 Automatic encrypted storage and optional backups

A Vault opened through the hosted web application always has:

- an instant browser working replica;
- an automatically managed encrypted hard-free hosted replica;
- an optional user-selected Vault folder where supported;
- a portable archive fallback where directory access is unavailable.

The hosted replica is infrastructure, not an onboarding choice. Normal users are never asked to choose a relay, deploy Cloudflare, configure an origin, or understand the synchronization implementation. A complete folder is independently sufficient to recover. A hosted replica plus its Recovery Kit is sufficient to recover after browser-site storage is cleared.

Enabling the hosted replica creates an encrypted downloadable/printable Recovery Kit containing the high-entropy secret and locator needed to recover the root identity from hosted ciphertext. The root secret is never sent in plaintext. A user acknowledges the Kit once before relying on cloud as the only backing or first creating/joining a Group. A complete Vault folder needs no separate Kit because it already carries the identity.

A new browser/device may be authorized from an existing device by QR or one-time code, by opening the complete Vault folder, or by the hosted replica plus Recovery Kit. Passkeys may offer convenient local unlock/approval where supported but are never the only recovery route.

### 4.3 Opening and creating Vaults

If a previously opened Vault is still available in browser storage, Sonatory opens directly into it. The profile/Vault control permits switching afterward.

When no cached Vault is available, the first screen presents recent recoverable references when available, **Open Existing Vault**, and **Create New Vault**.

New Vault setup is one centered responsive panel with responsible defaults already selected; it has no separate promotional or explanatory pane. The optional square identity image sits directly left of the display-name field and reserves no separate explanatory row. The panel shows display name, optional image, Vault name, an optional Vault-folder backup checkbox, and accessibility density together. Automatic encrypted storage requires no user decision and exposes no relay configuration. Progressive explanations may expand in place, but setup must not become a page-by-page wizard. A new Vault contains the three starter Collections and managed definitions, but no sample Items, Containers, Groups, friends, or Activity.

Profile & Vault exposes **Purge Vault** in a distinct danger zone. Purge requires typing the Vault name in an accessible modal confirmation, then removes the browser Vault, its Items, Containers, Tags, Collections, Groups, friends, Activity, hosted ciphertext, and known Sonatory files in the connected Vault folder. If a required target cannot be reached or authorized, Sonatory reports the remaining copy and does not falsely claim a complete purge.

No email address or phone number is required for identity, operation, invitations, recovery, or expiry warnings.

Folder behavior is exact:

- valid Vault metadata opens the existing Vault and skips new-user onboarding;
- an empty folder may be initialized;
- a non-empty folder without Vault metadata is never overwritten and may receive a dedicated Sonatory subfolder;
- corrupt or unsupported metadata opens diagnostics or recovery instead of being replaced;
- folder duplication offers **Preserve identity** and **Clone as New Vault** with their consequences.

## 5. Application shell and navigation

### 5.1 Header

The global header is one short persistent row. Together with the recent-tab strip it targets approximately 72–80 CSS pixels on desktop and no more than 90 CSS pixels on a narrow phone.

It keeps these common actions available:

- Sonatory identity/home action;
- Undo and Redo;
- global search;
- Groups/Friends;
- Settings;
- concise synchronization status;
- current profile/Vault switcher.

Lower-priority text labels collapse before common actions disappear.

### 5.2 Recent tabs

The recent-Container tab strip sits directly below the header and behaves like browser tabs.

- Opening a Container adds it only when absent.
- Selecting a tab never reorders it.
- Closing selects a sensible neighbor or Collections.
- Constrained tabs scroll horizontally and expose a direct overflow list.
- Tab state and scroll position are device-local and restored only when still meaningful.

### 5.3 Panels

Panels form a managed tiling workspace rather than free-floating windows.

- One panel is centered, intrinsically content-sized, and constrained to the safe viewport.
- Each panel declares minimum, preferred, and maximum dimensions.
- Multiple panels tile automatically: columns in wide space, rows in narrow space, balanced arrangements in square space.
- Closing or opening a panel immediately reflows the remaining panels.
- If all minimums cannot fit, related panels become tabs within a tile.
- Phone-sized layouts show one primary panel with a persistent back stack and fast switcher.
- Panels may never be restored to stale absolute pixel coordinates or partly offscreen.
- Short density-aware title bars contain their titles and actions; long titles truncate accessibly rather than spilling.
- Settings and Item Settings remain compact instead of consuming arbitrary workspace area.
- Click-away, an explicit close control, and Escape close only the topmost dismissible panel. Genuinely modal confirmations contain focus; ordinary panels do not.

Sonatory has no forced tour or checklist. Contextual actions, empty states, labels, and disabled-action explanations expose the likely mechanism at the point of need. Searchable offline help and contextual **Why?** explanations cover permissions, synchronization, recovery, and rejected work. Advanced controls remain plainly labelled rather than hidden behind a gesture or developer mode.

## 6. Collections home and carousels

The Collections home is a vertical sequence of saved collection sections. Character, Party, and Bags & Packs are shipped editable default collections rather than privileged categories. A clearly related creation surface adds another collection.

### 6.1 Flat interactive carousel

Each collection is a true flat horizontal rail:

- normal-flow, side-by-side, max-content cards;
- no overlap, rotation, perspective, depth, scale stacking, or wrapping grid;
- no fabricated filler cards;
- equal card width and height across all collection rows at the active density;
- full available page width with clipping only at the carousel viewport edges.

The rail must feel actively iterated. Touch, drag, wheel, trackpad, keyboard, previous/next, and direct-position input moves fluidly toward a target card that settles at the visual center. Motion is interruptible and follows input. Reduced-motion preserves selection and centering but settles immediately.

Previous/next advances approximately one visible viewport while retaining a predictable centered target. Native scrolling and scroll snapping remain available. Dominant vertical wheel input traverses the carousel while movement remains; at either boundary it yields to page scrolling. There is no automatic rotation.

### 6.2 Density targets

At 1920×1080 and 100% browser zoom:

| Density | Horizontal cards | Complete carousel sections |
|---|---:|---:|
| Spacious | approximately 6 | approximately 2 |
| Normal | approximately 8 | approximately 2 |
| Compact | approximately 10 | approximately 3 |

Normal is the default. Wider screens reveal more content rather than enlarging a fixed card count indefinitely.

### 6.3 Container cards

Container cards have stable semantic regions for identity, description, inventory preview, derived statistics, relationships, and actions. Empty regions collapse consistently. Content never enlarges one card or crosses its border.

A card may show:

- optional square image on the left;
- type-relevant exact Tags;
- complete name and concise description;
- direct item count and recursively loaded Weight;
- linked-Container count;
- inventory preview as a compact grid of optional-image-left/title-right chips;
- linked-Container chips;
- directly useful actions when measured width permits.

Missing images create no placeholder or reserved image region. Excess lower-priority content becomes a labelled `+N` disclosure, never overflow, unreadable text, or silently inaccessible content.

Every referential chip is a real pointer- and keyboard-activatable link. Entity chips open that Entity, Container chips open the Container view, and Tag chips open a Tag-filtered view.

## 7. Search, collections, and selection

### 7.1 Search behavior

Unprefixed text behaves like familiar browser/site search. Typing a registered structured operator starts an inline-code-like token with accessible autocomplete.

The initial operator module defines:

| Syntax | Meaning |
|---|---|
| `+A` | Result must directly have exact visible Tag A. |
| `-B` | Result must not directly have exact visible Tag B. |
| `=C` | Result must be directly linked through physical containment to exact visible Container C. |

The interface shows display names; the parsed query stores operator IDs and operand GUIDs. Ambiguous names are distinguished by image, ownership, ancestry, and other useful context.

Multiple `+` terms use AND. Any matching `-` term excludes. Multiple `=` Containers form a union. Plain text filters and ranks the remaining visible candidates.

Search operators are registered through a versioned query-language module. Saved queries store a versioned abstract syntax tree, never only the displayed punctuation. Syntax changes use explicit display codecs and migrations.

Quoting and escaping permit spaces and literal leading operator characters without turning ordinary text into a structured token. `Ctrl+K`/`Cmd+K` opens the same global search with commands available as optional suggestions; this shortcut never replaces the visible search control.

### 7.2 Baked panel queries

Every search surface combines:

1. visible locked panel terms;
2. editable user terms;
3. the current permission boundary.

Examples include `+Tag` in Tag Manager, `+Container +Character` for Characters, `+Container +Party` for Parties, and the current Container target in an inventory panel. Locked terms are visually pinned and announced as fixed constraints.

The `=` operator is direct. A recursively scoped panel computes and identifies its descendant scope separately.

### 7.3 Selection and bulk actions

One selection model spans carousels, inventory grids, lists, search, and panels. Desktop supports modifier selection; touch supports long-press and a visible Select action. Selection UI appears only once selection begins.

Selecting a Container selects that Entity, not every descendant. A contextual bar shows selection count, scope, and actions valid for the complete selection.

Supported actions include Move, quantity change, Tag edit, owner change, Link, Export, Clone, and Delete when authorized. Mixed-permission exclusions are explained before mutation.

Terminology is exact:

- **Move** changes physical containment.
- **Link** adds a non-weight-bearing reference.
- **Clone** creates new GUIDs and independent state.

Drag-and-drop mirrors common Move and Link flows, highlights valid destinations, and gently refuses containment cycles or missing permission. Every drag has a complete non-drag destination chooser.

## 8. Tags, components, and relationships

Sonatory uses the event-sourced ECS defined in [DATA-MODEL.md](DATA-MODEL.md).

### 8.1 Exact Tags

Tags are exact direct facts. Tags may themselves have components and Tags for metadata, but Tag-on-Tag does not propagate to Entities carrying the first Tag.

If `Potion` directly has `Consumable`, an Entity carrying `Potion` does not automatically satisfy `+Consumable`. There is no default `IsA`, effective-Tag closure, or hierarchical semantic inheritance.

The built-in `Tag` Tag identifies Tag-definition Entities. User-created Tags receive it automatically. Authority-relevant role Tags can be assigned only by capabilities defined in signed policy; ordinary descriptive Tag editing cannot escalate permission.

### 8.2 Sparse relationships

Relationships exist primarily to keep Entity references out of component data and make target-aware queries efficient. The initial vocabulary is deliberately small: physical containment, ownership, Group membership, explicit links, and narrowly justified provenance/permission references.

Relationship assignments are pairs, not independent Entities. History records pair addition and removal. Only physical containment contributes to recursive Weight and it must remain exclusive and acyclic.

## 9. Containers, entries, stacks, and Weight

### 9.1 Container workspace

The Container view contains a Container inspector and inventory workspace.

The inspector shows the optional square image on the left, name, description, exact Tags, linked-Container chips, direct entry count, recursively loaded Weight, link count, and relevant actions. Edit, Manage links, and Add item are inline when room permits and collapse into an ellipsis only when necessary.

Inventory defaults to a compact one-column List. Its stable row columns are drag handle, optional image, name/type, description when measured width permits, compact numerical stats, and right-contained Quantity. At narrower widths description collapses without reserving space and remains available as a hover/focus tooltip. Grid is the only alternate mode: equal-size dense tiles show optional image, name, and a small right-justified strip of value/icon stats. There is no separate inventory Carousel mode.

- Images are optional 1:1 media on the left, never an Icon field.
- Quantity decrement and increment use equal small square controls around exact entry. A vertical divider separates the stats region from the Quantity group.
- Quantity/actions are right-contained in list layout, including on narrow reflow.
- Every entry exposes Quantity and recursive Weight contribution with compact labelled icons. Compact stats always read `value icon` from left to right; expanded contexts may spell the labels out.
- Ordinary item selection opens compact Item Settings.
- Container-item selection opens its Container page.

### 9.2 Recursive Weight

Weight is an exact abstract decimal with context-implied units. There is no conversion or enforcement.

For an ordinary item:

`total contribution = stack quantity × own Weight`

For a Container-item:

`per-unit recursive Weight = own Weight + sum(child entry contributions)`

`total contribution = stack quantity × per-unit recursive Weight`

Weight calculations are iterative, incrementally invalidated, and cached safely. No recursive traversal may depend on JavaScript call-stack depth.

### 9.3 Container-items and copy-on-write stacks

Any item may directly carry the Container Tag and contain entries. It can appear inside another Container and may have a stack quantity greater than one.

Stack quantity is external to the user-visible per-unit item/Container state. Identical units share logical state until split or edited:

1. Increasing quantity does not duplicate the contained graph.
2. Splitting creates independently addressable stack entries initially sharing canonical state.
3. Mutating a split lazily materializes only the affected copy-on-write path.
4. Mutating one split never changes another.
5. Structurally equivalent states may restack.

Restacking uses cached Merkle-style structural fingerprints followed by collision-safe canonical equality verification. Contents, exact Tags, component values, images, links relevant to state, and recursively contained state participate in equality. Quantity and physical parent do not.

The parent link shown in UI is derived from physical containment rather than redundantly stored. Moving updates the exclusive containment pair atomically. A direct or indirect cycle is rejected before mutation with the detected path and a gentle explanation.

### 9.4 Custom numeric fields

Users may add exact-decimal fields with a label, optional display precision, optional bounds, and a presentation icon. The icon is either a short Unicode mark or a user-supplied transparent WebP image. Shipped fields select a meaningful icon. Compact contexts may show only the exact value followed by its icon; its accessible name and tooltip retain the field label. Numeric fields have no formal unit system, formulas, or recursive aggregation in the first release.

## 10. Creation, Item Sources, and managed defaults

### 10.1 Contextual creation

A consistent `+` action opens the context-aware creation or Item Source panel with the current destination preselected. Empty states expose the most relevant create, import, or link action directly.

Quick-add of an existing item asks only for quantity and destination when defaults suffice. Full settings remain available through expansion.

### 10.2 Item Source tiles

The panel structure is product-owned, but each source tile is data-defined from supported behaviors:

- create a one-off item;
- create a reusable item;
- browse an exact Tag query;
- browse another saved query;
- browse an explicit collection;
- browse a managed collection.

Shipped choices such as Unique, Custom, Item, Created, D&D, and `+` are editable default tile definitions rather than irremovable categories. Users may rename, re-image, reorder, hide, delete, recreate, and add tiles using supported behavior and default/query configuration. Arbitrary scripting is forbidden.

The Character Container preset opens one Character Setup panel with:

- Blank Character;
- Import New from D&D Beyond PDF;
- Update Existing from D&D Beyond PDF, including a target Character chooser.

Creating a Group does not create a Container. Authorized members may create Group-owned Containers while acting for the Group and independently apply Party, Character, or other Tags.

### 10.3 Managed sources

A managed source is an ordinary collection of ordinary Entities with stable source identity and visible provenance.

- Startup performs a non-blocking signed/versioned manifest check with cache validation.
- Offline operation uses the last-known-good source.
- Unmodified records update automatically.
- Editing creates a local overlay; source updates continue beneath it.
- The user may compare, accept, reset individual overrides, or detach completely.
- Deleting a managed record creates a suppression tombstone so refresh cannot resurrect it.
- The visible Managed Tag is informational; provenance controls behavior.
- Managed D&D items carry exact D&D5e-metatagged category and rarity Tags. Shipped managed Tag names contain no whitespace (`AdventuringGear`, `HeavyArmor`, `VeryRare`); existing spaced managed metadata migrates in place without changing its GUID. User-defined Tags remain free-form. Value is an exact nonnegative numerical field normalized to the source's gold-piece context and retains a currency presentation icon. A D&D Beyond match copies both fields and field metadata into the imported ordinary item.
- Managed freshness means time since successful check, with greater visibility after 7 and 30 days.

Sonatory may ship correctly attributed SRD 5.1 and SRD 5.2.1 content. It must not distribute proprietary book data, scrape D&D Beyond, direct users to unauthorized datasets, or imply a license. Private user-created content remains user content and is not redistributed by default.

## 11. Groups, friends, invitations, and permissions

### 11.1 Groups and people

A Group is a collaboration principal Entity, typically carrying the Group Tag, membership state, and signed permission policy. It is not a Container.

The Groups hub is directly reachable from the header and ordered:

1. **Join a Group** with unmistakable code input and Join action.
2. **Friends & Members** with permitted presence state.
3. The user's Groups and visible **Create Group** action.
4. Selected Group invitation and permission summary.

Selecting a Group expands its complete member list directly below it, Owners first. Ellipses open permission/member actions. Friends and members are deduplicated; explicitly saving a friend preserves the contact outside shared Groups.

### 11.2 Roles and capability policy

Viewer, Editor, Manager, and Owner are shipped exact role Tags plus policy templates:

- Viewer: see authorized content.
- Editor: see and change authorized content.
- Manager: additionally invite and manage non-Owner members where policy permits.
- Owner: manage ownership, membership, relay, keys, policy, disbanding, and hosted purge.

Users may define roles such as Quartermaster or Game Master through exact Tags and supported policy composition. Role assignment is capability-controlled. Policy may select subjects and resources using exact Tags, ownership, and sparse relationships without enabling general Tag inheritance.

Permissions normally inherit from the containing synchronized ownership boundary; explicit exceptions are visible. Unauthorized names, counts, Tags, relationship/autocomplete candidates, previews, activity, recursive Weight, and other derived values must not leak. A known unavailable action is omitted when irrelevant or shown read-only/disabled with a reason and **Request access** where meaningful.

Groups may have multiple Owners and must have at least one while active. Sonatory encourages at least two Owners without blocking smaller Groups. Ordinary invitations cannot grant Owner. The last Owner cannot leave or demote themselves without another Owner. Any Owner may disband the Group.

### 11.3 Invitations

Invitations follow a Discord-like flow. One opaque credential is available as:

- a short link;
- a visible copyable code inline with **Invite to [Group]**;
- a prominent QR code.

Invites support expiry, maximum uses, assigned role, reusable/single-use mode, optional approval, creator, use count, pause, revoke, and regeneration. Default expiry is seven days. Opening shows Group, inviter, granted access, and joining Vault with **Switch Vault** before confirmation.

### 11.4 Leaving, removal, and disbanding

Leaving or removal ends future authorization and rotates the Group encryption epoch. It cannot erase previously downloaded content.

Disbanding is a reversible history event that ends collaboration and invites. Purging hosted ciphertext is a separate irreversible Owner action with export opportunity and explicit confirmation.

If all Owners are irrecoverably lost, remaining members may fork accessible data into a new Group but cannot seize or impersonate the old identity.

## 12. Local-first collaboration and freshness

The detailed protocol is defined in [SYNC-PROTOCOL.md](SYNC-PROTOCOL.md).

### 12.1 Local and cloud modes

Sonatory uses one implementation:

- **On this device:** no network requirement.
- **Cloud synchronized:** complete local replica plus hard-free encrypted relay.
- **Custom relay:** same client protocol against a compatible endpoint.

The cloud option is opt-in. A local Vault is never silently uploaded. Local UI may show **Saved locally** only after the atomic IndexedDB commit; cloud publication may include only locally persisted signed events.

Moving private data into Group ownership must explain disclosure. Moving Group data into private ownership requires authority and explains the ownership change.

### 12.2 Canonical sequencing

For synchronized boundaries, the configured relay is the centralized canonical sequencing authority for signed encrypted operations. It is not the sole copy and cannot determine inventory meaning from ciphertext.

Each device retains a complete usable replica. If the relay disappears, surviving replicas continue locally and may reconstruct or migrate the shared journal.

### 12.3 Offline reconnection

Reconnection is pull–validate–push:

1. Compare journal position, checkpoint, permission epoch, and key epoch.
2. Persist and apply missing accepted events.
3. Revalidate pending local operations against current structure and authority.
4. Publish valid signed operations.
5. Preserve rejected work privately with an explanation.

Cached Group edit authority remains publishable for 30 days by default. After expiry, local work continues in a private pending branch until revalidation. Owners may change the window in Advanced settings.

A device becomes dormant after 90 days without confirmation and must revalidate before receiving new Group keys. Group encryption rotates on membership/permission revocation and every 90 days.

### 12.4 Conflict behavior

Sonatory synchronizes intentions rather than replacing whole objects.

- Relative quantity adjustments commute.
- Different fields combine.
- Absolute replacements record their observed base and preserve competing values.
- Concurrent moves produce one physical parent; the losing move remains attributable and repeatable.
- Concurrent stack operations preserve contents and materialize distinct stacks when equality breaks.
- A containment edge that would create a cycle is quarantined.
- Deletion uses a tombstone; later offline edits remain recoverable.
- Long-note conflicts preserve both versions for manual comparison.

Ordinary deterministic resolution is non-blocking. The interface interrupts only when it cannot safely infer or preserve intent.

### 12.5 Freshness states

Content, authority, managed-source checks, cloud backup, and application version have separate freshness records. Normal UI uses:

- Current;
- Waiting to sync;
- Connection needed;
- Action needed.

Exact dates, hashes, journal positions, epochs, queues, and repair controls live in Advanced diagnostics.

The official hosted copy expires after 12 months without authenticated Vault or Group activity. Any valid sync renews it. Data & Sync shows the expiry date and warns beginning 90 days before it.

The official deployment may use Cloudflare Turnstile only for an expensive hosted allocation or suspicious abuse-sensitive action. It is absent from ordinary local use and synchronization, and is explained if shown. A custom relay may omit it while retaining protocol security/rate controls.

## 13. History, Undo, and destructive actions

History begins at Vault creation or migration into the event model and has no arbitrary action-count limit. Snapshots accelerate materialization but do not replace accepted event history.

Undo and Redo are persistent, visible in the header, and available to touch, pointer, and keyboard users.

- Solo Undo may move through the user's history branches.
- Collaborative Undo emits compensating events for the current user's actions rather than rewinding other people.
- If later work depends on an action, Undo previews its effect before emitting the inverse.
- Editing after Undo retains the previous future as an inspectable branch.
- System-derived values are not separate Undo steps.

Routine reversible Delete applies immediately with concise Undo feedback. Recursive deletion, Group disbanding, irreversible Purge, and disclosure-sensitive operations require an impact preview and confirmation.

## 14. Files, images, attachments, and Character import

### 14.1 Images and blobs

Initial image inputs may be any browser-decodable still image. SVG, executable/compound formats, and animation are not retained as active content. Animated input becomes a static frame. Every retained Entity, profile, source, and numerical-field icon image is re-encoded as WebP with alpha transparency preserved; persisted Vault validation accepts only that normalized image format.

Images are decoded locally, metadata-stripped, bounded in dimensions and encoded size, and given a square preview. A crop/focal point controls 1:1 display without destructively cropping the source representation. The untouched original is not retained by default.

Attachments are general content-addressed blob components. Normalized bytes deduplicate only inside the same encrypted sharing boundary.

The official relay begins with soft allocations around 25 MB per personal Vault and 100 MB per Group. Inventory operations/history have reserved capacity separate from blobs. Blob quota exhaustion preserves local files and ordinary synchronization, offering cleanup, export, or relay migration—never billing or automatic history deletion.

### 14.2 D&D Beyond PDF inventory adapter

The adapter accepts only a recognized PDF created by D&D Beyond's Export to PDF flow. It does not log in, scrape, call an unofficial account API, or accept arbitrary character sheets.

It extracts only inventory-relevant information:

- Character name for the resulting Container;
- carried item names and quantities;
- explicit equipment/container state available in the export;
- reported load/carry values and carrying capacity;
- closely related inventory statistics.

It does not import abilities, spells, biography, combat rules, or a complete character sheet.

Item resolution is deterministic:

1. exact managed D&D source name;
2. declared managed alias;
3. one unique normalized-name match;
4. otherwise create an ordinary item carrying the Unique Tag.

Fuzzy or ambiguous selection is forbidden. Computed recursive Weight remains authoritative; reported PDF totals may be retained for comparison and mismatch diagnostics.

Parsing runs locally in a dedicated worker using a pinned, vendored, lazily loaded PDF.js core. Embedded scripts, actions, external resources, and automatic links are disabled. The original PDF is not uploaded or retained unless the user explicitly attaches it.

Before mutation the user receives a dry-run preview. **Update Existing** uses a three-way diff among prior imported state, the new PDF, and local edits.

Generic, unofficial, flattened, encrypted, malformed, and unrecognized PDFs are rejected with **Try Different File** and **Cancel**. A likely new D&D Beyond layout is identified as unrecognized, not partially guessed.

Recognition/field-mapping profiles are signed, versioned managed data. A profile update may add a vetted new export revision without loosening recognition or allowing partial heuristic import.

The adapter interface is provider-neutral so separately vetted Pathfinder or other generator adapters can be added later without making this adapter permissive.

## 15. Activity and notification behavior

Group activity is grouped by actor, time burst, and affected Container. Entries link to the Entity and historical state. Returning users receive one quiet expandable catch-up summary.

Interruptive notification is limited to:

- invitations;
- access changes;
- rejected work;
- unresolved conflicts;
- recovery or hosted-expiry risk;
- explicit requests for attention.

Visible remote updates receive brief attribution but may not reorder tabs, move panels, resize cards, steal focus, replace active input, break drag/scroll, or make an open deleted Entity disappear. Deleted open content becomes a recoverable historical view.

Large import, clone, export, query, and recursive operations run in bounded incremental or worker tasks with visible progress and cancellation where cancellation is safe. Navigation and ordinary local work remain responsive; stale worker results never overwrite a newer source revision.

## 16. Personalization and text behavior

Appearance settings are device-local by default and apply through design tokens.

- Color mode: System, Light, Dark.
- Restrained accent presets: Red, Orange, Yellow, Green, Cyan, Blue, Purple, Magenta, White, Light Gray, Dark Gray, Black.
- Custom hue with automatic contrast-safe foregrounds and boundaries.
- Themes: Flat, Modern, High Fantasy, Low Fantasy, Dark Fantasy, Sci-Fi, Cozy.
- Density: Compact, Normal, Spacious; Normal default.
- Motion: follow system by default with device-local override.

Themes may change texture, surface, border, typography tokens, and restrained decoration. They may not change semantic order, information architecture, control locations, target sizes, or accessibility behavior. Apply, Cancel, and Reset support immediate preview without mutating data.

Interface text is semantic selectable HTML with coherent phrases, correct document language, logical CSS properties, and no important text baked into imagery, canvas, icons, or CSS. The renderer preserves unchanged text nodes so browser translation can operate without continuous replacement.

User text remains exact Unicode. Search-only normalized forms never replace it. Dates, times, and decimal entry follow active locale while durable values remain canonical. Profile initials update immediately after display-name changes.

## 17. Accessibility

Sonatory targets WCAG 2.2 Level AA. [Accessibility acceptance requirements](ACCEPTANCE-MATRIX.md#m-accessibility-and-input-parity) are release gates.

At minimum:

- semantic HTML before ARIA;
- complete keyboard/pointer/touch parity;
- visible unobscured focus and predictable restoration;
- no essential hover, drag, wheel, swipe, pinch, long-press, or precision-only interaction;
- labelled non-rotating carousels with keyboard traversal;
- accessible combobox/token search semantics;
- reduced motion, forced colors, AA contrast, and non-color meaning;
- no arbitrary editing or recovery timeouts;
- restrained actionable live announcements;
- errors that preserve input and identify fields in plain language;
- browser zoom reflow at 200% and essential single-column operation at 400%;
- automated and manual assistive-technology verification.

Functional text never falls below approximately 14 CSS pixels at 100% zoom. Approximate body sizes are 15px Compact, 16px Normal, and 18px Spacious. Visual targets are approximately 32px, 40px, and 48px respectively, with at least a 44px usable coarse-pointer hit region.

## 18. Privacy, diagnostics, and deletion

Sonatory contains no ads, third-party trackers, automatic behavioral analytics, or automatic crash reports. A user may explicitly review and send a redacted diagnostic report.

The relay may observe network metadata—including address, timing, encrypted size, opaque identifiers, and membership traffic—but not inventory plaintext. It never receives a plaintext Vault root key or Recovery Kit secret. Application-level logs exclude payloads and expire after seven days unless tied to an active abuse investigation; aggregate non-payload quota counters may persist for the documented allocation period.

There is no public Vault, user, or Group directory. Presence is Group-scoped, optional, and does not include historical last-seen state. Group identity projection reveals only the display name, avatar, and public identity material needed for collaboration; private device details, unrelated Groups, private Tags, and private Vault data remain undisclosed. Invitation previews are decrypted by the receiving client from the invite credential rather than published as browsable relay records.

Deletion terms remain distinct:

- Delete: reversible tombstone and history.
- Disconnect: stop synchronization while retaining chosen copies.
- Remove local replica: remove one device/browser copy.
- Purge: irreversible removal of recoverable owned payload where possible.

Reset UI preferences and Disconnect cloud remain separate from removing a replica or purging data.

Purge cannot erase copies already downloaded by other people and must say so.

## 19. Application updates, failure, and diagnostics

A service worker may download an application update quietly but activates it only at a safe point through **Update ready**. It must not reload during editing, import, migration, or unsaved local work.

Schema changes create a recoverable checkpoint and use versioned replay-tested transactional migrations. A failing system preserves the last coherent world and DOM, blocks unsafe effects, and identifies recovery options.

Advanced diagnostics may expose:

- system schedule and timings;
- dirty queries and render regions;
- archetypes and Entity counts;
- journal positions and hashes;
- permission and key epochs;
- pending/rejected operations;
- relay quota and hosted-expiry state;
- worker jobs and long-frame attribution;
- repair, export, and relay-migration controls.

These details stay out of ordinary workflows.

## 20. Implementation and release authority

Implementation follows [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Every normative requirement maps to [ACCEPTANCE-MATRIX.md](ACCEPTANCE-MATRIX.md).

The application may not be called production-complete while a specified interaction, layout, accessibility gate, recovery path, legal boundary, or collaboration guarantee remains stubbed.

Application version, durable event schema, managed-source format, importer profile, and relay protocol are versioned independently with explicit compatibility declarations.

No domain, Cloudflare account, official hostname, or maintainer credential is part of durable user identity.

## 21. Supporting authorities

- [Architecture](ARCHITECTURE.md)
- [Data model](DATA-MODEL.md)
- [Synchronization protocol](SYNC-PROTOCOL.md)
- [Security and privacy](SECURITY.md)
- [Implementation plan](IMPLEMENTATION-PLAN.md)
- [Acceptance matrix](ACCEPTANCE-MATRIX.md)
- [Historical decision register](SPEC-DECISIONS.md)
