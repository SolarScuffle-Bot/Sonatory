# Sonatory Acceptance Matrix

**Status:** Active verification contract; implementation evidence is accumulating in [QA-EVIDENCE.md](QA-EVIDENCE.md), and unproven rows remain **Not run**  
**Authoritative product contract:** [FINAL-DRAFT-SPEC.md](FINAL-DRAFT-SPEC.md)  
**Stage definitions:** [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)

Each row is normative. **Pass** requires the stated observable result and retained evidence. Automated checks are necessary but do not replace the manual interaction/accessibility evidence named here. A row may be marked **Not applicable** only through an approved specification change.

Future evidence lives under stable IDs matching these rows, with CI artifacts or Markdown records linking the exact build, browser/device, fixture seed, and result. Screenshots alone cannot prove persistence, accessibility semantics, authorization, or conflict recovery.

## A. Product, runtime, and deployment

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| PR-01 | §1 | Product is usable for individual inventory entirely offline after first load, with no login or relay. | Offline browser test + manual cold-network exercise | 2 |
| PR-02 | §1, §3 | Production client is static semantic HTML/CSS/plain ES modules with no framework, runtime CDN, package loader, tracker, ad, or analytics call. | Release manifest/network/CSP audit | 0, 9 |
| PR-03 | §3 | Current and previous Chrome, Edge, Firefox, and Safari run supported core behavior; unavailable APIs have documented fallbacks. | Cross-browser matrix | 9 |
| PR-04 | §3 | App installs as a PWA where supported and remains an ordinary website where not. | Install/offline/manual matrix | 9 |
| PR-05 | §3 | Official optional collaboration configuration uses only hard-free Cloudflare resources; quota failure cannot charge or lock local data. | Config audit + forced-quota test | 6, 9 |
| PR-06 | §3 | A custom/local relay passes the same protocol contract; changing relay does not change Vault/Group identity. | Black-box relay suite + migration exercise | 6 |
| PR-07 | §1 | No proprietary D&D list, logo, trade dress, scraped content, or access-control bypass ships with Sonatory. | Legal/source/license audit | 4, 9 |
| PR-08 | §1 | No privileged built-in-library/share-pack product subsystem exists; managed defaults and shareable Collections use general Entities. | Product-copy/schema inspection | 4, 9 |
| PR-09 | §19 | Application, event schema, managed source, importer profile, and relay protocol versions negotiate/migrate independently. | Compatibility/migration matrix | 9 |
| PR-10 | §20 | No specified behavior is represented by a nonfunctional stub in a production-complete build. | Full matrix review + exploratory audit | 9 |

## B. Vault identity, onboarding, and storage

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| VA-01 | §4 | New Vault gets random persistent GUID and cryptographic root identity; no name/server-derived ID. | Key/GUID invariant tests | 2 |
| VA-02 | §4 | Multiple Vaults act as separate users and can be switched without cross-Vault state leakage. | Browser storage isolation test | 2 |
| VA-03 | §4 | Complete valid Vault folder possession grants identity, and the UI clearly warns that copying it copies authority. | Recovery exercise + copy review | 2 |
| VA-04 | §4 | Clone as New copies allowed data but generates new root/device/GUID identity and does not retain Group authority. | Identity-diff integration test | 2 |
| VA-05 | §4 | Browser IndexedDB is a complete active working replica; folder/cloud/archive are optional backing choices. | Mode matrix with each backing absent | 2 |
| VA-06 | §4 | If a cached prior Vault is valid, app opens directly into it and keeps a discoverable Vault switcher. | Returning-user browser test | 2 |
| VA-07 | §4 | With no cached Vault, one setup panel shows recent/open/create, display name, optional image, backing choice, and responsible defaults without a wizard. | First-run manual/click-count test | 2 |
| VA-08 | §4 | Valid metadata folder opens existing Vault and skips new-user creation; non-empty folder without valid metadata is rejected and unmodified. | Filesystem fixture/hash-before-after test | 2 |
| VA-09 | §4 | Losing folder permission or network pauses that backing only; local work continues and freshness is accurate. | Permission-revoke/offline tests | 2 |
| VA-10 | §4, §19 | Atomic local commit/crash recovery never exposes a half-applied command or loses acknowledged outbox work. | Crash injection at every boundary | 1, 2 |
| VA-11 | §4 | Full Vault export/archive verifies hashes and restores identity/data; graph export stages a dry-run collision/provenance plan. | Round-trip/corruption tests | 2 |
| VA-12 | §4, §16 | Changing display name immediately changes fallback profile initials; an uploaded profile image replaces initials. | DOM/state integration test | 2, 3 |
| VA-13 | §4 | Hosted backup is recommended but opt-in; enabling it creates/acknowledges an encrypted Recovery Kit, and no local Vault is silently uploaded. | First-run/network/storage audit | 2 |
| VA-14 | §4 | Hosted replica plus Recovery Kit restores root identity/data; complete Vault folder restores without a Kit; wrong/corrupt Kit fails without mutation. | Recovery/crypto/corruption tests | 2, 6 |
| VA-15 | §4 | New device enrollment works through approved QR/one-time code, folder, or Recovery Kit; passkey is optional and email/phone is never required. | Device/recovery modality matrix | 2, 6 |
| VA-16 | §12 | **Saved locally** appears only after atomic IndexedDB commit, and only persisted signed events may enter cloud outbox/Push. | Commit/failure/UI trace tests | 1, 2, 6 |

