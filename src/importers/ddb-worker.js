// @ts-check
// The importer already runs off the UI thread. Loading the PDF.js worker engine
// here lets PDF.js use its loopback transport instead of spawning a nested worker.
import '../../vendor/pdfjs/pdf.worker.min.mjs';
import { ImportError, parseDdbPdf } from './ddb-parser.js';

self.addEventListener('message', async event => {
  try {
    const result = await parseDdbPdf(event.data.bytes, progress => self.postMessage({ type: 'progress', progress }));
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', error: { code: error instanceof ImportError ? error.code : 'internal', message: error instanceof Error ? error.message : 'The PDF could not be imported.' } });
  }
});

self.postMessage({ type: 'ready' });
