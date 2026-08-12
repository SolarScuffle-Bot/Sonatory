// @ts-check
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const pdfPath = process.argv[2];
const outputPath = resolve(process.argv[3] || 'src/managed/srd-5.2.1.js');
if (!pdfPath) throw new Error('Usage: node scripts/generate-srd-items.mjs <official-srd-pdf> [output]');

const temp = mkdtempSync(join(tmpdir(), 'sonatory-srd-'));
const equipmentPath = join(temp, 'equipment.txt');
const magicPath = join(temp, 'magic.txt');
try {
  execFileSync('pdftotext', ['-f', '91', '-l', '103', '-raw', resolve(pdfPath), equipmentPath]);
  execFileSync('pdftotext', ['-f', '209', '-l', '254', '-raw', resolve(pdfPath), magicPath]);
  const equipmentLines = readFileSync(equipmentPath, 'utf8').split(/\r?\n/).map(line => line.trim());
  const magicLines = readFileSync(magicPath, 'utf8').split(/\r?\n/).map(line => line.trim());
  /** @type {Map<string,{name:string,weight:string,category:string,cost:string,description:string}>} */
  const items = new Map();
  const decimalWeight = value => {
    const normalized = value.replace('½', '.5').replace('¼', '.25').replace('¾', '.75').replace(/,/g, '');
    if (/^\d+\/\d+$/.test(normalized)) { const [a, b] = normalized.split('/').map(Number); return String(a / b); }
    const match = /\d+(?:\.\d+)?/.exec(normalized);
    return match?.[0] || '0';
  };
  const add = (name, weight, category, cost = 'Varies', description = '') => {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean || /^(Item|Name|Type|Armor|Focus|System Reference)/.test(clean)) return;
    items.set(clean.toLocaleLowerCase(), { name: clean, weight: decimalWeight(weight), category, cost, description });
  };

  let weaponCategory = 'Weapon';
  for (let index = 0; index < equipmentLines.length && equipmentLines[index] !== 'Armor'; index += 1) {
    const line = equipmentLines[index];
    if (/^(Simple|Martial) (Melee|Ranged) Weapons$/.test(line)) { weaponCategory = line.replace(/s$/, ''); continue; }
    const start = /^(.+?)\s+(?:\d+d\d+|\d+)\s+(?:Bludgeoning|Piercing|Slashing)\b/.exec(line);
    if (!start) continue;
    let row = line;
    while (!/(?:lb\.|—)\s+[\d,]+\s+(?:CP|SP|GP)$/.test(row) && index + 1 < equipmentLines.length) row += ` ${equipmentLines[++index]}`;
    const end = /(?:(\d+(?:\/\d+)?|\d*[½¼¾])\s+lb\.|(—))\s+([\d,]+\s+(?:CP|SP|GP))$/.exec(row);
    if (end) add(start[1], end[1] || end[2], weaponCategory, end[3], row);
  }

  const armorStart = equipmentLines.findIndex(line => line === 'Armor Armor Class (AC) Strength Stealth Weight Cost');
  const armorEnd = equipmentLines.findIndex((line, index) => index > armorStart && line === 'Tools');
  let armorCategory = 'Armor';
  for (const line of equipmentLines.slice(armorStart + 1, armorEnd)) {
    if (/^(Light|Medium|Heavy) Armor/.test(line)) { armorCategory = line.replace(/\s*\(.*/, ''); continue; }
    const match = /^(.+?)\s+(?:\+?\d+|\d+\s*\+\s*Dex)[\s\S]*?\s+(\d+(?:\/\d+)?|\d*[½¼¾])\s+lb\.\s+([\d,]+\s+(?:CP|SP|GP))$/.exec(line);
    if (match) add(match[1], match[2], armorCategory, match[3], line);
  }

  for (let index = 0; index < equipmentLines.length - 1; index += 1) {
    const heading = /^(.+?)\s+\((?:[\d,]+\s+(?:CP|SP|GP)|Varies)\)$/.exec(equipmentLines[index]);
    const details = /\bWeight:\s*(\d+(?:\/\d+)?|\d*[½¼¾]|—|Varies)(?:\s+lb\.)?/.exec(equipmentLines[index + 1]);
    if (heading && details && /(?:Tools|Supplies|Utensils|Kit|Instrument)$/.test(heading[1])) add(heading[1], details[1], 'Tool', 'Varies', `${equipmentLines[index]} ${equipmentLines[index + 1]}`);
  }

  const gearStart = equipmentLines.findIndex((line, index) => line === 'Item Weight Cost' && equipmentLines[index - 1] === 'Adventuring Gear');
  const gearEnd = equipmentLines.findIndex((line, index) => index > gearStart && line === 'Ammunition');
  for (const line of equipmentLines.slice(gearStart + 1, gearEnd)) {
    const match = /^(.+?)\s+(Varies|—|\d+(?:\/\d+)?|\d*[½¼¾])(?:\s+lb\.(?:\s+\(full\))?)?\s+(Varies|[\d,]+\s+(?:CP|SP|GP))$/.exec(line);
    if (match) add(match[1], match[2], /(?:Pack|Backpack|Barrel|Basket|Bottle|Bucket|Case|Chest|Pouch|Quiver|Sack)$/.test(match[1]) ? 'Container' : 'Adventuring Gear', match[3], line);
  }

  const ammoStart = equipmentLines.findIndex(line => line === 'Type Amount Storage Weight Cost');
  for (const line of equipmentLines.slice(ammoStart + 1, ammoStart + 6)) {
    const match = /^(.+?)\s+\d+\s+\w+\s+(\d+(?:\/\d+)?|\d*[½¼¾])\s+lb\.\s+([\d,]+\s+(?:CP|SP|GP))$/.exec(line);
    if (match) add(match[1], match[2], 'Ammunition', match[3], line);
  }

  const category = /^(Armor|Potion|Ring|Rod|Scroll|Staff|Wand|Weapon|Wondrous Item)(?: \(|,)/;
  const titleContinuation = /^(and|of|the|to)\b/i;
  for (let index = 1; index < magicLines.length; index += 1) {
    const type = category.exec(magicLines[index]);
    if (!type) continue;
    const parts = [magicLines[index - 1]];
    if (titleContinuation.test(parts[0]) && magicLines[index - 2]) parts.unshift(magicLines[index - 2]);
    const name = parts.join(' ');
    if (/\.$|^\d+$|Levers table/i.test(name)) continue;
    add(name, name === 'Apparatus of the Crab' ? '500' : '0', `Magic ${type[1]}`, 'See SRD');
  }

  const cleanDescription = lines => {
    const useful = lines.filter(line => line && !/^System Reference Document 5\.2\.1$|^\d{1,3}$|^Chapter \d+:/i.test(line));
    let text = useful.join('\n').replace(/-\n(?=[a-z])/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 1000) {
      const boundary = Math.max(text.lastIndexOf('. ', 997), text.lastIndexOf(' ', 997));
      text = `${text.slice(0, boundary > 600 ? boundary + 1 : 997).trim()}…`;
    }
    return text;
  };

  const equipmentHeadings = [];
  for (const item of items.values()) {
    if (item.cost === 'See SRD') continue;
    const heading = `${item.name} (${item.cost})`;
    const index = equipmentLines.findIndex(line => line === heading);
    if (index >= 0) equipmentHeadings.push({ index, item });
  }
  equipmentHeadings.sort((a, b) => a.index - b.index);
  equipmentHeadings.forEach((heading, index) => {
    const end = equipmentHeadings[index + 1]?.index ?? equipmentLines.length;
    const description = cleanDescription(equipmentLines.slice(heading.index + 1, end));
    if (description) heading.item.description = description;
  });

  const magicHeadings = [];
  for (const item of items.values()) {
    if (item.cost !== 'See SRD') continue;
    let index = magicLines.findIndex((line, position) => line === item.name && category.test(magicLines[position + 1] || ''));
    let bodyStart = index + 2;
    if (index < 0) {
      index = magicLines.findIndex((line, position) => `${line} ${magicLines[position + 1] || ''}` === item.name && category.test(magicLines[position + 2] || ''));
      bodyStart = index + 3;
    }
    if (index >= 0) magicHeadings.push({ index, bodyStart, item });
  }
  magicHeadings.sort((a, b) => a.index - b.index);
  magicHeadings.forEach((heading, index) => {
    const end = magicHeadings[index + 1]?.index ?? magicLines.length;
    const description = cleanDescription(magicLines.slice(heading.bodyStart, end));
    if (description) heading.item.description = description;
  });

  const stableId = key => {
    const hash = createHash('sha256').update(`sonatory:srd-5.2.1:${key}`).digest('hex').slice(0, 32).split('');
    hash[12] = '5'; hash[16] = ['8', '9', 'a', 'b'][Number.parseInt(hash[16], 16) % 4];
    const value = hash.join('');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  };
  const definitions = [...items.values()].sort((a, b) => a.name.localeCompare(b.name)).map(item => ({
    id: stableId(item.name.toLocaleLowerCase()),
    ...item,
    aliases: []
  }));
  const sourceHash = createHash('sha256').update(readFileSync(resolve(pdfPath))).digest('hex');
  const output = `// Generated from the official CC-BY-4.0 SRD 5.2.1. Do not hand-edit.\n` +
    `export const SRD_SOURCE = Object.freeze(${JSON.stringify({ id: 'wotc-srd-5.2.1', version: '5.2.1', published: '2025-05-01', url: 'https://www.dndbeyond.com/srd', pdfSha256: sourceHash, license: 'CC-BY-4.0' }, null, 2)});\n\n` +
    `export const SRD_ITEMS = Object.freeze(${JSON.stringify(definitions, null, 2)}.map(item => Object.freeze(item)));\n`;
  writeFileSync(outputPath, output, 'utf8');
  process.stdout.write(`Generated ${definitions.length} managed items at ${outputPath}\n`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
