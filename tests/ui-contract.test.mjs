import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, css] = await Promise.all([
  readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8')
]);

test('inventory drag uses one pointer-event path with no native draggable conflict', () => {
  assert.doesNotMatch(app, /draggable="true"/);
  assert.match(app, /addEventListener\('pointerdown'/);
  assert.match(app, /addEventListener\('pointermove'/);
  assert.match(app, /addEventListener\('pointerup'/);
  assert.match(app, /prepareInventoryMove\(state, drag\.entityId/);
  assert.match(css, /\.drag-handle[^}]*touch-action:\s*none/s);
});

test('list items, linked destinations, and add slot share compact inventory geometry', () => {
  const panelRenderer = app.slice(app.indexOf('function renderContainerPanel'), app.indexOf('function quantityControls'));
  assert.match(app, /class="inventory-row clickable"/);
  assert.match(app, /class="inventory-row linked-destination clickable"/);
  assert.match(app, /class="inventory-row empty-item-card"/);
  assert.match(css, /\.inventory-row\s*\{[^}]*height:\s*3\.25rem;[^}]*min-height:\s*3\.25rem;/s);
  assert.match(css, /\.linked-container-rail[^}]*display:\s*grid/s);
  assert.match(css, /\.inventory-grid\.list-view\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.doesNotMatch(panelRenderer, /data-layout="carousel"/);
  assert.match(app, /class="inventory-row-description"/);
});

test('Item and Tags are persistent adjacent independent header actions', () => {
  const headerGroup = app.match(/<span class="header-create-group"[\s\S]*?<\/span>\s*<span class="header-spacer">/u)?.[0] || '';
  assert.match(headerGroup, /data-action="create-root"/);
  assert.match(headerGroup, /data-action="tags"/);
  assert.match(headerGroup, /icon\('tools'\)/);
  assert.doesNotMatch(headerGroup, /icon\('bag'\)/);
  assert.doesNotMatch(headerGroup, /header-optional/);
  assert.match(css, /\.header-create-group\s*\{[^}]*gap:\s*\.35rem;[^}]*border:\s*0/s);
  assert.match(css, /\.header-create-group > button[^}]*border:\s*1px solid/s);
});

test('grid cards expose descriptions and compact numerical icon stats', () => {
  assert.match(app, /class="dense-item-card clickable"[\s\S]*title="\$\{escape\(entity\.description/);
  assert.match(app, /function renderCompactStats/);
  assert.match(app, /fieldIconImage/);
  assert.match(css, /\.compact-stats\s*\{[^}]*justify-content:\s*flex-end/s);
});

test('inventory rows put values before icons and separate compact square quantity controls', () => {
  assert.match(app, /title="Weight"><strong>\$\{formatNumber\(safeWeight\(entity\.id\)\)\}<\/strong>\$\{icon\('mass'\)\}/);
  assert.match(app, /title="Things"><strong>\$\{childrenOf\(entity\.id\)[\s\S]*?<\/strong>\$\{icon\('bag'\)\}/);
  assert.match(css, /\.inventory-row \.quantity\s*\{[^}]*border-left:\s*1px solid var\(--border\)/s);
  assert.match(css, /\.inventory-row \.quantity > button:not\(\.quantity-value\)\s*\{[^}]*width:\s*1\.5rem;[^}]*height:\s*1\.5rem/s);
});

test('Container Tags use a bounded wrapping region instead of a single tall column', () => {
  assert.match(app, /class="preview-chips container-tags" aria-label="Tags"/);
  assert.match(css, /\.panel-overview > \.container-tags\s*\{[^}]*max-height:[^;]+;[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*overflow:\s*auto/s);
  assert.doesNotMatch(css, /\.panel-overview > \.preview-chips\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('density, wheel traversal, images, and inline quantity retain their contracts', () => {
  assert.match(css, /\[data-density="compact"\][\s\S]*--card-w:[^;]*\/ 10\)/);
  assert.match(css, /\[data-density="spacious"\][\s\S]*--card-w:[^;]*\/ 6\)/);
  assert.match(app, /carouselWheelGrace/);
  assert.match(app, /track\.scrollLeft \+= delta/);
  assert.doesNotMatch(app, /track\.scrollBy\(\{ left: delta, behavior:/);
  assert.match(app, /canvas\.getContext\('2d', \{ alpha: true \}\)/);
  assert.match(app, /data-action="edit-quantity"/);
  assert.match(app, /data-action="field-icon-image"/);
  const settings = app.slice(app.indexOf('function renderSettings'), app.indexOf('function renderTagManager'));
  assert.ok(settings.indexOf('<label>Theme') < settings.indexOf('<legend>Accent'));
  assert.ok(settings.indexOf('<legend>Accent') < settings.indexOf('Custom Accent Hue'));
});
