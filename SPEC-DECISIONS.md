# Sonatory Final Draft — decision register

Status: discovery and Final Draft synthesis complete; package awaiting explicit approval. No application implementation has begun.

This register records decisions made while converting the prototype specification into a production Final Draft. `FINAL-DRAFT-SPEC.md` now supersedes this register as the implementation authority.

## Round 1 — accepted product foundations

- Sonatory is a production-capable, offline-first application with complete solo use and optional realtime parties through a self-hostable relay.
- The shipped browser client remains framework-free and statically deployable. Development, testing, and relay code may use audited tooling and dependencies.
- Sonatory is an installable PWA backed by IndexedDB and an offline application shell.
- Identity uses cryptographic user and device keys, passkey protection where available, and an exportable recovery mechanism.
- Realtime collaboration uses a self-hostable relay carrying encrypted, signed events. The relay cannot read party content.
- Synced party data is end-to-end encrypted. Local encryption remains optional because mandatory unlock friction would undermine local-first use.
- The Final Draft specifies complete production behavior and a staged implementation order.
- Permissions are capability-based. Tags organize and select data but never grant authority by themselves.
- The support target is the current and previous major releases of Chrome, Edge, Firefox, and Safari, with documented graceful degradation.

### Licensed and user-supplied game data

- There is no privileged Catalog subsystem. Default items, user-created items, imported items, containers, parties, collections, and saved item sources use the same editable entity model.
- Sonatory may distribute only content for which it has permission, including correctly attributed SRD 5.1 and SRD 5.2.1 material.
- Sonatory does not distribute proprietary book data, scrape D&D Beyond, point users to unauthorized datasets, or claim a license by implication.
- Users may create arbitrary private entities, fields, images, labels, collections, and saved item sources. The application treats these as user content and does not present them as official or redistribute them publicly by default.
- A future authorized provider may supply additional managed data after written permission or a supported licensing integration exists.

## Round 2 — confirmed general model

### Ordinary entities and editable defaults

- Anything Sonatory creates for the user is represented using the same primitives available to the user.
- Sonatory owns its panel structure, responsive layout, navigation, and interaction design. Users do not wireframe the application or attach arbitrary scripts to its controls.
- The Item Source panel is product-owned, but its source tiles are data-defined instances of supported behaviors: create a one-off item, create a reusable item, or browse a saved tag, query, explicit collection, or managed collection.
- Shipped choices such as Unique, Custom, Item, Created, and D&D are default source-tile definitions rather than irremovable hard-coded categories.
- Users may create, rename, reorder, hide, or remove any source tile—including shipped defaults—and may attach their own images, choose a supported behavior, and set its starting query/default values. For example, a user may create a private D&D source tile and populate its underlying collection manually.
- The `+` action in the Item Source panel adds or creates another saved source; it does not expose a general UI-programming system.
- A managed default list is an ordinary collection of ordinary entities with visible managed-source provenance. It refreshes from its source without turning its contents into a separate kind of object.

### Container items and stacks

- Containers may also appear as items inside other containers.
- Nested containment is allowed. Direct or indirect containment cycles are forbidden and are rejected before mutation with a gentle explanation of the detected cycle.
- A stack quantity is external to the referenced item/container state. Multiple identical units may share one logical state until they diverge.
- Splitting a stack creates independently editable slots. Editing one split must never alter another split.
- Two split container-items may stack again when their complete user-visible state and recursively contained state become equivalent again.
- Recursive weight multiplies a stack quantity by the per-unit recursive weight of its referenced container state.
- Moving, cloning, splitting, merging, undoing, and synchronizing a container-item preserve referential integrity and reject cycles atomically.

### General fields

- Weight is the only built-in recursively aggregated numeric property in the first production release.
- Weight is an exact abstract decimal with no unit model, conversion, or unit enforcement. Its unit is implied by workspace and user context.
- Users may define additional typed numerical fields on ordinary entities. A field has a name, exact decimal value, optional precision and bounds, but no formal unit semantics in the first release.
- Game-specific value, rarity, attunement, charges, or similar information may live in notes or user-defined fields.

### Durable history

- Undo and redo are first-class, persistent features with visible controls for pointer, touch, and keyboard users.
- History begins when a workspace is created or first migrated into the event model and is not truncated by an arbitrary action count.
- Performance snapshots and indexes may accelerate loading but may not discard the authoritative event history.
- Destructive actions, imports, managed-source changes, moves, stack operations, and ordinary edits must all be representable in history.

### Sharing without content packs

- “Content pack” is not a core entity type.
- Any saved collection or selection may be exported as an entity-graph snapshot and imported through the ordinary merge workflow.
- A remotely managed list is an ordinary collection with source/provenance metadata.
- Sharing, importing, and source synchronization reuse the same entity, relationship, validation, and history rules as local editing.

## Round 3 — accepted source, history, and sharing behavior

- G5 is replaced by the narrower Item Source tile model above. General user-programmable buttons and arbitrary scripting are out of scope.
- G14 is replaced by abstract exact-decimal weight. Units and conversion are out of scope.
- G15 is rejected. Layout and responsive composition are product-owned; only the ordering and visibility of data-driven source tiles and collections are user-controlled.
- Editing a managed entity creates a local override layered over its stable source record. Source updates continue beneath the override and can be compared, accepted, or reset.
- Managed sources refresh non-blockingly at startup from a signed, versioned manifest with cache validation and an offline last-known-good fallback.
- Deleting a managed entity creates a suppression tombstone so later refreshes do not resurrect it. Restoration is explicit.
- The visible `Managed` tag is informational. Provenance metadata controls synchronization, and detaching from a source is an explicit action.
- Stack splitting uses lazy copy-on-write. A recursive subtree is materialized only when a split is mutated.
- Restacking uses canonical structural equality and cached Merkle-style fingerprints, followed by collision-safe verification.
- Collaborative Undo creates compensating events for the current user’s reversible actions rather than rewinding unrelated work from other users.
- Editing after Undo creates a retained history branch. Abandoned futures remain inspectable and redoable.
- Custom numerical fields support an exact decimal value, label, precision, and optional bounds. Formal units, formulas, and aggregation beyond built-in Weight are out of scope.
- Exporting a collection produces a snapshot of its selected entity graph and required descendants with stable IDs and provenance.
- Import begins with a dry-run diff. Stable IDs merge or layer changes, unknown IDs are added, and ambiguous cases require explicit resolution.
- Collections remain saved queries or explicit selections. Optional source metadata makes one managed; export produces a snapshot without creating a new persistent entity type.

## Round 4 — accepted local-first collaboration model

