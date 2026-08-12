import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('service worker downloads beside the active build and activates only after explicit safe-point consent', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const installBody = source.match(/addEventListener\('install',[\s\S]*?\n\}\);/)?.[0] || '';
  assert.doesNotMatch(installBody, /skipWaiting/);
  assert.match(source, /ACTIVATE_UPDATE/);
  assert.match(source, /event\.waitUntil\(self\.skipWaiting\(\)\)/);
  assert.match(source, /await cache\.put/);
  assert.match(source, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE/);
  assert.match(appSource, /updateDismissed = true; refreshUpdateNotice\(\)/);
  assert.match(appSource, /notice\.hidden = !pendingAppUpdate \|\| updateDismissed/);
});