## C. ECS, journal, and data invariants

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| EC-01 | §8 | Component definitions are queryable Entities; component values are column data; instances are not Entities. | ECS model/property tests | 1 |
| EC-02 | §8 | Durable GUIDs map to dense generational runtime IDs, and no dense ID reaches serialized data. | Codec/invariant fuzz tests | 1 |
| EC-03 | §8 | Tags are data-less component Entities and may themselves carry direct Tags/components as metadata. | Query/model tests | 1 |
| EC-04 | §8 | Tag matching is exact/direct with no effective inheritance; tagging Potion with Consumable never changes Potion instances unless directly tagged. | Explicit truth-table tests | 1, 5 |
| EC-05 | §8 | Relationships are sparse predicate-target pairs; initial ContainedBy, OwnedBy, MemberOf, LinkedTo semantics/cardinalities hold. | Pair index/cardinality tests | 1, 4 |
| EC-06 | §8 | Relationship assignments are not Entities and no IsA/effective-Tag/relationship ontology is introduced. | Schema/API audit | 1, 9 |
| EC-07 | §1, architecture | Browser callbacks enqueue; ordered phases/systems deterministically commit and render; re-entrant mutation is rejected. | Scheduler trace/property tests | 1 |
| EC-08 | architecture | System read/write/order declarations sort consistently and cycles/conflicting undeclared writes fail bootstrap. | Schedule graph tests | 1 |
| EC-09 | §13 | Journal history begins with recording and has no product count/time limit; checkpoints/cold segments never discard it. | Long History profile + export/replay | 1, 9 |
| EC-10 | §13 | Undo/Redo are visible and append compensating operations; collaborative Undo targets the actor’s action without deleting others’ history. | Unit/multi-device/manual tests | 1, 3, 6 |
| EC-11 | §19 | Failed system/frame preserves last coherent ECS/DOM, dispatches no unsafe effect, and exposes recovery diagnostics. | Fault injection + manual recovery | 1, 9 |
| EC-12 | architecture | One generation-fenced coordinator writes per Vault across tabs; coordinator death recovers without dual commit. | Forced race/browser test | 1 |
| EC-13 | architecture | ECS implementation documents JECS/b226/Flecs behavioral mapping, keeps runtime dependency-free, and preserves applicable attribution for any translated source. | Architecture/source/license audit | 1, 9 |
| EC-14 | §8, data model | Custom numeric values live in their component’s own column, and explicit Collection membership uses `SelectedIn` pairs; no GUID-keyed numeric map or Entity-list component bypasses ECS rules. | Schema/archetype/query audit | 1, 4, 5 |

