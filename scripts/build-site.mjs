// @ts-check
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const files = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', '_headers', '_redirects'];
const directories = ['assets', 'src', 'vendor/pdfjs', 'relay'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(files.map(file => copyFile(resolve(root, file), resolve(output, file))));
await Promise.all(directories.map(directory => cp(resolve(root, directory), resolve(output, directory), { recursive: true })));

console.log(`Built static site in ${output}`);
