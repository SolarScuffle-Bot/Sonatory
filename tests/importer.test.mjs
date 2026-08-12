import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ImportError, parseDdbPdf } from '../src/importers/ddb-parser.js';

const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url));

test('recognized D&D Beyond export is extracted locally with progress', async () => {
  const progress = [];
  const result = await parseDdbPdf(await fixture('synthetic-ddb-export.pdf'), update => progress.push(update));
  assert.equal(result.characterName, 'Synthetic Ranger');
  assert.equal(result.profileVersion, 'ddb-export-2014-v1');
  assert.equal(result.pageCount, 3);
  assert.equal(result.reportedWeight, '12.5');
  assert.equal(result.carryingCapacity, '150');
  assert.deepEqual(result.items, [
    { name: 'Longsword', quantity: 2, weight: '3' },
    { name: 'Trail Rations', quantity: 5, weight: '2' }
  ]);
  assert.deepEqual(progress, [{ page: 1, total: 3 }, { page: 2, total: 3 }, { page: 3, total: 3 }]);
});

test('generic PDF is rejected without returning partial data', async () => {
  await assert.rejects(
    parseDdbPdf(await fixture('synthetic-generic-sheet.pdf')),
    error => error instanceof ImportError && error.code === 'unrecognized'
  );
});

test('non-PDF and malformed PDF fail with specific safe errors', async () => {
  await assert.rejects(
    parseDdbPdf(new TextEncoder().encode('plain text that is not a PDF'.repeat(8))),
    error => error instanceof ImportError && error.code === 'not_pdf'
  );
  const malformed = new TextEncoder().encode(`%PDF-1.7\n${'malformed '.repeat(30)}`);
  await assert.rejects(
    parseDdbPdf(malformed),
    error => error instanceof ImportError && error.code === 'malformed'
  );
});