## D. Application shell, panels, responsive layout, and personalization

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| UI-01 | §5 | Header is short and contains navigation/context, visible Undo/Redo, contextual create, and profile/Vault access without dominating viewport. | Viewport measurement/manual review | 3 |
| UI-02 | §5 | Recently opened tabs retain stable order when selected, show title/type/dirty state, and offer keyboard-accessible close/reopen behavior. | DOM-order/keyboard tests | 3 |
| UI-03 | §5 | One panel centers and uses only useful content size; multiple panels tile/reposition/resize within viewport. | Panel constraint test matrix | 3 |
| UI-04 | §5 | When tiling cannot preserve readable minima, panels become stable-order tabs; narrow mobile uses one-panel back stack. | Viewport/zoom interaction tests | 3 |
| UI-05 | §5 | Required content/actions never land offscreen; ordinary panels are non-modal and focus restores logically on close. | Keyboard/zoom/manual audit | 3 |
| UI-06 | §16 | Density offers Compact, Normal, Spacious; Normal is default and setting is device-local. | Settings/state tests | 3 |
| UI-07 | §16 | Theme offers System/Light/Dark, specified accent palette plus custom hue, and Flat/Modern/High Fantasy/Low Fantasy/Dark Fantasy/Sci-Fi/Cozy. | Settings/snapshot matrix | 3 |
| UI-08 | §16 | Themes change presentation but never feature meaning, content order, permissions, layout rules, or accessibility status. | Semantic DOM/diff/contrast tests | 3 |
| UI-09 | §16 | Motion setting and system reduced-motion are respected without losing state/navigation feedback. | Media-query/manual tests | 3 |
| UI-10 | §16 | Visible prose uses stable semantic selectable text nodes suitable for browser translation; no required text is in image/canvas/CSS content. | DOM/pseudo-translation audit | 3, 9 |
| UI-11 | §5, §17 | Phone, square, portrait/landscape monitor, 1920×1080, ultrawide, huge TV, and browser zoom use available space without waste or unreadable density. | Full viewport screenshot + interaction matrix | 3, 9 |
| UI-12 | §19 | App update downloads safely, announces Update ready, and never reloads during editing/import/migration/unsaved work. | Service-worker lifecycle tests | 9 |
| UI-13 | §5 | No forced tour/checklist exists; empty states and disabled actions expose likely next steps, while offline help/Why? and labelled Advanced sections explain complex machinery. | First-run/task-discovery/manual audit | 3, 9 |

## E. Home Collections, carousels, cards, images, and chips

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| CA-01 | §6 | Each Collection is one genuine horizontal carousel/track, never a grid, overlapped stack, perspective, rotation, or 2.5D presentation. | DOM/CSS geometry tests + review | 3 |
| CA-02 | §6 | All cards in one carousel have equal width and height, fully fill the useful track, and never overlap. | Bounding-box tests at viewport matrix | 3 |
| CA-03 | §6 | Prev/next, keyboard, touch/pointer pan, and wheel-over-card traverse the carousel and settle target at track/screen center when feasible. | Input modality tests | 3 |
| CA-04 | §6 | Wheel translation yields to page scrolling at carousel boundaries and never traps the user. | Boundary wheel/trackpad manual test | 3 |
| CA-05 | §6 | Reduced motion makes carousel changes immediate/non-disorienting while target/focus remains clear. | Reduced-motion tests | 3 |
| CA-06 | §6 | At 1920×1080 horizontal targets are approximately 6 Spacious, 8 Normal, 10 Compact cards. | Computed-geometry assertions | 3 |
| CA-07 | §6 | At 1920×1080 complete vertical carousel sections are approximately 2 Spacious, 2 Normal, 3 Compact. | Viewport assertions | 3 |
| CA-08 | §6 | Cards remain readable semantic regions; text/tags/stats never overflow, and extra content uses an explicit accessible `+N` disclosure. | Long-content/pseudo-locale tests | 3 |
| CA-09 | §6 | Container card prioritizes name, useful context, concise inventory preview, quantities, Weight, and relevant links without showing partial misleading data. | Content priority/manual review | 4 |
| CA-10 | §6, §14 | Item/Container has no Icon field. Optional uploaded image is square and left of content; absent image leaves no placeholder/reserved gap. | Schema/DOM/geometry tests | 3, 4 |
| CA-11 | §6 | Linked chips match Tag-chip styling, show optional image left/title right, and are real clickable/keyboard links to the target. | DOM role/navigation tests | 3, 5 |
| CA-12 | §6 | Direct card actions appear when space permits; constrained cards expose the same relevant actions through ellipsis without clipping. | Responsive action-parity test | 4, 5 |

