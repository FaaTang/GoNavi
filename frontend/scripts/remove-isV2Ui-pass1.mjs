import fs from 'node:fs';
import path from 'node:path';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      walk(fullPath, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const srcDir = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const skipPatterns = ['sidebarLegacyNodeMenu', 'DataGridLegacyCellContextMenu', 'remove-isV2Ui'];

for (const file of walk(srcDir)) {
  if (skipPatterns.some((p) => file.includes(p))) continue;

  let source = fs.readFileSync(file, 'utf8');
  const original = source;

  source = source.replace(/^\s*const isV2Ui = true;\r?\n/gm, '');
  source = source.replace(/isV2Ui \? '([^']+)' : undefined/g, "'$1'");
  source = source.replace(/isV2Ui \? "([^"]+)" : undefined/g, '"$1"');
  source = source.replace(/\$\{isV2Ui \? ' ([^']+)' : ''\}/g, ' $1');
  source = source.replace(/\$\{isV2Ui \? '([^']+)' : ''\}/g, '$1');
  source = source.replace(/isV2Ui \|\| isMacLike \? 'none' : \([^)]+\)/g, "'none'");
  source = source.replace(/\(isMacLike \|\| isV2Ui\) \? 'none'/g, "'none'");
  source = source.replace(/!isMacLike && !isV2Ui/g, 'false');
  source = source.replace(/\bisV2Ui && /g, '');

  if (source !== original) {
    fs.writeFileSync(file, source);
    console.log('Updated:', path.relative(srcDir, file));
  }
}

console.log('Done pass 1');
