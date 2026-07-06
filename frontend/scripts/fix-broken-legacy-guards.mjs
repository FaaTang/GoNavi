import fs from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node fix-broken-legacy-guards.mjs <files...>');
  process.exit(1);
}

function removeBrokenLegacyGuards(source) {
  let result = '';
  let index = 0;
  while (index < source.length) {
    const marker = source.indexOf('{!(', index);
    if (marker === -1) {
      result += source.slice(index);
      break;
    }
    result += source.slice(index, marker);
    let cursor = marker + 3;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    let depth = 1;
    let inString = null;
    let escape = false;
    while (cursor < source.length && depth > 0) {
      const ch = source[cursor];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === inString) {
          inString = null;
        }
      } else if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
      }
      cursor += 1;
    }
    index = cursor;
  }
  return result;
}

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const next = removeBrokenLegacyGuards(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log('Fixed:', file);
  }
}