## F. Inventory, Containers, stacks, weight, and fields

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| IN-01 | §9 | Container panel shows a responsive item preview grid and useful summary; list mode where used keeps quantity controls inside/right-aligned. | Geometry/interaction tests | 4 |
| IN-02 | §9 | Every entry shows its exact total Weight contribution; Container totals include all legal nested descendants. | Reference-model/property tests | 4 |
| IN-03 | §9 | Weight is exact abstract decimal with no unit definition/conversion UI; contexts may imply a display label only. | Schema/rounding/UI audit | 4 |
| IN-04 | §9 | Custom numerical fields support label, exact decimal, precision, optional bounds; no formulas/automatic aggregation except Weight. | Validation/round-trip tests | 4 |
| IN-05 | §9 | An Entity can be both Item and Container, appear inside a parent, and open its Container page from inventory. | Route/domain integration test | 4 |
| IN-06 | §9 | Container-item is automatically linked by direct ContainedBy to its parent and has at most one active physical parent. | Pair/cardinality tests | 4 |
| IN-07 | §9 | Stacked container-items share visible contents until selected quantity is split/edited; edit clones only affected logical copy/path. | Copy-on-write model tests | 4 |
| IN-08 | §9 | Diverged stacks do not merge; restoring all observable recursive equality allows merge again. | Chest/bags/swords scenario | 4 |
| IN-09 | §9 | Hash accelerates comparison but a collision-safe recursive verify is required before merge. | Injected-collision test double | 4 |
| IN-10 | §9 | Direct/indirect recursive containment is blocked before local mutation with a gentle reason; imported/remote cycle is quarantined. | Deep/adversarial cycle tests | 4, 6 |
| IN-11 | §9 | Quantity changes preserve nonnegative integer invariants, are undoable, and update Weight/fingerprint incrementally. | Property/replay tests | 4 |
| IN-12 | §9 | Deep profile finishes iteratively without call-stack overflow or exponential recomputation. | Instrumented performance test | 4, 9 |

## G. Creation, Item Sources, managed defaults, Tags, and Collections

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| CR-01 | §10 | Contextual create presents only relevant nearby choices with a stable route to all available definitions. | Workflow/click-count review | 4 |
| CR-02 | §10 | Item creation popup is driven by ordinary Item Source Entities, not a hard-coded privileged-library/share-pack concept. | Schema/adapter test | 4 |
| CR-03 | §10 | Default tiles are Unique, Custom, Item, Created, D&D, and `+`; user can edit/reorder/hide/delete/recreate them. | CRUD/persistence tests | 4 |
| CR-04 | §10 | Item Source customization can configure reviewed commands but cannot execute arbitrary user JavaScript. | Security/schema audit | 4, 9 |
| CR-05 | §10 | Managed defaults are tagged/provenanced normal Entities refreshed at load/when reachable without blocking local use. | Offline/refresh tests | 4 |
| CR-06 | §10 | User override, suppression tombstone, detach, reset, and compare survive managed-source updates and are undoable. | Multi-version overlay suite | 4 |
| CR-07 | §10 | Upstream name collision never overwrites unrelated user Entity; source stable keys/GUIDs govern reconciliation. | Collision tests | 4 |
| CR-08 | §10 | Bundled D&D source contains only verified/attributed SRD 5.1/5.2.1 material. | Dataset/license diff audit | 4, 9 |
| CR-09 | §7 | Collection can be saved query or explicit selection using stable GUIDs; missing/tombstoned references remain visible/repairable. | Round-trip/recovery tests | 5 |
| CR-10 | §8 | Character and Party are exact Tags applied to Containers only; neither is a special class or Group synonym. | Schema/command validation tests | 4 |

## H. Search, selection, and contextual actions

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| SE-01 | §7 | Search behaves as ordinary browser-like free text until a recognized `+`, `-`, or `=` structured token begins. | Parser/IME/manual tests | 5 |
| SE-02 | §7 | Structured token appears inline-code-like: `+` green, `-` red, `=` neutral/white, with non-color labels/semantics. | DOM/forced-colors/screen-reader tests | 5 |
| SE-03 | §7 | `+A` requires direct exact Tag A; `-B` excludes direct exact Tag B; `=C` requires direct exact containment/link to Container C. | Operator truth-table/property tests | 5 |
| SE-04 | §7 | UI displays names but saved/evaluated operand is GUID; duplicate names are disambiguated by accessible dropdown context. | Rename/ambiguity tests | 5 |
| SE-05 | §7 | Operators are modular/versioned and saved AST stores operator IDs/versions/GUIDs, remaining migratable if punctuation changes. | Codec/migration/plugin tests | 5 |
| SE-06 | §7 | Panel baked clauses are visible locked tokens; Tag Manager includes immutable `+Tag` and cannot return non-Tags. | Panel/query integration test | 5 |
| SE-07 | §7 | Autocomplete supports keyboard, pointer, touch, assistive-tech announcement, escape, and IME without corrupting native editing. | Input/screen-reader matrix | 5 |
| SE-08 | §7 | Selection count/scope is visible; navigation/filter refresh never silently retargets a pending bulk action. | State/race tests | 5 |
| SE-09 | §7 | Common relevant action is direct; ellipsis contains all remaining relevant actions only when space/context requires it. | Action inventory/click-count audit | 5 |
| SE-10 | §7 | Search meets Everyday/Large latency budgets and permissions filter hidden results before projection. | Performance/security tests | 5, 9 |
| SE-11 | §7 | Quoting/escaping preserves spaces and literal leading operators; Ctrl/Cmd+K opens the same visible search capability without being the only route. | Parser/keyboard/manual tests | 5 |

