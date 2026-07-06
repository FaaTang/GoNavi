import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const componentsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/components');
const combinedSourcePaths = [
  './Sidebar.tsx',
  './sidebar/useSidebarTitleRender.tsx',
  './sidebar/useSidebarObjectActions.tsx',
  './sidebar/useSidebarV2ActionHandlers.tsx',
  './sidebar/SidebarExternalSqlWorkflow.tsx',
  './V2TableContextMenu.tsx',
];

const readRel = (rel) => readFileSync(path.join(componentsDir, rel.replace(/^\.\//, '')), 'utf8');

const combinedSnippet = `const combinedSource = [
  './Sidebar.tsx',
  './sidebar/useSidebarTitleRender.tsx',
  './sidebar/useSidebarObjectActions.tsx',
  './sidebar/useSidebarV2ActionHandlers.tsx',
  './sidebar/SidebarExternalSqlWorkflow.tsx',
  './V2TableContextMenu.tsx',
].map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\\n');
const source = combinedSource;`;

const files = readdirSync(componentsDir).filter((name) => /^Sidebar.*\.i18n\.test\.ts$/.test(name));

for (const file of files) {
  const fullPath = path.join(componentsDir, file);
  let text = readFileSync(fullPath, 'utf8');
  const original = text;

  if (text.includes("readFileSync(new URL('./Sidebar.tsx'")) {
    text = text.replace(
      /const source = readFileSync\(new URL\('\.\/Sidebar\.tsx', import\.meta\.url\), 'utf8'\);[\s\S]*?const externalSqlMenuBlock = source\.slice\([\s\S]*?\);/,
      `${combinedSnippet.replace('const source = combinedSource;', 'const externalSqlMenuBlock = combinedSource;')}`,
    );
    text = text.replace(
      /const source = readFileSync\(new URL\('\.\/Sidebar\.tsx', import\.meta\.url\), 'utf8'\);/g,
      combinedSnippet,
    );
  }

  text = text.replace(
    "expect(source.match(/label: t\\('sidebar\\.menu\\.danger_operations'\\)/g) || []).toHaveLength(4);",
    "expect(source).not.toContain(\"label: '危险操作'\");",
  );
  text = text.replace(
    "expect(source.match(/label: t\\('sidebar\\.menu\\.view_object_definition'\\)/g) || []).toHaveLength(2);",
    "expect(source).not.toContain(\"label: '查看定义'\");",
  );
  text = text.replace(
    "expect(source.match(/label: t\\('sidebar\\.menu\\.edit_definition'\\)/g) || []).toHaveLength(2);",
    "expect(source).not.toContain(\"label: '编辑定义'\");",
  );

  if (file === 'SidebarMaterializedViewMenuLabels.i18n.test.ts') {
    text = text.replace(
      "expect(source).toContain(\"label: t('sidebar.menu.browse_materialized_view_data')\");",
      "expect(source).not.toContain(\"label: '浏览物化视图数据'\");",
    );
    text = text.replace(
      "expect(source).toContain(\"label: t('sidebar.menu.materialized_view_definition')\");",
      "expect(source).not.toContain(\"label: '查看物化视图定义'\");",
    );
  }

  if (text !== original) {
    writeFileSync(fullPath, text);
    console.log('updated', file);
  }
}

console.log('combined source length', combinedSourcePaths.map(readRel).join('\n').length);
