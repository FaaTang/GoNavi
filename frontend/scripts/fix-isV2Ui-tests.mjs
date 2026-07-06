import fs from 'node:fs';
import path from 'node:path';

const testFixes = [
  [/,\s*isV2Ui:\s*(true|false)/g, ''],
  [/isV2Ui:\s*(true|false),?\s*/g, ''],
  [/isV2Ui=\{true\}/g, ''],
  [/isV2Ui=\{false\}/g, ''],
  [/isV2Ui\n/g, ''],
  [/isV2Ui,/g, ''],
  [/,\s*isV2Ui\b/g, ''],
  [/resolveAIChatPanelMode\((true|false),\s*/g, 'resolveAIChatPanelMode('],
  [/shouldClearSidebarActiveContextOnEmptySelect\([^)]*\)/g, 'shouldClearSidebarActiveContextOnEmptySelect()'],
  [/buildSidebarTableChildrenForUi\(([^,]+),\s*([^,]+),\s*(true|false)\)/g, 'buildSidebarTableChildrenForUi($1, $2)'],
];

const testFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') walk(full);
    else if (/\.(test|spec)\.(tsx?|jsx?)$/.test(entry.name)) testFiles.push(full);
  }
}
walk(path.resolve('src'));

for (const file of testFiles) {
  let source = fs.readFileSync(file, 'utf8');
  const original = source;
  for (const [pattern, replacement] of testFixes) {
    source = source.replace(pattern, replacement);
  }
  if (source !== original) {
    fs.writeFileSync(file, source);
    console.log('Fixed test:', path.relative('src', file));
  }
}

console.log('Done test fixes');