## I. Groups, friends, invites, and permissions

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| GP-01 | §11 | Group is collaboration principal; creating one does not create any Container/Party/Character. | Domain integration test | 7 |
| GP-02 | §11 | Authorized member can create Group-owned Containers/Entities and independently apply permitted Tags. | Permission/domain test | 7 |
| GP-03 | §11 | Group hub orders Join a Group above Friends & Members, shows friends/members/Groups/Create, and clearly exposes invite-code/link paste/redeem. | Manual/DOM order test | 7 |
| GP-04 | §11 | Clicking a Group/user expands members owner-first; permission actions use ellipsis rather than ambiguous arrows. | Interaction/order test | 7 |
| GP-05 | §11 | Viewer/Editor/Manager/Owner shipped exact role Tags and custom role Tags map to signed capability policy. | Authorization matrix | 7 |
| GP-06 | §11 | Ordinary Tag editing cannot change signed authority or escalate privileges. | Adversarial command/protocol test | 7 |
| GP-07 | §11 | Multiple Owners are allowed; transition to zero Owners is rejected; any Owner can disband/delete Group. | Policy state-machine tests | 7 |
| GP-08 | §11 | Ordinary invitation cannot grant Owner; inviter cannot grant beyond own policy. | Invite authorization tests | 7 |
| GP-09 | §11 | Invite link/code appears inline with Copy and local QR; link has seven-day default, use count, role, approval, single/reusable, pause/revoke/regenerate. | Invite UI/protocol matrix | 7 |
| GP-10 | §11 | Removing/revoking member blocks future authorized Push/key epochs and rotates current keys without claiming prior-copy erasure. | Multi-device security test + copy review | 7 |
| GP-11 | §11 | New member sees current state/history from join point; earlier history requires explicit Owner grant. | Cryptographic join tests | 7 |
| GP-12 | §11 | Presence is optional, ephemeral, Group-scoped, with no public directory/last-seen history. | Privacy/network/storage audit | 7 |
| GP-13 | §11 | Permission inheritance/exceptions are visible; unauthorized names, counts, Tags, relationships, autocomplete, previews, Activity, Weight, and other derived values do not leak. | Hidden-data authorization matrix | 5, 7 |
| GP-14 | §11 | Known unavailable actions are irrelevant/omitted or read-only/disabled with reason and Request access where meaningful. | Capability/UX scenario tests | 5, 7 |

