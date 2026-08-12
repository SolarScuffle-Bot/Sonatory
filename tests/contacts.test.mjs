import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactCode, parseContactCode } from '../src/contacts.js';

test('portable contact codes preserve Vault GUID identity and Unicode display names', () => {
  const profile = { id: '00000000-0000-4000-8000-000000000123', name: 'Mira Fen 🧪' };
  const code = createContactCode(profile);
  assert.match(code, /^sonatory-contact-v1\./);
  assert.deepEqual(parseContactCode(code), { vaultGuid: profile.id, name: profile.name });
});

test('contact codes reject damage, spoofed shape, and oversized input', () => {
  assert.throws(() => parseContactCode('not-a-contact'), /beginning/);
  assert.throws(() => parseContactCode('sonatory-contact-v1.@@@'), /encoding/);
  assert.throws(() => parseContactCode('x'.repeat(2_001)), /beginning/);
  assert.throws(() => createContactCode({ id: 'not-guid', name: 'User' }), /valid Vault identity/);
});