### Local and hard-free cloud operation

- Sonatory has one local-first implementation rather than separate local and cloud editions. The interface and domain engine always read and write through a complete local replica.
- Synchronization is an optional transport capability. A personal inventory may remain device-only, while a party or other sharing boundary may use the default hosted relay or a compatible custom relay.
- The default hosted implementation uses Cloudflare Pages, a Worker, and SQLite-backed Durable Objects on a hard-free plan. It must never enable billing or automatically cross into paid service.
- Exhausting a hosted quota pauses synchronization but never blocks local access or local editing. Pending encrypted operations remain queued and retry after service returns.
- The provider boundary is portable. A shared history can migrate to a compatible relay, and surviving complete replicas can reconstruct the encrypted journal if the hosted copy is lost.
- Cloudflare is the canonical sequencing authority for a cloud-synchronized boundary: it assigns the accepted shared order to signed encrypted event envelopes. It is not the sole durable copy or the semantic owner of the data.
- Local-only data can later enable synchronization without recreation. Disabling synchronization preserves a local copy, and deleting a hosted copy is a separate explicit owner action.
- Crossing from a private boundary into a shared boundary requires an explicit disclosure confirmation and includes the reachable entity graph required by the moved or shared entity.

### Convergence and preservation of intent

- Synchronization transmits signed operations rather than replacing whole saved objects.
- Commutative intentions such as relative quantity changes and edits to different fields combine without prompting.
- The canonical event order supplies a deterministic displayed result for simultaneous non-commutative edits, while losing values or intentions remain recoverable in history.
- An entity has one physical containment parent. Concurrent moves never duplicate it accidentally; a losing move remains attributable and repeatable if the user still wants it.
- Concurrent containment edges are validated deterministically. An edge that would create a direct or indirect cycle is quarantined rather than materialized.
- Deletion uses a tombstone. Later offline work is retained and can restore the entity or be recovered as a private copy.
- Remote changes may not reorder tabs, close or move active panels, replace focused input, break an active drag, or unexpectedly change scroll and selection. Conflicting visual updates wait until the immediate interaction completes.
- Routine remote updates appear through brief attribution highlights and grouped activity. Modal conflict resolution is reserved for cases where Sonatory cannot safely preserve or infer intent.

### Permission and synchronization experience

- The ordinary permission interface uses inherited Viewer, Editor, Manager, and Owner presets. A contextual Custom path exposes individual capabilities without making a permission matrix the default experience.
- Permissions inherit from the containing sharing boundary. Explicit exceptions are visible, and hidden data may not leak through totals, previews, search, activity, or derived values.
- Known unavailable actions are disabled or presented read-only with a concise explanation and, where meaningful, a Request access action.
- Ordinary content editing remains available offline using the last known access. Membership removal, ownership transfer, permission changes, key rotation, and relay migration require current online authority.
- If an offline editor's access changed before synchronization, unauthorized operations do not enter the shared journal, but the work is never discarded. Sonatory preserves it as a private recovered copy and explains what happened.
- Owners may opt into a stricter advanced policy that requires members to reconnect periodically before editing. This is not the default.
- Normal UI exposes only concise states such as synchronized, synchronizing, waiting for connection, or action needed. Routine success is silent; entity-level sync markers appear only when that entity needs attention.
- Power users can configure local-only versus synchronized storage, compatible custom relays, offline-member policy, relay migration, device and key management, quota visibility, export and restore, custom permission capabilities, and diagnostics.
- Core safety and interoperability rules are not configurable: power users cannot enable containment cycles, silently discard another user's work, weaken hidden-data protections, or introduce incompatible merge semantics.

## Pending decisions

## Round 5 — accepted Vault, ECS, Group, and invitation model

### Vault identity and persistence

- A Vault is Sonatory's top-level private identity and data boundary. Multiple Vaults on the same device deliberately act as different users.
- Each Vault has a locally generated random Vault GUID and root cryptographic keypair. The Vault GUID identifies the storage boundary; the hash of its root public key is the authenticating principal ID.
- Each authorized device has its own device GUID and keypair authorized by the Vault root identity. Creating a new Vault creates a new identity; recovering or copying a Vault preserves its identity unless the user explicitly clones it as a new Vault.
- A Vault always has a browser-resident working replica and may additionally use the hard-free encrypted cloud backup, a user-selected local folder, or both. A portable Vault archive is the compatibility fallback when direct directory access is unavailable.
- IndexedDB is the fast working store and materialized index. A connected Vault folder and cloud relay are durable replicas rather than separate editions of the product.
- First run begins with Open Existing Vault or Create New Vault. Existing valid metadata skips new-profile onboarding. Creating a Vault then asks for a display name, optional square image, and available backing choices.
- An empty folder may be initialized. A non-empty folder without Vault metadata is never overwritten; Sonatory offers to create a dedicated subfolder. Invalid metadata opens diagnostics or recovery rather than being silently replaced.
- Public identity projection, Vault data, device preferences, and Group data have separate scopes. Display name and avatar belong to the Vault identity, while theme, density, panel state, and recent navigation remain device-local by default.
- Browser-only operation is allowed but explicitly identified as not backed up. Clearing browser storage must not destroy a Vault that has a valid folder or encrypted cloud replica.

### Event-sourced ECS and tags

- The durable data model is event-sourced ECS: stable entity GUIDs, structured components, tag and relationship components, signed component-mutation events, materialized indexes, and retained history.
- Character and Party are ordinary tags applied to Containers. They do not create separate entity types, ownership rules, or permissions.
- A Group is a collaboration principal represented as an ECS entity with principal, membership, permission-policy, and tag components. Creating a Group does not implicitly create a Container.
- A member with suitable capability may create an entity while acting as the Group. The resulting entity is Group-owned and records both the acting human principal and Group principal for audit.
- Viewer, Editor, Manager, and Owner are shipped role tags plus permission-policy templates. Users may define additional role tags and policies such as Quartermaster or Game Master.
- Permission policies may select subjects and resources through tag queries, relationships, and ownership. Assigning or removing an authoritative role tag is itself capability-controlled; ordinary descriptive tag editing can never escalate authority.
- Tag-driven permission behavior remains subordinate to signed policy and safety invariants. Tags participate in authorization but are not self-authenticating authority.

### Groups and invitations

