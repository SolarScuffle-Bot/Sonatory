# Sonatory QA Evidence

**Status:** Living implementation evidence, not a production-complete declaration  
**Last updated:** 2026-08-12  
**Build surface:** unbundled static ES modules from `server.mjs`

This record supplements the normative [Acceptance Matrix](ACCEPTANCE-MATRIX.md). A successful smoke test does not silently mark adjacent requirements as complete. Failures found during exploratory testing are fixed and added to regression coverage where the behavior has a pure or integration-test boundary.

## Automated verification

`npm run check` currently passes 51 tests covering:

- exact-decimal Weight, display beyond IEEE-754 precision, linear all-container totals, and iterative nested-container traversal;
- containment-cycle rejection, structural stack split/restack, and retained Undo/Redo branches;
- ECS component Entities, archetypes, exact Tags, sparse pairs, GUID/runtime-ID fencing, and durable snapshot rules;
- GUID-bound structured queries, Tag deletion semantics, managed SRD refresh, overrides, and suppression;
- editable Item Sources and Collection identity/uniqueness validation;
- portable Friend contact codes and strict Group membership/role validation;
- static HTTP security headers and the authenticated relay contract;
- strict D&D Beyond PDF recognition, extraction, progress, and generic/malformed rejection;
- canonical relay ordering, idempotency, quotas, isolation, device chains, and fail-closed signatures;
- Vault validation, device-local export exclusion, folder-history reconciliation, unsafe-image rejection, hostile-history-path rejection, and a 2,000-deep validation chain;
- Web Crypto envelope encryption/signing, receipt verification, pull/decrypt, and tamper rejection through the real HTTP relay, including two separately signed authorized devices verifying one another without trusting the relay head; and
- the Cloudflare Worker client contract, strict origin policy, hard personal-Vault quota cap, opaque-at-rest records, and Durable Object eviction/rehydration.
- deterministic same-Container reordering, cross-Container transfer, cycle rejection, exact Undo restoration, and UI contracts for the shared compact row, Pointer Events, independent adjacent Item/Tags actions, two inventory modes, tooltip descriptions, and compact field-icon stats.

## Inventory presentation regression pass — 2026-08-12

- Tags measured 928×875.2 px at a 1014×994 viewport, matching the centered single-panel width contract. Its `scrollWidth` was 911 px against a 911 px `clientWidth`; the scrollbar remained clipped within the 26.4 px panel radius.
- Compact, Normal, and Spacious Collection cards measured 171.2 px, 208 px, and 256 px wide respectively at the same viewport, proving density changes remain live and ordered.
- List rows remained 52 px high and exposed only List/Grid mode controls. At a split-panel width, descriptions collapsed without shifting Weight or Quantity; at wide panel width they occupy the reclaimed center column.
- Grid cards exposed their full description through `title`, stayed equal at 106.64×76.8 px in the exercised panel with `scrollHeight === clientHeight`, and showed compact icon/value stats beneath the name.
- Clicking the Iron Longsword Quantity value opened an inline input; changing 2→4 persisted, and Undo restored 2.
- D&D managed refresh populated Longsword Value as 15, assigned Common, and tagged the Common rarity Tag with D&D5e metadata. Imported matches now retain both field values and their icon metadata.
- Item/Tags render as two adjacent independent buttons. Split/restack controls retain visible icons when responsive label text is hidden.
- Browser image normalization now emits square WebP with alpha preserved; Vault validation accepts WebP image payloads only, including numerical-field image icons.

## Inventory interaction and density regression pass — 2026-08-12

Executed the feature-specific pipeline in [QA-PIPELINE.md](QA-PIPELINE.md) against the real served app and persisted IndexedDB Vault.

- Physical grip drags reordered items in List and Grid views. Each reorder persisted after reload and Undo restored the exact original sequence.
- A physical drag moved Iron Longsword from Aria Thorn onto the linked Ashen Satchel destination. The source lost exactly one Entity, the destination gained exactly one Entity, and Undo restored both inventories.
- `Alt+ArrowDown` on a focused grip used the same ordering transaction and retained focus after render.
- Clicking the row body opened Item Settings; Quantity controls remained independent; completed drags did not trigger the underlying row action.
- Compact items, linked destinations, and the add slot measured 52 px high. On a wide panel all three measured 256 px wide with the same 9.92 px radius. The eight-row budget is 449.6 px including seven gaps.
- At 390×844, each compact row measured 52×352 px with zero internal overflow, the panel remained fully inside the visual viewport, and both adjacent Item and Tags actions remained visible.
- At 1920×1080, two 920×952 px panels tiled with a 16 px gap and no overlap; the Item/Tags group center matched the viewport center exactly; linked/item/add tiles shared geometry.
- At the 280 px minimum, every required header control remained within the visible content boundary with no overlap; mobile cards reduced below the scroll-track width.
- A fresh second tab navigated into Aria Thorn, opened and closed Iron Longsword settings, and produced zero browser error logs.

Defects harvested and closed during this pass:

- Native HTML drag conflicted with click/touch semantics; it was replaced by one Pointer Events path with an explicit grip and a carried ghost.
- Removing the old drag helper import also removed an editor dependency; real navigation caught `canMove is not defined`, and the shared import was restored.
- The adjacent Item/Tags actions pushed More outside the 280 px header; inter-control chrome now compresses without hiding either action.
- The mobile card minimum overrode the intended responsive width; cards now remain inside their horizontal track.
- Linked destinations initially shared height but stretched wider than inventory tiles; they now share complete geometry on wide panels and expand together only in narrow panels.

