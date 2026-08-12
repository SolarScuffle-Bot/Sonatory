// @ts-check
const isNode = typeof process === 'object' && Boolean(process.versions?.node);
if (isNode && !('DOMMatrix' in globalThis)) {
  class ExtractionDOMMatrix {
    /** @param {number[]|undefined} values */
    constructor(values) {
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = values || [];
      Object.assign(this, { a, b, c, d, e, f, is2D: true });
    }
    /** @param {ExtractionDOMMatrix} other */
    multiply(other) {
      return new ExtractionDOMMatrix([
        this.a * other.a + this.c * other.b,
        this.b * other.a + this.d * other.b,
        this.a * other.c + this.c * other.d,
        this.b * other.c + this.d * other.d,
        this.a * other.e + this.c * other.f + this.e,
        this.b * other.e + this.d * other.f + this.f
      ]);
    }
    translate(x = 0, y = 0) { return this.multiply(new ExtractionDOMMatrix([1, 0, 0, 1, x, y])); }
    scale(x = 1, y = x) { return this.multiply(new ExtractionDOMMatrix([x, 0, 0, y, 0, 0])); }
    inverse() {
      const determinant = this.a * this.d - this.b * this.c;
      if (!determinant) return new ExtractionDOMMatrix();
      return new ExtractionDOMMatrix([
        this.d / determinant, -this.b / determinant, -this.c / determinant, this.a / determinant,
        (this.c * this.f - this.d * this.e) / determinant,
        (this.b * this.e - this.a * this.f) / determinant
      ]);
    }
  }
  Object.assign(globalThis, { DOMMatrix: ExtractionDOMMatrix, Path2D: class ExtractionPath2D {} });
}
const pdfjs = isNode
  ? await import('../../vendor/pdfjs/pdf.legacy.min.mjs')
  : await import('../../vendor/pdfjs/pdf.min.mjs');

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  isNode ? '../../vendor/pdfjs/pdf.worker.legacy.min.mjs' : '../../vendor/pdfjs/pdf.worker.min.mjs',
  import.meta.url
).href;

export const DDB_PROFILE_VERSION = 'ddb-export-2014-v1';

export class ImportError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}

/** @param {unknown} value */
function text(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
/** @param {string} value */
function fieldKey(value) { return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ''); }
/** @param {Map<string,string[]>} fields @param {RegExp[]} patterns */
function firstField(fields, patterns) {
  for (const [name, values] of fields) if (patterns.some(pattern => pattern.test(name))) for (const value of values) if (text(value)) return text(value);
  return '';
}
/** @param {string} value */
function positiveWhole(value) {
  const match = /\d+/.exec(value.replace(/,/g, ''));
  return match ? Math.max(1, Number.parseInt(match[0], 10)) : 1;
}
/** @param {string} value */
function exactNumber(value) {
  const normalized = value
    .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const match = /\d+(?:\.\d+)?/.exec(normalized);
  return match ? match[0].replace(',', '.') : '0';
}