- The product-facing collaboration term is Group. Party refers only to a Container tag.
- Group creation makes the creator an Owner but creates no Party Container. Authorized members may later create arbitrary Group-owned Containers and tag them Party, Character, or otherwise.
- Friends & Members remains a deduplicated people view. Membership makes a person visible in the relevant Group; explicitly saving the relationship as a friend keeps it outside that Group.
- Invitations follow a Discord-like model: the same opaque credential is available as a short link, pasteable code, and prominent QR code.
- Invitations support configurable expiry, maximum uses, assigned role, reusable or single-use behavior, optional approval, creator attribution, usage count, pause, revoke, and regeneration. The normal default expires after seven days.
- Opening an invitation shows the Group, inviter, access being granted, and the Vault identity that will join, with an option to switch Vaults before confirmation.
- Groups may have multiple Owners but must have at least one while active. Owners appear first, ordinary invitations cannot grant Owner, and any Owner may disband the Group.
- Disbanding is a reversible history event that ends collaboration and invitations. Purging hosted ciphertext is a separate irreversible advanced operation requiring export opportunity and explicit confirmation.
- Disbanding, removal, and purge cannot erase information already downloaded to another member's device.

### Long-term freshness requirement

- Sonatory must actively prevent shared authority, managed sources, cloud replicas, invitations, and device state from remaining silently stale over long periods. Offline access remains available, but the interface and authorization model must distinguish current, aging, stale, and unverifiable state without routine interruption.

## Round 6 — accepted freshness, device, and recovery model

- Content, permission authority, managed-source checks, backup state, and application version have independent freshness records rather than one ambiguous timestamp.
- Reconnection is pull–validate–push: fetch and apply the current shared journal and authority epochs, revalidate pending work, then publish valid operations. Rejected work is preserved privately.
- Clients compare journal positions and periodic cryptographic checkpoints. Mismatch triggers automatic repair or a complete encrypted resynchronization.
- Normal UI uses Current, Waiting to sync, Connection needed, and Action needed. Exact dates, journal positions, hashes, epochs, queues, and repair controls live in progressively disclosed diagnostics.
- Cached Group edit authority remains publishable for 30 days without relay confirmation by default. Owners may configure this window in Advanced.
- After cached authority expires, users may continue working instantly in a private pending branch. Work joins the Group after successful revalidation or remains a recovered personal branch if access changed.
- Personal device-only content does not become stale merely with age. Sonatory instead tracks outstanding changes and whether another durable replica exists.
- Backup warnings are driven by unsynchronized changes lacking another durable replica, not by an arbitrary reminder schedule.
- Managed-source freshness means time since the last successful check, not the publication age of unchanged content. Checks are non-blocking; status becomes more visible after 7 and 30 days without confirmation.
- A new device is authorized from an existing device by QR or one-time code, with the Recovery Kit as the fallback.
- Enabling cloud synchronization generates an encrypted downloadable and printable Recovery Kit. The user must acknowledge it before first creating or joining a Group, without repeated routine prompts.
- Passkeys may provide convenient unlock and approval but never replace the Recovery Kit as the only recovery path.
- A Vault privately lists and permits revocation of its devices. Other Group members see the user principal rather than private device details.
- A device becomes dormant after 90 days without confirmation. It is not deleted, but must revalidate before receiving new Group keys.
- Group encryption rotates after membership or permission revocation and every 90 days. Currently authorized Vaults receive the new epoch automatically.
- New members receive current state and history from their join point. Earlier history is shared only through an explicit Owner grant.
- If all authorized devices and the Recovery Kit are lost, the encrypted Vault is irrecoverable and a new Vault identity is required.
- At least two Owners are encouraged. If every Owner is irrecoverably lost, remaining members may fork accessible data into a new Group but cannot seize or impersonate the old Group.

## Accepted side requirement — Character PDF import

- The Character Container preset panel includes an Import D&D Beyond PDF option alongside blank and other supported Character creation paths.
- Import accepts a user-selected PDF exported from D&D Beyond. It does not log into, scrape, automate, or require access to a D&D Beyond account.
- Parsing happens locally on the user's device. The original PDF is neither uploaded nor retained by default; the user may explicitly attach it afterward.
- The first importer extracts only inventory-relevant character data: the Character name needed for its Container, carried items, quantities, item state represented by the sheet, reported load/carry information, carrying capacity, and closely related inventory statistics. Abilities, spells, biography, combat statistics, and general character-sheet replication are out of scope.
- Import creates an ordinary Container tagged Character and populates it with ordinary item/container entities and inventory-related numerical fields. Current carried weight is computed from imported contents; reported sheet totals may be retained for comparison and mismatch diagnostics.
- Item resolution is deterministic and name-based: stable exact source names, declared aliases, and a unique normalized-name match may resolve to a managed D&D item. Fuzzy or ambiguous matching is forbidden. Anything unresolved is created as an ordinary Unique item.
- Import always presents a dry-run preview and confidence-aware diff before mutation. The user can correct mappings, skip fields, create a new Character, or update a previously imported Character.
- Re-import uses provenance and a three-way diff so upstream PDF changes, prior imported state, and the user's local edits are not confused or overwritten.
- The Character preset opens a Character Setup panel with Blank Character, Import New from D&D Beyond PDF, and Update Existing from D&D Beyond PDF. Update Existing includes an explicit target-Character chooser before the dry-run diff.
- The converter accepts only recognized D&D Beyond-generated PDF structures. Generic PDFs, unofficial sheets, flattened printouts, encrypted PDFs, malformed files, and unrecognized layouts are rejected without heuristic or manual fallback, with a clear explanation and Try Different File or Cancel actions.
- Versioned D&D Beyond recognition and field-mapping profiles may refresh as managed data so supported output revisions can be added without rebuilding the application. A likely new but unsupported D&D Beyond revision is still rejected safely and identified as unrecognized rather than partially imported.
- The importer is implemented behind a provider-neutral adapter contract for recognition, inventory extraction, provenance, name resolution, and re-import diffing. Only the vetted D&D Beyond PDF adapter ships initially; future Pathfinder or other adapters remain independently strict about their supported input formats.
- Imported proprietary text remains user-supplied private content. Sonatory does not bundle, publish, or redistribute it and does not imply affiliation with D&D Beyond or Wizards of the Coast.

## Pending decisions

## Round 7 — accepted files, imports, assets, quotas, and relay protection