## Browser interaction evidence

Manually exercised through the real rendered application and IndexedDB state:

- returning-Vault direct open, profile edit, immediate initials update, persistence, Undo, and reload;
- isolated-origin first-run onboarding on one screen, Unicode initials, responsible selected defaults, and returning-Vault fast entry;
- export initiation and non-mutating rejection of an invalid Vault export;
- recognized D&D Beyond dry run, new import, local edit, Update Existing three-way comparison, safe update, generic-PDF rejection, and Undo cleanup;
- managed-source search and copy, Container-as-Item automatic parent linkage, nested Container opening, and Undo cleanup;
- search free text, structured `+` suggestions, screen-readable operator semantics, pointer selection, Arrow-key option focus, Enter selection, Escape, and `Ctrl+K` focus;
- user-created/edited/reordered/deleted Collections, user-created/renamed/deleted Tags, local Groups, Friend add/remove, and corresponding Undo/Redo cleanup;
- Activity filtering, text search, Entity links, retained-branch count, 80-row paging, and loading all older rows;
- stable recent-tab order and independent keyboard-operable close buttons, single-panel centering/content height, two-panel non-overlapping tiling, and high-zoom three-panel fallback to one visible active panel;
- carousel button/keyboard/Home/End traversal, wheel traversal, equal-card geometry, direct linked preview-chip navigation, and no nested anchors;
- settings preview/Cancel/navigation rollback, focus restoration, representative theme and accent previews, and Light/Dark text contrast checks;
- literal rendering of hostile HTML in names/history, an exact huge Weight value, and prevention of converting a populated Container into an Item; and
- service-worker cold offline reload with the HTTP server stopped, an offline write followed by another reload, explicit update deferral/activation, and verification that the latest shell—not a stale module—loaded from cache.

## Responsive geometry matrix

| Viewport | Result |
|---|---|
| 280×654 | Minimum-width header fits with visible Undo/Redo/Create, More, and Search inside More; no true horizontal document overflow. |
| 320×568 | 262.4×280 cards; no card/document overflow; all visible controls at least 44×44 CSS px; adjacent carousel content remains discoverable. |
| 390×844 | 288×280 cards; no card/document overflow; all visible controls at least 44×44 CSS px; settings and editor scroll internally. |
| 844×390 | 54.4 px header, 44×44 minimum visible controls, and no document overflow. |
| 900×900 | Two 426×766 panels tile with a 16 px gap, remain inside the viewport, and do not overlap. |
| 960×540 | High-zoom-equivalent layout has no horizontal overflow; three panels collapse to the active panel. |
| 1080×1920 | Four 208×280 cards fit; all three sections appear; header has no overflow. |
| 1920×1080 Compact | 10 equal 173.35×218.4 cards fit where a track has enough entries; three complete sections; zero card/document overflow. |
| 1920×1080 Normal | 8 equal 215.3×280 cards fit completely; two complete sections; zero card/document overflow. |
| 1920×1080 Spacious | 6 equal 289.06×328 cards fit completely; two complete sections; zero card/document overflow. |
| 2560×1080 | Wider tracks expose more content without scaling text below the selected density. |
| 3200×1800 | Two panels tile; a singular panel remains centered and content-sized. |

## Defects found and closed during exploratory testing

- Opening the first popup could dereference a missing Settings preview snapshot; popup roots now restore safely and nested screens preserve exact Back state.
- Image-less inventory rows implicitly occupied the image grid column and pushed Quantity controls beyond the card; explicit grid areas now keep every control inside its card in Grid and List views.
- Search options could receive keyboard focus but Enter did not activate them.
- Utility panels initially focused their Close control instead of the primary field/action.
- Closing a utility did not restore logical focus to its opener.
- The header overflowed on a 1080-pixel portrait monitor and undersized touch controls in landscape.
- The 280-pixel header exposed more direct controls than could physically fit; redundant Home/Search entries were adapted without hiding Undo/Redo.
- Settings preview state could leak into later work when leaving through another navigation control.
- Card preview chips looked linked but were noninteractive due to an invalid nested-link constraint.
- Service-worker network refresh did not await cache writes, permitting stale offline modules.
- Imported history paths were not restricted strongly enough at the mutation boundary.
- The phone Item Settings panel exposed the entire Tag list at once instead of a bounded disclosure.
- Widescreen card math used `100vw`, clipping the eighth Normal card by 0.8 CSS pixels when a vertical scrollbar was present.
- Landscape recent-tab close controls remained 32 px wide, and grouped tab/action controls missed the 44 px touch target by subpixel rounding.
- Portable snapshots retained the originating machine's folder label and could imply a nonexistent folder attachment after restore elsewhere.

## Remaining release work

This evidence does not yet prove production completeness. The UI deliberately keeps cloud enablement and invitation joining unavailable until durable multi-device key enrollment/recovery, persisted outbox/catch-up, invitation redemption, and complete policy enforcement are connected end to end. Cross-browser/physical-device assistive-technology coverage, near-limit Vault and very-long-history profiling, provider deployment validation, and independent security/legal review also remain release gates.
