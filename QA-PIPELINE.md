# Sonatory Deterministic QA Pipeline

This is the required regression pipeline for every inventory, layout, or interaction change. A feature is not accepted because it “looks plausible”; each stage has an observable pass condition and produces reproducible evidence.

## 1. Static and pure-behavior gate

Run `npm run check` from the repository root.

Pass conditions:

- every JavaScript module parses;
- same-Container reorder produces a gap-free stored order;
- cross-Container transfer changes `parentId` and reorders both affected inventories;
- recursive containment is rejected without mutation;
- Undo restores the exact prior parent and order;
- the UI contract has no native `draggable` path competing with Pointer Events;
- inventory items, linked destinations, and the add slot use the shared compact-row component;
- Item and Tags remain adjacent, independent header actions at every breakpoint.
- Inventory exposes exactly two modes: List and Grid.
- managed D&D definitions carry an exact Value field, a D&D5e-metatagged rarity, and field icon metadata.
- persisted image data and numerical-field image icons are WebP only.

## 2. Real browser interaction gate

Use the served application, a real persisted Vault, and physical pointer gestures—not DOM-synthesized `click()` calls.

### Reorder

1. Open a Container with at least three items in List view.
2. Record the visible order.
3. Drag the second row by its grip above the first row.
4. Assert the insertion marker appears before release.
5. Assert the visible order changes exactly once.
6. Reload and assert the order persists.
7. Press Undo and assert the original order returns.
8. Focus a grip and use `Alt+ArrowDown`; assert the same ordering path works without a pointer.

### Transfer

1. Open a Container that exposes a linked destination.
2. Drag a non-Container item onto the linked row.
3. Assert the destination gains the accent drop state before release.
4. Assert the item leaves the source inventory exactly once.
5. Open the linked Container and assert the item appears exactly once.
6. Reload, verify persistence, then Undo and verify both inventories are restored.
7. Attempt to drag an ancestor into its descendant; assert no valid drop state appears and no data changes.

### Click-versus-drag separation

1. Click (without moving) the body of an item row; assert its Item/Container panel opens.
2. Drag from the body by more than 6 px; assert a move starts without opening the item. Repeat from the dedicated grip.
3. Click the Quantity number, type a new whole number, press Enter, and assert the exact value persists; Undo must restore it.
4. Click a Quantity increment control; assert only Quantity changes.
5. Press and release the grip without a destination; assert no Item panel opens and no order changes.
6. Complete a drag; assert the release does not also open the row under the pointer.

## 3. Geometry and information-density gate

Read layout from `getBoundingClientRect()` and computed styles in the real page.

Pass conditions:

- every default inventory row is no more than 52 CSS px tall;
- eight rows plus seven 4.8 px gaps require no more than 450 CSS px;
- linked rows and item rows have equal height and border radius;
- every visible Quantity and grip target is at least 24×24 CSS px;
- row titles ellipsize instead of pushing Weight or Quantity outside the row;
- `scrollWidth <= clientWidth + 1` for each vertical inventory and for the document;
- at a narrow panel width, the default inventory becomes one column;
- at a wide panel width, List remains a single stable column and exposes the description; at narrower widths the description becomes a tooltip without reserving space;
- Grid mode is visibly denser than List mode and each equal-size tile shows its name plus right-justified icon/value stats without overlap;
- Compact, Normal, and Spacious produce strictly increasing Collection card widths and heights.

## 4. Visual hierarchy and Gestalt gate

Inspect both a screenshot and computed geometry. Pass only when all conditions hold:

- **Common region:** Item and Tags are justified together while retaining independent button silhouettes; linked destinations share the inventory’s row geometry and reside in their own labeled region.
- **Proximity:** spacing inside a row is smaller than spacing between labeled sections; controls belonging to Quantity form one right-aligned group.
- **Similarity:** all movable rows use the same silhouette, alignment, and grip position; linked destinations use the same silhouette with an accent/link cue rather than a different card type.
- **Hierarchy:** panel title > section title > row title > metadata in computed font size/weight; metadata never competes with the row name.
- **Continuity/alignment:** grips, optional images, names, stats, and Quantity controls align to stable columns. Missing images collapse cleanly without leaving a false placeholder.
- **Feedback:** the carried row wobbles, the source becomes a ghost, and exactly one insertion/destination marker is visible.
- **Economy:** no repeated Tag chips appear in the compact row; descriptions appear only when the panel can accommodate them and otherwise remain available through the tooltip or Item panel.

## 5. Responsive matrix

Run the geometry and screenshot gates at minimum widths 280, 320, 390, 760, 960, 1920, and 2560 CSS px; include portrait and landscape where available. Also test 200% browser zoom at a desktop viewport.

For every case assert:

- no document-level horizontal overflow;
- header controls do not overlap, and both Item and Tags remain reachable;
- panel content stays below the sticky header/tabs;
- one panel is centered and content-sized, while multiple panels tile without overlap;
- popup panels remain inside the visual viewport;
- no text, focus ring, drag marker, status dot, or control is clipped.

## 6. Failure harvesting

After the scripted path, inspect browser error logs and take screenshots of the header, compact inventory, active drag state, and post-transfer destination. Any defect found becomes a pure regression test or a UI-contract assertion before the fix is considered complete. Record the executed viewport, observed geometry, and result in `QA-EVIDENCE.md`.