- A pinned Apache-2.0 PDF.js core build is vendored with Sonatory and loaded only when PDF import is invoked. Sonatory has no runtime CDN dependency, and ordinary operation does not load the PDF engine.
- Narrowly scoped, audited, locally bundled libraries are permitted when safely implementing a complex standardized format would otherwise require an unreliable partial reimplementation. Framework-free remains an architectural constraint; absolute dependency prohibition does not.
- PDF parsing runs in a dedicated worker with embedded scripts, actions, external resources, and automatic links disabled. Input signature, structure, encryption state, and size are validated before parsing.
- D&D Beyond recognition and extraction profiles are signed, versioned managed data. Unknown structures are rejected rather than heuristically or manually mapped.
- D&D Beyond import creates or updates only the inventory-related ordinary ECS state described in the accepted Character PDF requirement.
- The original PDF is not retained or synchronized by default. The user may explicitly attach it after import.
- Attachments use a general content-addressed blob component that may belong to any entity, with contextual UI rather than a Character-only storage mechanism.
- Initial image inputs are JPEG, PNG, WebP, and AVIF. SVG and executable or compound formats are excluded; animated inputs become a static frame.
- Images are decoded locally, metadata is removed, dimensions and encoded size are bounded, and a small square preview is generated. Untouched originals are not retained by default.
- Image presentation uses an adjustable crop or focal point in a 1:1 frame on the left of card content. Entities without an image render no reserved image region or placeholder.
- Normalized blob bytes are hashed and deduplicated within each encrypted sharing boundary. There is no cross-user plaintext deduplication.
- The official hard-free relay begins with soft allocations around 25 MB per personal Vault and 100 MB per Group. Custom relays may configure other limits without changing the protocol.
- Inventory operations and history have reserved synchronization capacity separate from attachment capacity, so a large blob cannot block ordinary edits.
- Quota exhaustion refuses new hosted blobs while preserving local copies and ordinary data operations. Cleanup, encrypted export, and relay migration are offered; billing and automatic deletion are forbidden.
- Relay requests are signed and replay-protected. Per-principal, per-Group, and outer IP burst limits protect storage and request quotas.
- Free Cloudflare Turnstile verification is limited to expensive allocation or suspicious abuse-sensitive actions rather than ordinary synchronization. It is normally invisible.
- Compatible custom relays may disable Turnstile and adjust allocations but must retain signature, authorization, replay, and protocol-safety validation.

## Pending decisions

## Round 8 — accepted responsive layout and spatial behavior

- The application uses the full available viewport with responsive gutters and no desktop maximum width that wastes large screens.
- Compact, Normal, and Spacious are device-local accessibility density settings. Normal is the default. They alter spacing, card geometry, control targets, and available detail rather than uniformly scaling the interface.
- At 1920×1080 and 100% zoom, Spacious shows about 6 cards horizontally, Normal 8, and Compact 10. Wider displays reveal more cards rather than stretching a fixed count indefinitely.
- At 1920×1080, both Spacious and Normal show approximately two complete collection-carousel sections vertically; Compact shows approximately three. Spacious differentiates itself through larger type, targets, cards, spacing, and more directly visible detail rather than reducing the page to one carousel.
- Approximate body sizes are 15px Compact, 16px Normal, and 18px Spacious. Functional text never falls below 14px at 100% zoom.
- Visual control targets are approximately 32px Compact, 40px Normal, and 48px Spacious. Coarse-pointer devices maintain at least a 44px usable hit region.
- A short persistent header keeps navigation identity, Undo/Redo, search, Groups, settings, sync state, and profile available. Lower-priority labels collapse before common actions disappear.
- The recent-tab strip sits below the header. Selection never reorders tabs; constrained tabs scroll horizontally and have a direct overflow list.
- Each collection uses a flat, non-overlapping horizontal carousel rather than a grid or transformed deck. All cards in the active density have identical dimensions.
- The carousel behaves as an actively iterated strip: wheel, touch, drag, keyboard, and previous/next interactions move the track fluidly, designate a target card, and settle that card at the visual center of the available carousel viewport.
- Centering uses smooth, interruptible motion that follows input rather than playing a decorative canned animation. `prefers-reduced-motion` and the application motion setting preserve selection and centering but settle immediately without animated travel.
- Carousel interaction supports touch dragging, trackpads, visible previous/next controls, keyboard navigation, and an accessible scrollbar. Dominant vertical wheel input traverses horizontally while movement remains available and releases to page scrolling at carousel boundaries.
- Cards use stable semantic regions and never resize individually from content. Excess lower-priority content becomes an explicit labelled disclosure rather than spilling, shrinking text, or introducing internal card scrolling.
- Tags, linked Containers, relationships, and other referential chips use a shared optional-image-left/title-right component. Every referential chip is a genuine pointer- and keyboard-activatable link: entity chips navigate to that entity, Container chips open its Container view, and tag chips open the corresponding tag-filtered view. Missing images reserve no blank region.
- Inventory previews use a responsive grid based on readable card minimums, not a vertical list or fixed breakpoint column count.
- Optional 1:1 item images appear to the left of item content. When no image exists, no image field, placeholder, or reserved image region is shown.
- Quantity controls remain inside and right-aligned within the item card. Every item shows its total weight contribution, including recursive Container contents and stack quantity.
- Frequent card actions are inline when measured room permits; lower-priority actions collapse into ellipses only when necessary.
- Panels publish minimum, preferred, and maximum sizes. A single panel is centered and content-sized. Multiple panels automatically tile inside the safe workspace according to aspect ratio and immediately reflow when one closes.
- If all panels cannot meet minimum sizes, related panels become tabs within a tile rather than shrinking below readability or leaving the screen. Larger displays retain more simultaneous panels.
- Short panel headers use readable density-aware titles with correct flex containment and accessible truncation. Fixed header actions cannot push titles beyond their panel.
- Phone-sized layouts show one primary panel with a persistent back stack and fast switcher. Component-measured responsive rules support portrait, landscape, square, ultrawide, television, resizing, and zoom without separate applications.
- Browser zoom causes natural responsive reflow. Essential work remains usable at 200% without page-level horizontal scrolling and at 400% in a single-column presentation.
- Remote changes and asynchronous content may not reorder tabs, resize cards, move active panels or targets, replace focused input, or disturb active scrolling and dragging.
- Open tabs, panel workflow, and scroll positions are remembered per device, but restored panels are re-tiled for the current viewport rather than assigned stale pixel coordinates.

## Pending decisions

## Round 9 — accepted finding, selection, and action model

### Search and query language

