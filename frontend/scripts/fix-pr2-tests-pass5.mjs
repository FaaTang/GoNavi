import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const componentsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/components');
const STANDARD = `const combinedSource = [
  './Sidebar.tsx',
  './sidebar/useSidebarTitleRender.tsx',
  './sidebar/useSidebarObjectActions.tsx',
  './sidebar/useSidebarV2ActionHandlers.tsx',
  './sidebar/SidebarExternalSqlWorkflow.tsx',
  './sidebar/useSidebarTreeLoaders.tsx',
  './sidebar/useSidebarBatchExport.ts',
  './sidebar/SidebarEntityModals.tsx',
  './V2TableContextMenu.tsx',
].map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\\n');
const source = combinedSource;`;

let changed = 0;
for (const file of readdirSync(componentsDir).filter((n) => /^Sidebar.*\.i18n\.test\.ts$/.test(n))) {
  const full = path.join(componentsDir, file);
  let text = readFileSync(full, 'utf8');
  if (text.includes('./sidebar/useSidebarTreeLoaders.tsx')) continue;
  const original = text;
  if (text.includes('const combinedSource = [')) {
    text = text.replace(/const combinedSource = \[[\s\S]*?\]\.map\(\(rel\) => readFileSync\(new URL\(rel, import\.meta\.url\), 'utf8'\)\)\.join\('\\n'\);\nconst source = combinedSource;/, STANDARD);
  } else if (text.includes("readFileSync(new URL('./Sidebar.tsx'")) {
    text = text.replace(/const (?:sidebarSource|source) = readFileSync\(new URL\('\.\/Sidebar\.tsx', import\.meta\.url\), 'utf8'\);/, `${STANDARD}\nconst sidebarSource = combinedSource;`);
  }
  if (text !== original) {
    writeFileSync(full, text);
    changed += 1;
    console.log('updated', file);
  }
}
console.log('expanded combined source in', changed, 'files');
