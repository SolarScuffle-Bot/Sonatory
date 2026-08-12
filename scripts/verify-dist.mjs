// @ts-check
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const required = [
  'index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', '_headers', '_redirects',
  'assets/mark.svg', 'src/app.js', 'src/core.js', 'src/ecs.js',
  'src/managed/srd-5.2.1.js', 'src/importers/ddb-worker.js',
  'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs'
];

await Promise.all(required.map(path => access(resolve(output, path))));

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(relative(output, path).replaceAll('\\', '/'));
  }
}
await walk(output);

const forbidden = files.filter(path => path.startsWith('tests/') || path.startsWith('tmp/') || path.endsWith('.map') || path === 'server.mjs');
if (forbidden.length) throw new Error(`Development-only files entered dist: ${forbidden.join(', ')}`);

const html = await readFile(resolve(output, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/gu)) {
  const target = match[1];
  if (/^(?:https?:|data:|blob:)/u.test(target)) continue;
  await access(resolve(output, target.replace(/^\//u, '')));
}

const serviceWorker = await readFile(resolve(output, 'sw.js'), 'utf8');
const shellAssets = serviceWorker.match(/const ASSETS = \[([^\]]+)\]/su)?.[1]?.match(/'([^']+)'/gu)?.map(value => value.slice(1, -1)) || [];
for (const target of shellAssets) {
  if (target === '/') continue;
  await access(resolve(output, target.replace(/^\//u, '')));
}

const headers = await readFile(resolve(output, '_headers'), 'utf8');
for (const header of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
  if (!headers.includes(`${header}:`)) throw new Error(`Missing Cloudflare security header: ${header}`);
}

const totalBytes = (await Promise.all(files.map(async path => (await stat(resolve(output, path))).size))).reduce((sum, size) => sum + size, 0);
console.log(`Verified ${files.length} deployment files (${totalBytes.toLocaleString('en-US')} bytes).`);