- Search covers every entity visible to the active Vault without leaking unauthorized names, counts, tags, relationships, derived totals, or autocomplete candidates.
- The search field initially behaves like a familiar browser or site-search field: unprefixed text performs forgiving textual matching with no query syntax required.
- Typing `+`, `-`, or `=` begins a structured term. The active term is visually presented like inline code and receives context-valid autocomplete.
- `+Tag` requires the result to have the selected Tag. `-Tag` excludes results having the selected Tag. Both operators autocomplete only visible Tag entities.
- `=Container Name` constrains results to the selected visible Container. Container names need not be unique, so autocomplete includes enough ancestry and ownership context to select the stable GUID unambiguously.
- Structured tokens use green for `+`, red for `-`, and neutral white or the theme's foreground color for `=`. Meaning is also conveyed by the operator, label, accessible description, and non-color styling.
- Quoting and escaping allow spaces and literal leading operators. Selecting an autocomplete result stores its stable entity GUID while displaying its current human-readable name.
- A completed search may be saved as an ordinary collection or Item Source tile rather than creating a separate saved-search entity type.
- `Ctrl/Cmd+K` opens the same search with commands included as an optional accelerator.

### Entity-component relationship graph

- Sonatory's event-sourced ECS treats component definitions and component instances as addressable entities with stable GUIDs, provenance, history, tags, and relationships.
- An ordinary subject entity relates to a component instance through `has-component`; that instance relates to its component definition through `instance-of`. Materialized archetype and column indexes preserve ECS-style query and update performance despite the fully addressable durable graph.
- Tags are ordinary entities used through explicit tagging relationships. A Tag may itself have components, relationships, and Tags; this is the general mechanism for tag metadata, grouping, presentation, role semantics, preset behavior, and other site-understood metadata.
- Tag metadata does not silently grant authority or imply unrestricted transitive inheritance. Permission-relevant interpretation is defined by signed policies, and query traversal beyond direct tags must be explicit and cycle-safe.
- Relationships are first-class typed entities or addressable relationship records with stable identity, endpoints, provenance, authorization, and history. This supports relationships among subjects, components, component definitions, Tags, Containers, principals, and other relationships where valid.

### Selection, creation, and actions

- One selection model spans grids, carousels, search, and panels. Desktop supports modifier selection; touch supports long-press or Select. Checkboxes and bulk controls appear only after selection begins.
- Selecting a Container selects the Container entity rather than implicitly selecting every descendant. Operations whose meaning carries the contained graph state this explicitly.
- Valid bulk operations include Move, quantity change, tag editing, ownership change, Link, Export, Clone, and Delete. Mixed permissions are explained before mutation.
- Move changes physical containment, Link adds a non-weight-bearing relationship, and Clone creates new GUIDs and independent state. Ambiguous Copy terminology is avoided.
- Drag and drop supports common moves and links, visibly identifies valid destinations, gently rejects cycles or missing capabilities, and always has a non-drag equivalent.
- Crossing between private and Group ownership presents the sharing or ownership consequence before mutation.
- A consistent context-aware `+` entry opens the Item Source or creation panel with the current destination preselected. Presets remain editable source definitions that add supported components, Tags, relationships, and defaults.
- Quick-add asks only for quantity and destination when defaults suffice. Full settings remain progressively available.
- Relevant valid actions are shown directly when space permits. Important unavailable actions are disabled with a reason; wholly irrelevant actions are omitted.
- Routine reversible deletion applies immediately with Undo. Irreversible purge, Group disbanding, recursive deletion, and disclosure-sensitive actions require impact preview and confirmation.
- High-impact previews summarize affected entities, descendants, weight, sharing, and permission failures. Routine safe actions do not add confirmation friction.
- Persistent header Undo/Redo is supplemented by concise non-modal action feedback with an immediate Undo control.

### Activity and long work

- Shared activity groups events by actor, time burst, and Container. Entries navigate to the affected entity and historical state.
- Returning users receive one quiet expandable catch-up summary rather than a notification for every remote edit.
- Interruptive notification is reserved for invitations, access changes, rejected work, unresolved conflicts, recovery risk, or explicit attention requests. Routine changes remain in Activity.
- Visible remote changes receive brief attribution without moving targets. Deleted open entities become recoverable historical views instead of disappearing.
- Large import, clone, export, and recursive work runs incrementally with progress and cancellation while local navigation remains responsive.
- Empty states directly expose the most relevant creation, import, or linking action.

## Pending decisions

## Round 10 — accepted browser-native ECS and exact query semantics

### ECS implementation foundation

- Sonatory will implement a focused browser-native ECS in strict JSDoc-typed JavaScript, using JECS as the primary archetype/query reference, b226 for components-as-entities ergonomics, and Flecs for pair and query semantics.
- The implementation uses plain ES modules, `// @ts-check`, strict `checkJs`, no TypeScript application source, no required transpilation, and no runtime package/CDN dependency.
- The ECS uses archetype/SoA storage, dense numeric runtime entity IDs, cached positive/negative/pair queries, deferred structural mutation during iteration, cleanup of pairs targeting deleted entities, and event-to-world materialization.
- Persistent entities use GUIDs. Each loaded world maintains a Vault-local GUID-to-dense-ID identity map so durable distributed identity does not impose string-key overhead on hot runtime paths.
- Runtime relationship pairs intern `(relationshipId, targetId)` into dense IDs. Persistent events store the underlying relationship and target GUIDs.
- The ECS receives property, randomized, differential, cleanup, query-correctness, nested-inventory, and performance tests. Applicable MIT attribution is retained for referenced or translated implementation material.

### Components, Tags, and relationships

- Every component definition is an entity. A component value is ordinary column data attached to a subject; component instances are not separate entities.
- Every Tag is an entity used as a component without data. Tags may themselves receive components and exact Tags, enabling direct metadata without a parallel schema system.
- Component values contain scalars and value objects rather than entity or component references whenever an ECS-native alternative exists.
- A Tag on a Tag is direct metadata only. It does not cause effective-Tag inheritance, `IsA` propagation, ontology traversal, or transitive matching on entities carrying the first Tag.
- Tag assignment is native ECS membership rather than a `tagged-with` relationship record.
- Relationships are sparse Flecs-style `(relationship, target)` pairs used principally to keep entity references out of component data and to enable target-aware queries.
- Initial relationships are limited to demonstrated needs such as ContainedBy, OwnedBy, MemberOf, and explicit LinkedTo. Permission-specific pairs are added only where exact Tags cannot represent the required scoped fact safely.
- Relationship assignments are not independent entities. The event journal provides provenance, attribution, Undo, and collaboration history for adding and removing pairs.
- Relationship inheritance, general relationship metadata, arbitrary cardinality schemas, transitive relationship behavior, and relationship-on-relationship composition are absent unless a concrete requirement makes them necessary.
- ContainedBy is exclusive and cycle-checked by the containment system because of its product semantics, rather than through a universal user-configurable relationship framework.

### Search and panel constraints

