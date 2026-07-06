import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const componentsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/components');

const combinedPaths = [
  './Sidebar.tsx',
  './sidebar/useSidebarTitleRender.tsx',
  './sidebar/useSidebarObjectActions.tsx',
  './sidebar/useSidebarV2ActionHandlers.tsx',
  './sidebar/SidebarExternalSqlWorkflow.tsx',
  './sidebar/useSidebarTreeLoaders.tsx',
  './sidebar/useSidebarBatchExport.ts',
  './V2TableContextMenu.tsx',
];

const combinedSnippet = `const combinedSource = [
${combinedPaths.map((rel) => `  '${rel}',`).join('\n')}
].map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\\n');
const source = combinedSource;`;

const sidebarOnlySnippet = `const sidebarSource = combinedSource;`;

let changed = 0;
for (const file of readdirSync(componentsDir).filter((name) => /^Sidebar.*\.i18n\.test\.ts$/.test(name))) {
  const fullPath = path.join(componentsDir, file);
  let text = readFileSync(fullPath, 'utf8');
  const original = text;

  if (text.includes("readFileSync(new URL('./Sidebar.tsx'")) {
    text = text.replace(
      /const (?:sidebarSource|source) = readFileSync\(new URL\('\.\/Sidebar\.tsx', import\.meta\.url\), 'utf8'\);/g,
      combinedSnippet,
    );
    text = text.replace(
      /const combinedSource = \[[\s\S]*?\]\.map\(\(rel\) => readFileSync\(new URL\(rel, import\.meta\.url\), 'utf8'\)\)\.join\('\\n'\);\nconst source = combinedSource;/,
      combinedSnippet,
    );
    if (text.includes('const sidebarSource = readFileSync')) {
      text = text.replace(
        /const sidebarSource = readFileSync\(new URL\('\.\/Sidebar\.tsx', import\.meta\.url\), 'utf8'\);/,
        `${combinedSnippet}\n${sidebarOnlySnippet}`,
      );
    }
  }

  text = text.replaceAll(
    "'sidebar.action.locate_current_tab'",
    "'sidebar.action.locate_current_table'",
  );
  text = text.replaceAll(
    "'sidebar.message.locate_current_tab_unavailable'",
    "'sidebar.message.locate_current_table_unavailable'",
  );

  if (text !== original) {
    writeFileSync(fullPath, text);
    changed += 1;
    console.log('updated', file);
  }
}

console.log('combined-source files changed', changed);
