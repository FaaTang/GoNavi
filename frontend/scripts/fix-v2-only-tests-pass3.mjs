import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(frontendDir, 'src');

const walkTests = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTests(full, out);
    else if (/\.(test|spec)\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
};

let changed = 0;
for (const file of walkTests(srcDir)) {
  let text = readFileSync(file, 'utf8');
  const original = text;

  if (file.includes('Sidebar.locate-toolbar.test.tsx')) {
    text = text.replace(/readSourceFile\('\.\/sidebar\/sidebarLegacyNodeMenu\.tsx'\)/g, "readSourceFile('./V2TableContextMenu.tsx')");
    text = text.replace(/readLegacyNodeMenuSource/g, 'readV2ContextMenuSource');
    text = text.replace(/const readLegacyNodeMenuSource = \(\) => readSourceFile\('\.\/sidebar\/sidebarLegacyNodeMenu\.tsx'\);/,
      "const readV2ContextMenuSource = () => readSourceFile('./V2TableContextMenu.tsx');");
    text = text.replace(/legacyMenuSource/g, 'v2ContextMenuSource');
  }

  text = text.replace(/isV2Ui=\{false\}/g, '');
  text = text.replace(/,\s*isV2Ui\s*=\s*\{false\}/g, '');
  text = text.replace(/isV2Ui:\s*false/g, '');
  text = text.replace(/mockStoreState\.uiVersion\s*=\s*'legacy'/g, "mockStoreState.uiVersion = 'v2'");
  text = text.replace(/uiVersion:\s*'legacy'/g, "uiVersion: 'v2'");
  text = text.replace(/renderLocalizedGrid\('legacy'/g, "renderLocalizedGrid('v2'");
  text = text.replace(/variant:\s*'legacy'/g, "variant: 'v2'");
  text = text.replace(/renderContextPreview\('legacy'/g, "renderContextPreview(");
  text = text.replace(/renderComposerActions\(\{ variant: 'legacy'/g, "renderComposerActions({");
  text = text.replace(/renderAttachmentStrip\('legacy'/g, "renderAttachmentStrip(");
  text = text.replace(/renderModelSelect\('legacy'/g, "renderModelSelect(");

  if (text !== original) {
    writeFileSync(file, text);
    changed += 1;
    console.log('patched', path.relative(frontendDir, file));
  }
}

console.log('test files patched', changed);