## J. Sync, conflicts, freshness, and relay recovery

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| SY-01 | §12 | Shared events commit locally first and durable outbox survives restart; Pull–validate–Push reconciles later. | Offline/restart/fault tests | 6 |
| SY-02 | §12 | Relay assigns one strongly consistent gap-free canonical sequence per Vault/Group synchronization boundary while clients retain local replicas. | Concurrency contract test | 6 |
| SY-03 | §12 | Relay stores synchronized personal-Vault and Group content/events/snapshots encrypted end-to-end and cannot derive plaintext from stored records. | Protocol capture/crypto audit | 6, 9 |
| SY-04 | §12 | Duplicate identical operation is idempotent; altered operation-ID reuse/replay/tampering is rejected. | Mutation/property tests | 6 |
| SY-05 | §12 | Relative quantity edits commute; competing absolute sets preserve alternatives/base; different fields combine. | Permutation conflict suite | 6 |
| SY-06 | §12 | Concurrent moves yield one valid parent and preserve losing destination intent; cycle-causing move quarantines. | Multi-device graph tests | 6 |
| SY-07 | §12 | Delete vs later offline edit keeps tombstone plus recoverable edit branch; Notes conflicts preserve complete versions for manual merge. | Conflict/recovery tests | 6 |
| SY-08 | §12 | Routine deterministic resolutions do not interrupt; only true unresolved ambiguity becomes Action needed with focused choices. | UX conflict scenario review | 6 |
| SY-09 | §12 | Content, permission, managed-source, backup, and application freshness remain independent; UI summarizes Current/Waiting/Connection needed/Action needed. | State-machine/UI tests | 6 |
| SY-10 | §12 | After 30 days permission staleness, edits are clearly private until revalidation; no work is discarded if rejected. | Simulated-clock branch tests | 6, 7 |
| SY-11 | §12 | Device dormancy/key rotation occurs at 90 days/revocation; reauthorization is recoverable. | Simulated-clock/key tests | 6, 7 |
| SY-12 | §12 | Official hosted data expires after 12 inactive months; when app opens/reaches relay warnings begin 90 days before; local copies remain. | Simulated expiry/reseed test | 6, 9 |
| SY-13 | §12 | Quota/overload/outage backs off, keeps outbox, explains state, and allows export/custom relay/wait without normal-user machinery overload. | Forced provider failure/manual review | 6 |
| SY-14 | §12 | Owner-signed relay migration/recovery preserves verified chain and divergent private branches; domain/account is not identity. | Disaster/handoff exercise | 6, 9 |
| SY-15 | §12, §15 | Remote changes cannot reorder tabs, move panels/targets, resize cards, steal focus, replace active input, or break active drag/scroll/selection; conflicting projection waits safely. | Concurrent-interaction browser tests | 3, 6 |
| SY-16 | §14 | Official soft allocation starts around 25 MB/personal Vault and 100 MB/Group; blob exhaustion cannot consume reserved history/operation capacity or block ordinary synchronization. | Quota partition/failure tests | 6, 9 |

## K. History, activity, deletion, and recovery

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| HI-01 | §13 | Visible convenient Undo/Redo work with mouse, keyboard shortcuts, and touch; labels identify next action where space permits. | Modality/manual tests | 1, 3 |
| HI-02 | §13 | Branches/redo alternatives are retained rather than destroyed by a new edit; history has no artificial count limit. | Journal branch/property tests | 1 |
| HI-03 | §13 | Normal Delete is reversible tombstone; Restore retains references/history. | Domain/replay tests | 4 |
| HI-04 | §13 | Purge is separate, dependency-previewed, explicitly confirmed, irreversible for selected copies, and truthful about member copies. | Destructive-flow/security review | 7, 9 |
| HI-05 | §15 | Activity reads as human actions, links actor/affected Entities, supports useful filters, and relates Undo/compensation without exposing internal noise. | Activity UI/manual review | 5 |
| HI-06 | §15 | Notifications are limited to actionable collaboration/import/update/recovery changes and can be reviewed later. | Notification scenario audit | 5, 7 |
| HI-07 | §19 | Advanced diagnostics expose schedule, dirty queries, journal/branch/key/quota/worker state but remain out of ordinary workflows. | Diagnostics/manual audit | 9 |
| HI-08 | §19 | Schema migration checkpoints, replay tests, and transactional rollback make failed migration recoverable/exportable. | Cross-version fault tests | 9 |
| HI-09 | §15 | Large import/clone/export/query/recursive work is bounded, shows progress/cancel where safe, keeps navigation responsive, and discards stale worker results. | Long-task/revision/cancel tests | 4, 5, 8, 9 |