- `+A` means the result must directly have the exact visible Tag whose stable GUID was selected as A.
- `-B` means the result must not directly have the exact visible Tag whose stable GUID was selected as B.
- `=C` means the result must directly have the Container-target pair for the exact visible Container whose stable GUID was selected as C.
- Visible tokens use current display names. Stored queries use GUIDs. Autocomplete uses image, ownership, and location context to distinguish duplicate names.
- The `=` operator itself remains direct and exact. A panel that presents a recursively nested scope computes and visibly applies that scope separately rather than silently changing operator meaning.
- Multiple positive Tags use AND, any negative Tag excludes, and multiple Container targets form a union before ordinary text filtering.
- Every search surface combines a visible locked panel query, an editable user query, and the current permission boundary.
- Examples include `+Tag` in the Tag Manager, `+Container +Character` for Characters, `+Container +Party` for Parties, `=<current Container>` for direct contents, and `(MemberOf, current Group)` for Group members.
- Locked terms appear as subdued pinned tokens with an equivalent accessible description. Users refine but cannot remove the panel's defining type or scope constraint.
- Incremental indexes cover archetypes, direct Tags, pairs, text, containment, and permission visibility. No effective-Tag closure index exists.

### Browser-game architectural principle

- Sonatory is architected as a deterministic browser simulation rendered into semantic HTML. Its domain, interaction, update ordering, systems, and performance tuning follow game-loop discipline without turning the interface into a canvas application.
- The ECS owns durable domain state and meaningful ephemeral session/UI state. The DOM is a keyed, accessible render target rather than the source of truth, except for browser-native transient editing concerns such as active text composition, focus, and selection.
- Browser input, resize observation, storage completion, worker completion, cross-tab messages, and network messages enter ordered queues. They do not mutate the world unpredictably from callbacks.
- Systems run in explicit phases, derived work is invalidated incrementally, HTML patches are batched, and the runtime sleeps when no simulation, rendering, or animation work remains.

## Pending decisions

## Round 11 — accepted deterministic simulation, rendering, and update architecture

- Each tab owns an ECS world containing the durable Vault projection plus explicitly nonpersistent session and derived components. Component definitions are marked Durable, Session, or Derived; only Durable mutations create journal events.
- Imports, managed-source refreshes, repair, destructive previews, and complex diffs run in isolated staging worlds before committing an event batch to the active world.
- Sonatory uses an event-driven simulation scheduler that sleeps when idle. Visual animation and DOM rendering use display frames; persistence, coordination, and synchronization never depend on animation frames.
- Browser input handlers enqueue typed intents rather than directly mutating durable state or performing storage and network work.
- Simulation turns have a fixed phase order: ingest external messages, reconcile accepted events, interpret intents, authorize and validate, commit atomic event batches, update derived domain state, update UI/session state, prepare render changes, patch semantic HTML, and dispatch external effects.
- Every system declares its phase, stable system ID, ordering constraints, and component/pair read and write sets. Startup builds a deterministic dependency schedule and rejects cycles, missing dependencies, ambiguous write conflicts, or illegal effect placement.
- Systems that compute durable or derived state are deterministic and effect-free. Storage, network, worker dispatch, logging, and browser integration run through explicit effect systems after a coherent commit boundary.
- ECS structural mutation is deferred during iteration and applied atomically at phase boundaries. No system observes a half-applied move, stack split, import, permission change, or ownership transition.
- One user action produces one identified atomic event batch with one validation result, history label, synchronization unit, and Undo unit.
- Valid local actions update memory immediately. The interface claims Saved locally only after IndexedDB commits the batch. Cloud publication is restricted to locally persisted signed events.
- Persistence failure preserves unsaved work in memory, halts its cloud publication, and offers recovery/export rather than discarding it or falsely reporting success.
- Network, cross-tab, storage, worker, and measurement callbacks append messages to ordered queues. They never mutate the world mid-phase.
- Random IDs, timestamps, locale-sensitive decisions, and other nondeterministic inputs are generated at an explicit boundary and recorded in events. Replaying an accepted journal produces the same durable world.
- Archetype/table iteration order is never used as business meaning. Any durable result that depends on order uses an explicit Ordering component, canonical event position, or stable GUID ordering.
- Weight, breadcrumbs, query matches, stack fingerprints, visibility, layout recommendations, and similar computed values are derived and invalidated incrementally rather than independently authored durable facts.
- Mutations mark only affected queries, containment ancestors, systems, and render regions dirty. Full-world scans, full-page renders, and speculative caching are avoided unless measurement proves them necessary.
- The renderer is a small keyed semantic-HTML patcher rather than a virtual-DOM framework or canvas. It changes only affected attributes, text, and child ranges.
- Active text fields, focus, selection, autocomplete, and IME composition remain browser-native. Rendering may not replace a control while it is being edited.
- Meaningful panels, tabs, carousel targets, selections, drag sessions, notices, and workflows may be UI entities. Decorative DOM nodes are not promoted into ECS entities without behavioral value.
- Systems produce target layout and selection; the renderer interpolates interruptible visual motion. Animated intermediate values are not durable, and reduced-motion settles immediately.
- PDF parsing, image work, hashing, large exports, and expensive verification use immutable worker snapshots where useful. Results carry source revisions so stale results are discarded or recomputed.
- Expensive work is cancellable, divided into bounded units, and yields to ordinary interaction.
- One elected Vault coordinator tab sequences IndexedDB work, owns the relay connection, and performs maintenance. Other tabs submit identified intents and retain independent session UI.
- Coordinator election uses a supported browser lock when available and a renewable IndexedDB lease fallback. Leadership loss does not discard queued intents.
- Background tabs stop visual work. The coordinator continues bounded nonvisual synchronization and persistence, and a returning tab catches up before presenting shared state as current.
- Service-worker application updates download quietly and activate only at a safe point through an Update ready action. Schema migrations create checkpoints, use versioned transformations, run transactionally, and are replay/rollback tested.
- System failure preserves the last coherent world and DOM, prevents unsafe effects, identifies the failing system, and exposes recovery diagnostics.
- Tests replay generated and representative journals through varied delivery order, offline periods, reloads, coordinator changes, migrations, and Undo branches.
- Common local input targets visible feedback within one display frame; carousel motion targets the display refresh rate; ordinary simulation turns retain substantial frame-budget headroom.
- Advanced diagnostics expose system timings, schedule order, dirty queries, archetypes, entity counts, DOM patches, worker jobs, queue depth, and long-frame attribution.
- Extensibility is module-based: each code module registers versioned component/tag definitions, systems, queries, event codecs, migrations, panels, commands, and optional importer adapters through narrow documented interfaces. Modules do not reach into another module's private storage.
- Rewriting a panel, renderer, storage adapter, relay adapter, or importer must not require changing durable entity GUIDs or event meaning. Compatibility boundaries are explicit and versioned.
- Wastelessness is enforced through sleep-when-idle scheduling, incremental invalidation, bounded queues, content-addressed blobs, lazy module loading, worker use only for measured benefit, and performance evidence before adding caches, pools, or indexes.