/** @param {Array<{name:string,value:string,page:number,rect:number[]}>} widgets */
function extractItems(widgets) {
  /** @type {Map<string,{name?:string,quantity?:string,weight?:string,page:number,y:number}>} */ const rows = new Map();
  /** @type {string[]} */ const loose = [];
  for (const widget of widgets) {
    const key = fieldKey(widget.name);
    const value = text(widget.value);
    if (!value) continue;
    // D&D Beyond has shipped the same 2014 sheet layout with multiple field-name
    // revisions. Current exports use compact `Eq Name0` / `Eq Qty0` /
    // `Eq Weight0` names, while older exports used `EquipmentName1`. Attuned
    // rows use the same triplet shape and are inventory too.
    const indexed = /(equipment|additionalequipment|item|eq|attuned)(name|qty|quantity|weight)?(\d+)$/.exec(key);
    if (indexed) {
      const rowKey = `${widget.page}:${indexed[1]}:${indexed[3]}`;
      const row = rows.get(rowKey) || { page: widget.page, y: widget.rect?.[1] || 0 };
      const kind = indexed[2] || 'name';
      if (kind === 'qty' || kind === 'quantity') row.quantity = value;
      else if (kind === 'weight') row.weight = value;
      else row.name = value;
      rows.set(rowKey, row);
      continue;
    }
    if (/^(equipment|additionalequipment)$/.test(key)) loose.push(...value.split(/\r?\n|;/).map(text).filter(Boolean));
  }
  const results = [...rows.values()].filter(row => row.name).map(row => ({ name: text(row.name), quantity: positiveWhole(row.quantity || '1'), weight: exactNumber(row.weight || '0') }));
  for (const line of loose) {
    const separated = /^(.+?)\s*[|\t]\s*(\d+)\s*[|\t]\s*(\d+(?:[.,]\d+)?)\s*$/.exec(line);
    results.push(separated ? { name: text(separated[1]), quantity: positiveWhole(separated[2]), weight: exactNumber(separated[3]) } : { name: line, quantity: 1, weight: '0' });
  }
  const combined = new Map();
  const repeatedRows = new Set();
  for (const item of results) {
    if (!item.name || /^(name|qty|quantity|weight)$/i.test(item.name)) continue;
    const key = item.name.toLocaleLowerCase();
    const rowSignature = `${key}\u0000${item.quantity}\u0000${item.weight}`;
    // Current D&D Beyond PDFs can repeat the exact same AcroForm inventory
    // row later on the page. It is a rendering artifact, not another stack.
    if (repeatedRows.has(rowSignature)) continue;
    repeatedRows.add(rowSignature);
    const prior = combined.get(key);
    if (prior && prior.weight === item.weight) prior.quantity += item.quantity;
    else if (!prior) combined.set(key, item);
  }
  return [...combined.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parses only a recognized D&D Beyond Export-to-PDF revision.
 * @param {ArrayBuffer|Uint8Array} bytes
 * @param {(progress:{page:number,total:number})=>void} [onProgress]
 */
export async function parseDdbPdf(bytes, onProgress = () => {}) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const data = view.constructor === Uint8Array ? view : new Uint8Array(view);
  if (data.byteLength < 100 || data.byteLength > 50_000_000) throw new ImportError('invalid_size', 'Choose a D&D Beyond PDF between 100 bytes and 50 MB.');
  const header = new TextDecoder('latin1').decode(data.subarray(0, Math.min(data.length, 2048)));
  if (!header.startsWith('%PDF-')) throw new ImportError('not_pdf', 'That file is not a PDF. Export the character from D&D Beyond and try again.');
  if (/\/Encrypt\b/.test(new TextDecoder('latin1').decode(data.subarray(0, Math.min(data.length, 200_000))))) throw new ImportError('encrypted', 'Encrypted PDFs are not supported. Export an unlocked PDF directly from D&D Beyond.');
  const options = {
    data,
    isEvalSupported: false,
    useSystemFonts: false,
    cMapUrl: new URL('../../vendor/pdfjs/cmaps/', import.meta.url).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('../../vendor/pdfjs/standard_fonts/', import.meta.url).href
  };
  const loadingTask = pdfjs.getDocument(options);
  loadingTask.onPassword = updatePassword => updatePassword('');
  let document;
  try { document = await loadingTask.promise; }
  catch (error) {
    if (String(error?.name).includes('Password')) throw new ImportError('encrypted', 'Encrypted PDFs are not supported. Export an unlocked PDF directly from D&D Beyond.');
    throw new ImportError('malformed', 'The PDF could not be read safely. Export it again from D&D Beyond.');
  }
  try {
    if (document.numPages < 3 || document.numPages > 12) throw new ImportError('unrecognized', 'This is not a recognized D&D Beyond character export. Try a different file or cancel.');
    /** @type {string[]} */ const pageTexts = [];
    /** @type {Array<{name:string,value:string,page:number,rect:number[]}>} */ const widgets = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const [content, annotations] = await Promise.all([page.getTextContent({ disableNormalization: false }), page.getAnnotations({ intent: 'display' })]);
      pageTexts.push(content.items.map(item => 'str' in item ? item.str : '').join(' '));
      for (const annotation of annotations) {
        if (annotation.subtype !== 'Widget') continue;
        const value = Array.isArray(annotation.fieldValue) ? annotation.fieldValue.join('\n') : text(annotation.fieldValue);
        if (value) widgets.push({ name: text(annotation.fieldName || annotation.id), value, page: pageNumber, rect: annotation.rect || [] });
      }
      onProgress({ page: pageNumber, total: document.numPages });
      page.cleanup();
    }
    const joined = pageTexts.join('\n');
    const footerCount = (joined.match(/(?:©|\(c\))\s*2018\s+D&D Beyond\s*\|\s*All Rights Reserved/gi) || []).length;
    const markers = [/CHARACTER NAME/i, /EQUIPMENT/i, /NAME\s+QTY\s+WEIGHT/i, /WEIGHT CARRIED/i, /PUSH\s*\/\s*DRAG\s*\/\s*LIFT/i];
    if (footerCount < 2 || markers.some(marker => !marker.test(joined))) throw new ImportError('unrecognized', 'Only a recognized PDF made by D&D Beyond\'s Export to PDF flow is supported. Try a different file or cancel.');
    const fields = new Map();
    for (const widget of widgets) { const key = fieldKey(widget.name); fields.set(key, [...(fields.get(key) || []), widget.value]); }
    const characterName = firstField(fields, [/^charactername\d*$/, /^character$/]);
    if (!characterName) throw new ImportError('unrecognized_revision', 'This looks like a D&D Beyond export, but its field layout is not a recognized revision yet. Nothing was imported.');
    const items = extractItems(widgets);
    const reportedWeight = firstField(fields, [/weightcarried/, /carriedweight/, /totalweight/]);
    const carryingCapacity = firstField(fields, [/carryingcapacity/, /encumbered/, /pushdraglift/]);
    return { profileVersion: DDB_PROFILE_VERSION, characterName, items, reportedWeight: exactNumber(reportedWeight), carryingCapacity: exactNumber(carryingCapacity), pageCount: document.numPages, warnings: items.length ? [] : ['The export was recognized, but it contained no readable carried item rows.'] };
  } finally { await loadingTask.destroy(); }
}