## L. D&D Beyond import, general import/export, and assets

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| IM-01 | §14 | Character Container preset offers Blank, Import New, and Update Existing; update has explicit target chooser. | UI workflow tests | 8 |
| IM-02 | §14 | Only recognized D&D Beyond Export-to-PDF structure is accepted; generic/unofficial/flattened/encrypted/malformed/unrecognized files are rejected before mutation. | Synthetic/adversarial fixture suite | 8 |
| IM-03 | §14 | Rejection explains why, tells user to select a D&D Beyond exported PDF or cancel, and preserves current state. | Error-copy/state tests | 8 |
| IM-04 | §14 | Extracted data is limited to character name, item names/quantities, explicit equipment/container state, and carry/load totals/capacity. | Golden proposal tests | 8 |
| IM-05 | §14 | Item match order is exact managed name, declared alias, unique normalized match; ambiguous/unmatched becomes Unique, never fuzzy-guessed. | Matching truth-table tests | 8 |
| IM-06 | §14 | Import New and Update Existing show dry-run; Update Existing uses a three-way diff and preserves local/ambiguous changes. | Import/reimport scenario tests | 8 |
| IM-07 | §14 | PDF parsing is local in isolated worker with pinned lazy vendored PDF.js; actions/scripts/external navigation are disabled. | Network/CSP/malicious PDF audit | 8, 9 |
| IM-08 | §14 | Original PDF is neither uploaded nor retained unless user explicitly chooses Attach. | Network/storage audit | 8 |
| IM-09 | §14 | Adapter interface is provider-neutral; a synthetic second provider requires no core importer rewrite. | Extension conformance test | 8 |
| IM-10 | §14 | Archive/image/PDF byte, expansion, page, pixel, depth, and time budgets fail safely/cancellably without partial state. | Bomb/fuzz/resource tests | 8, 9 |
| IM-11 | §14 | Safe images are metadata-stripped/re-encoded as needed, square-cropped for display, and never run active SVG/HTML. | Image corpus/security tests | 8 |
| IM-12 | §14 | Proprietary D&D Beyond PDFs/data are absent from repository/CI; only synthetic/legal SRD fixtures are committed. | Repository/license scan | 0, 9 |
| IM-13 | §14 | D&D Beyond recognition/field profiles are signed, versioned managed data; unknown/new layouts remain rejected until a vetted profile is installed. | Signature/version/update tests | 8 |

## M. Accessibility and input parity

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| AX-01 | §17 | WCAG 2.2 AA automated checks and named manual screen-reader/browser matrix have no unresolved blocking failure. | Audit reports | 3–9 |
| AX-02 | §17 | Semantic native elements are used first; added ARIA patterns are complete and tested, not decorative. | Accessibility tree/code audit | 3–9 |
| AX-03 | §17 | Every action has keyboard, pointer, and touch-equivalent access; no hover-, drag-, wheel-, or long-press-only function. | Modality inventory tests | 3–9 |
| AX-04 | §17 | Focus is visible, logical, restored after close/delete, not reordered with tabs, and not lost by DOM patch/virtualization. | Keyboard/IME/browser tests | 3–9 |
| AX-05 | §17 | Carousels have labels, nonautomatic movement, controls/status, keyboard navigation, and boundary escape. | Screen-reader/keyboard tests | 3 |
| AX-06 | §17 | Search structured tokens/autocomplete implement an understandable combobox/token experience with errors and locked clauses announced. | Named screen-reader tests | 5 |
| AX-07 | §17 | 200% and 400% zoom, reflow, text spacing, forced colors, high contrast, and reduced motion retain content/actions without two-axis page traps. | Manual/automated matrix | 3, 9 |
| AX-08 | §17 | Functional text is at least 14px at 100%; body targets ~15/16/18 by density; content never clips/spills under long text. | Computed-style/overflow tests | 3 |
| AX-09 | §17 | Visual controls target 32/40/48 by density while coarse-pointer hit targets reach at least 44 CSS px or have equivalent spacing. | Geometry/pointer tests | 3 |
| AX-10 | §17 | Color is never sole meaning; all shipped theme/accent/state combinations meet required contrast including focus. | Exhaustive contrast/forced-color tests | 3, 9 |
| AX-11 | §17 | No arbitrary timeout removes content or prevents completion; invite/security expiry is explained and recoverable. | Timed-behavior audit | 7, 9 |
| AX-12 | §17 | Touchscreen users always have visible Undo/Redo and accessible alternatives to context menus/ellipsis hover. | Mobile assistive/manual tests | 3–9 |