## Pending decisions

## Round 12 — accepted accessibility and input behavior

- Sonatory targets WCAG 2.2 Level AA throughout, with appropriate AAA improvements where they do not compromise clarity or operation.
- Native semantic HTML elements and landmarks are preferred. ARIA is added only when native semantics cannot express the required interaction and is verified with assistive technology.
- Every pointer, touch, drag, wheel, and hover interaction has a complete keyboard-accessible and visible alternative.
- Focus is clearly visible, density-aware, contrast-safe, and never obscured by headers, clipping, or panels. Workflows place and restore focus predictably.
- Ordinary tiled panels are labelled non-modal workspace regions. Only genuinely blocking confirmations use modal-dialog semantics and contained focus.
- Each carousel is a labelled region containing a semantic card list with native previous/next buttons and no automatic rotation.
- When carousel navigation has focus, Left/Right moves between cards, Home/End reaches boundaries, and Enter opens the centered card. Repeated previous/next activation does not unexpectedly move button focus.
- Each card exposes one primary navigation stop plus an explicit complete action menu. Visible inline actions mirror rather than replace keyboard-accessible commands.
- WAI-ARIA layout-grid behavior is used for inventory grids only if manual assistive-technology testing proves it more usable than simpler list semantics.
- Search is an accessible combobox. Structured tokens announce include Tag, exclude Tag, or inside Container semantics; operators, labels, shapes, and descriptions carry meaning in addition to color. Locked terms are identified as fixed constraints.
- Move and Link destination choosers provide complete equivalents to drag-and-drop. Long-press, swipe, pinch, hover, and precision gestures are never the only route to essential behavior.
- Carousel wheel handling releases at track boundaries and never traps page navigation.
- Operating-system reduced-motion is respected by default with a device-local override. Reduced motion removes animated travel, parallax, pulsing, and decorative transitions while preserving final state.
- Every theme and accent preserves AA contrast and meaning without color. Forced-colors/high-contrast modes retain boundaries, focus, selection, and disabled state.
- Card images adjacent to a visible entity name are decorative to assistive technology. Detailed images use the entity name and may include an optional user-authored description.
- Live regions announce invitations, access changes, rejected work, completion, and actionable failure without narrating routine remote changes or animation.
- Validation identifies the field and problem in plain language, preserves entered data, and moves focus only on submission or explicit error navigation.
- Editing, reading, selection, and recovery have no arbitrary timeout. Invitation expiry is clearly disclosed without interrupting an already active form.
- Keyboard shortcuts use familiar conventions, avoid browser and assistive-technology conflicts, appear in help/tooltips, and always have visible equivalents.
- Remote activity cannot steal focus, modify an active input, collapse context, or move an interaction target unexpectedly.
- Release gates combine automated audits with manual keyboard, zoom, forced-color, reduced-motion, and screen-reader testing across the supported browser matrix.

## Pending decisions

## Round 13 — accepted privacy, retention, onboarding, translation, and personalization

### Privacy and relay retention

- Encrypted hard-free cloud backup is presented as the recommended setup choice but requires explicit selection. A local Vault is never silently uploaded.
- Sonatory includes no advertising, behavioral analytics, third-party trackers, or automatic telemetry.
- Diagnostics remain local unless the user explicitly reviews and sends a redacted report.
- Privacy documentation states that a relay may observe network address, timing, encrypted envelope sizes, opaque identifiers, and membership traffic patterns while remaining unable to decrypt inventory content.
- Application-level operational logs exclude payloads and expire after seven days unless required for an active abuse investigation. Aggregate quota counters may persist longer.
- There is no centralized username search, public Vault directory, or discoverable Group directory. Connections occur through invitations and deliberately saved contacts.
- Invitation secrets decrypt the Group preview on the receiving client rather than publishing a browsable Group preview at the relay.
- Group identity projection includes only the display name, avatar, and public identity key required for collaboration. Device details, unrelated Groups, private Tags, and private Vault content remain undisclosed.
- Presence is Group-scoped, optional, and has no historical last-seen record.
- A Vault folder contains a format manifest, Vault GUID, public identity material, journal, blobs, and everything needed to act as that Vault identity. Possession of a valid complete Vault folder grants the identity without separate device authorization or a Recovery Kit.
- Copying or sharing a Vault folder therefore copies the Vault identity and its authority. Sonatory explains this consequence during folder setup, export, and duplication and provides Clone as New Vault when a new identity is intended.
- Delete is reversible and retains history; Disconnect stops synchronization; Purge irreversibly removes recoverable owned payloads where possible. Purge cannot erase copies previously downloaded by Group members.
- Official hosted Vault and Group replicas expire after 12 months without authenticated activity. Any valid synchronization renews the lease; device and folder replicas are unaffected.
- The hosted expiry date is available in Data & Sync, with a quiet in-app warning beginning 90 days before expiry when Sonatory is opened.
- Email address and phone number are not required for identity, invitations, recovery, expiry warnings, or operation.
- Reset UI preferences, disconnect cloud, remove a local replica, and purge owned hosted content remain separate scoped actions rather than one ambiguous reset.

### Onboarding and help philosophy

- If a previously opened Vault remains available in browser storage, Sonatory opens directly into it. Vault switching remains available from the profile/Vault control.
- With no cached Vault, the first screen shows recent recoverable Vault references when available plus Open Existing Vault and Create New Vault.
- New-Vault setup uses one responsive panel rather than a multi-step wizard. Vault backing, identity summary, display name, optional image, cloud choice, folder choice, recovery consequences, and optional starter configuration are visible together with responsible defaults already selected.
- The setup panel progressively expands explanations without requiring page-to-page clickthrough. One final Create Vault action validates and commits the complete setup.
- A valid existing Vault skips new-profile onboarding and opens directly after validation.
- There is no product-tour checklist or tutorial overlay. Screens, empty states, contextual actions, labels, and disabled-action explanations must make the mechanism for the user's likely goal apparent at the point of need.
- Searchable offline help and contextual Why? explanations remain available for unusually complex subjects such as permissions, synchronization, recovery, and rejected work.
- Advanced controls are plainly discoverable in labelled settings sections rather than hidden behind secret gestures or developer mode.

