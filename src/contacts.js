// @ts-check
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PREFIX = 'sonatory-contact-v1.';

function encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('The contact code has invalid encoding.');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

/** Contact codes are identity hints, never authorization credentials. @param {{id:string,name:string}} profile */
export function createContactCode(profile) {
  if (!GUID.test(profile.id) || typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 200) throw new Error('A valid Vault identity is required to create a contact code.');
  return PREFIX + encode(new TextEncoder().encode(JSON.stringify({ version: 1, vaultGuid: profile.id, displayName: profile.name.trim() })));
}

/** @param {string} text */
export function parseContactCode(text) {
  const value = String(text || '').trim();
  if (value.length > 2_000 || !value.startsWith(PREFIX)) throw new Error('Paste a Sonatory contact code beginning with sonatory-contact-v1.');
  let payload;
  try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(value.slice(PREFIX.length)))); }
  catch (error) { throw new Error(error instanceof Error && error.message.includes('encoding') ? error.message : 'The contact code is damaged or incomplete.'); }
  if (!payload || payload.version !== 1 || !GUID.test(payload.vaultGuid) || typeof payload.displayName !== 'string' || !payload.displayName.trim() || payload.displayName.length > 200) throw new Error('The contact code does not contain a valid Vault identity.');
  return { vaultGuid: payload.vaultGuid, name: payload.displayName.trim() };
}