## N. Security, privacy, retention, and failure safety

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| SP-01 | §18 | No public directory, ad/tracker/behavior analytics, remote-font beacon, or undisclosed telemetry exists. | Network/source/privacy audit | 9 |
| SP-02 | §18 | Relay metadata, E2EE limits, hard-free capacity, retention, folder bearer identity, and deletion limits are disclosed before enabling relevant feature. | Product-copy/legal/privacy review | 6, 9 |
| SP-03 | §18 | Relay operational logs contain no payload/user text and expire in ≤7 days absent documented abuse/legal hold. | Deployment/log integration audit | 6, 9 |
| SP-04 | §18 | Presence is opt-in/Group-scoped/ephemeral and creates no last-seen product history. | Protocol/storage/privacy tests | 7 |
| SP-05 | §18 | Disconnect, Remove local copy, Delete, Disband, and Purge are distinct actions with accurate scope/recovery language. | UX/destructive-action review | 7, 9 |
| SP-06 | security | CSP/default-deny, no eval/inline/user HTML, safe text rendering, headers, and service-worker cache isolation block injection classes. | CSP/injection/security tests | 0, 9 |
| SP-07 | security | Vault/device keys, manifests, events, receipts, invitations, encryption epochs, and revocation meet the versioned suite and fail closed. | Crypto vectors/protocol review | 6, 9 |
| SP-08 | security | Relay cannot cross-read/write Vault/Group synchronization boundaries; actor capability and authorization/manifest transitions are transactionally validated. | Cross-tenant/authorization tests | 6, 9 |
| SP-09 | security | File/archive/PDF/image parsers resist path traversal, execution, expansion/decode bombs, huge graphs, and partial imports. | Fuzz/adversarial suite | 8, 9 |
| SP-10 | security | Production collaboration receives independent cryptographic/application review; no unresolved Critical/High confidentiality/authorization/integrity issue remains. | External report/remediation record | 9 |
| SP-11 | §18 | Local diagnostic export is explicit, previewable/redactable, and never uploaded automatically. | Network/manual test | 9 |
| SP-12 | security | Dependency versions/hashes/licenses/update owners are recorded; no undeclared runtime dependency or proprietary fixture ships. | SBOM/license/release audit | 0, 9 |
| SP-13 | security | Official Turnstile use is limited to expensive allocation/suspicious abuse actions, disclosed when invoked, absent from routine/local use, and not identity authority. | Endpoint/network/privacy audit | 6, 9 |
| SP-14 | §18 | Group projection exposes only required display/avatar/public identity; device details, unrelated Groups, private Tags/data remain hidden; invite preview is client-decrypted, not publicly browsable. | Protocol/network/privacy tests | 7, 9 |
| SP-15 | security | Relay stores no plaintext root key or Recovery Kit secret; recovery envelope is authenticated/encrypted and verifies root identity before restore. | Crypto vectors/capture/mutation tests | 2, 6, 9 |

## O. Performance, robustness, and production completion

| ID | Source | Pass criteria | Required evidence | Stage |
|---|---|---|---|---:|
| PF-01 | architecture | Scheduler sleeps while idle and outside callbacks do not cause polling/frame loops. | Performance trace/power audit | 1, 9 |
| PF-02 | plan | Everyday and Large startup/edit/search budgets pass on recorded reference desktop/mobile environments. | Repeated benchmark report | 9 |
| PF-03 | architecture | Derived Weight/fingerprint/query/permission caches invalidate incrementally and always match slow full reference computation. | Model/property/performance tests | 4–9 |
| PF-04 | plan | Deep profile uses iterative bounded work without stack overflow/exponential time; carousel/input remains responsive during worker tasks. | Complexity instrumentation/trace | 9 |
| PF-05 | plan | Long History profile retains 1,000,000 events, opens from checkpoint within budget, and can replay/export cold segments. | Benchmark/recovery report | 9 |
| PF-06 | plan | Multi-device profile with reordering/duplicates/drops converges deterministically and preserves every private/conflict branch. | Seeded chaos report | 6, 9 |
| PF-07 | plan | Adversarial inputs stop within budgets, make no partial durable mutation, and provide useful recovery/reporting. | Fuzz/resource/fault report | 8, 9 |
| PF-08 | §19 | Update/migration/crash/relay-loss/quota/folder-loss disaster exercises preserve local access and documented recovery. | Release disaster runbook results | 9 |
| PF-09 | plan | Release is reproducible, static-hostable, installable, and its asset/schema/license hashes match manifest. | Clean-room build/deploy test | 9 |
| PF-10 | §20 | Every row in this matrix is Pass with linked evidence before “production-complete” is used. | Signed release checklist | 9 |

## Evidence status legend

- **Not run** — implementation/evidence does not yet exist.
- **In progress** — partial evidence exists but all required environments or assertions have not passed.
- **Pass** — acceptance criteria and all named evidence pass on the referenced build.
- **Blocked** — a documented external condition prevents evidence; this never counts as production-complete.
- **Fail** — observable behavior contradicts the row.

The living evidence index may add status, owner, build, artifact links, and issue links to each stable ID. It must not rewrite the criteria without the specification change-control process.