### Browser translation and textual architecture

- The initial authored interface language is English, but all application text is rendered as semantic selectable HTML with a correct document language and coherent phrases that browser translation tools can recognize.
- Text is not baked into icons, raster images, canvas, CSS generated content, inaccessible tooltips, or closed component boundaries.
- The keyed renderer preserves unchanged text nodes so browser translation does not cause needless subtree replacement or continuous translation churn.
- Names and notes remain Unicode and are preserved exactly in durable data. Normalized representations exist only in search indexes.
- Dates, times, numbers, and decimal input use the active locale while durable values remain canonical exact decimals and UTC timestamps.
- Search operator definitions are registered through a versioned query-language module. `+`, `-`, and `=` are the initial operators, not hard-coded parser assumptions scattered through panels or storage.
- Saved queries store versioned operator IDs, operands, and GUIDs as an abstract syntax tree rather than depending on reparsing the currently displayed punctuation. Syntax can be revised or extended through an explicit migration and display codec.
- CSS uses logical properties and direction-aware icons so browser-translated right-to-left content does not require a layout rewrite.
- Managed and user-authored foreign-language content is displayed normally and may be translated by the user's browser. Sonatory does not introduce its own managed-content locale system in the first release.
- The initial D&D Beyond importer remains limited to explicitly recognized export profiles; browser translation of an on-screen PDF does not make an unsupported PDF structure importable.

### Personalization retained from the prototype specification

- Appearance is device-local by default and applies immediately through design tokens without changing data, permissions, semantic order, or application behavior.
- Color mode supports System, Light, and Dark.
- Accent controls include the original restrained Red, Orange, Yellow, Green, Cyan, Blue, Purple, Magenta, White, Light Gray, Dark Gray, and Black choices plus a custom hue control.
- Custom accents are automatically adjusted or paired with suitable foregrounds and boundaries so user-selected hue cannot make controls, focus, selection, or status illegible.
- Visual theme choices include Flat, Modern, High Fantasy, Low Fantasy, Dark Fantasy, Sci-Fi, and Cozy.
- Themes may alter texture, border character, typography tokens, surfaces, and restrained decorative treatment but may not change information architecture, control locations, semantic order, target size, or accessibility behavior.
- Texture and decorative layers remain subtle, nonessential, and incapable of reducing text or control contrast.
- Accessibility density retains Compact, Normal, and Spacious with Normal as the default. Motion preference and reduced-motion behavior remain independently configurable.
- Appearance changes have an immediate preview plus Apply, Cancel, and Reset to defaults. Cancel restores the complete prior device appearance state.
- Profile initials derive from the current display name and update everywhere immediately after a rename.

## Pending decisions

## Round 14 — accepted Final Draft and implementation structure

- `FINAL-DRAFT-SPEC.md` is the product authority. `ARCHITECTURE.md`, `DATA-MODEL.md`, `SYNC-PROTOCOL.md`, `SECURITY.md`, `IMPLEMENTATION-PLAN.md`, and `ACCEPTANCE-MATRIX.md` elaborate it and may not silently contradict it.
- Before implementation, the document package receives a consistency audit, unresolved-term search, traceability pass, and explicit Final Draft approval.
- Implementation proceeds through tested vertical stages: foundation; ECS and journal; Vault persistence; responsive shell; inventory domain; search and actions; encrypted synchronization; Groups and permissions; assets and import; hardening and deployment.
- Each stage has defined entry criteria, outputs, tests, and exit gates. A later stage cannot make an earlier incomplete capability appear production-ready.
- The static browser client, optional Cloudflare Worker/Durable Object relay, managed-source pipeline, and development/test tooling remain separate deployment and trust boundaries.
- Repository test fixtures contain only synthetic or legally distributable material. Proprietary D&D Beyond PDFs are never committed; ignored private fixtures may be used locally.
- Performance coverage includes Everyday, Large, Deeply Nested, Long History, Multi-Device, and Adversarial profiles and measures incremental behavior rather than render speed alone.
- Automated browser coverage includes Chromium, Firefox, and WebKit. Manual coverage includes representative desktop, phone, tablet, portrait, square, ultrawide, zoomed, keyboard, touch, forced-color, reduced-motion, and screen-reader environments.
- Hosted collaboration cannot launch before threat modeling and security review cover identity copying, Vault folders, invitations, replay, relay abuse, permission changes, metadata, imports, migrations, and recovery.
- Hard-free deployment configuration contains no paid-tier binding or automatic upgrade. Quota-exhaustion tests prove local work continues.
- Application, durable event schema, managed sources, importer profiles, and relay protocol are versioned independently with explicit compatibility declarations.
- Every normative Final Draft requirement receives an acceptance-matrix ID connected to its implementation stage and verification evidence.
- The official deployment is replaceable and exportable. User identity is never bound to a domain, maintainer credential, or Cloudflare account.
- No application code is written until the synthesized Final Draft package is explicitly approved.

## Pending decisions

None. Any inconsistency discovered during synthesis is resolved conservatively from the latest accepted decision and disclosed for review rather than silently invented.

## Synthesis audit resolutions

The final consistency/traceability audit made these conservative clarifications without changing an accepted product outcome:

- The hosted encrypted replica now explicitly covers both a personal Vault synchronization boundary and a Group synchronization boundary. A personal Vault stream does not create a hidden Group, membership, Party, Character, or Container.
- Cloud-only identity recovery uses a high-entropy Recovery Kit and encrypted root recovery envelope. This does not weaken the later folder-possession decision: a complete valid Vault folder remains independently sufficient bearer identity and needs no Kit.
- A Group Entity directly carries the Group Tag plus a `GroupState` data component, reconciling the general Tag model with Group-specific signed policy state.
- Custom numeric values are stored as their own ECS data components rather than a GUID-keyed component map. Explicit-selection Collections use a narrowly justified `SelectedIn` pair rather than an embedded Entity list. `InvitesAs` likewise avoids embedding a role Entity reference.
- The browser cryptographic suite uses versioned Web Crypto P-256 signing/agreement with HKDF-SHA-256, AES-256-GCM, and SHA-256 for the supported-browser baseline. Production collaboration remains blocked on independent specialist review; the suite is versioned so a reviewed successor can migrate independently.
- The acceptance traceability pass produced 187 unique pass/fail requirements across product, storage, ECS, UI, inventory, search, Groups, synchronization, imports, accessibility, privacy, security, and performance.
- Local Markdown links resolve, stale prototype numbers/terms were removed from implementation authorities, and no application code was written.
