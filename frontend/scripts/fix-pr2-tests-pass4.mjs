import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = path.join(frontendDir, 'src/components');

const replaceAll = (text, pairs) => {
  let next = text;
  for (const [from, to] of pairs) {
    next = next.split(from).join(to);
  }
  return next;
};

const sidebarCombinedSnippet = `const combinedSource = [
  './Sidebar.tsx',
  './sidebar/useSidebarTitleRender.tsx',
  './sidebar/useSidebarObjectActions.tsx',
  './sidebar/useSidebarV2ActionHandlers.tsx',
  './sidebar/SidebarExternalSqlWorkflow.tsx',
  './V2TableContextMenu.tsx',
].map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\\n');
const source = combinedSource;`;

let changed = 0;

for (const file of readdirSync(componentsDir).filter((name) => /^Sidebar.*\.i18n\.test\.ts$/.test(name))) {
  let text = readFileSync(path.join(componentsDir, file), 'utf8');
  const original = text;
  text = replaceAll(text, [
    ["expect(source.match(/sidebar\\.tab\\.create_function/g) || []).toHaveLength(2);", "expect(source.match(/sidebar\\.tab\\.create_function/g) || []).toHaveLength(1);"],
    ["expect(source.match(/sidebar\\.tab\\.create_procedure/g) || []).toHaveLength(2);", "expect(source.match(/sidebar\\.tab\\.create_procedure/g) || []).toHaveLength(1);"],
    ["expect(source.match(/title: t\\('sidebar\\.tab\\.routine_definition'/g) || []).toHaveLength(2);", "expect(source.match(/title: t\\('sidebar\\.tab\\.routine_definition'/g) || []).toHaveLength(1);"],
    ["expect(source.match(/t\\(routineType === 'PROCEDURE' \\? 'sidebar\\.object\\.procedure' : 'sidebar\\.object\\.function'\\)/g) || []).toHaveLength(4);", "expect(source.match(/t\\(routineType === 'PROCEDURE' \\? 'sidebar\\.object\\.procedure' : 'sidebar\\.object\\.function'\\)/g) || []).toHaveLength(2);"],
    ["'sidebar.action.locate_current_tab'", "'sidebar.action.locate_current_table'"],
    ["'sidebar.message.locate_current_tab_unavailable'", "'sidebar.message.locate_current_table_unavailable'"],
  ]);
  if (text !== original) {
    writeFileSync(path.join(componentsDir, file), text);
    changed += 1;
    console.log('updated', file);
  }
}

const managementModalsPath = path.join(componentsDir, 'SidebarManagementModals.i18n.test.ts');
{
  let text = readFileSync(managementModalsPath, 'utf8');
  const original = text;
  text = replaceAll(text, [
    ["const sidebarSource = readFileSync(new URL('./Sidebar.tsx', import.meta.url), 'utf8');", sidebarCombinedSnippet.replace('const source = combinedSource;', 'const sidebarSource = combinedSource;')],
    ["'sidebar.action.locate_current_tab'", "'sidebar.action.locate_current_table'"],
    ["'sidebar.message.locate_current_tab_unavailable'", "'sidebar.message.locate_current_table_unavailable'"],
    ["it('localizes legacy toolbar and management modal copy'", "it('localizes v2 toolbar and management modal copy'"],
  ]);
  if (text !== original) {
    writeFileSync(managementModalsPath, text);
    changed += 1;
    console.log('updated SidebarManagementModals.i18n.test.ts');
  }
}

const messagePublishPath = path.join(componentsDir, 'Sidebar.message-publish.test.tsx');
{
  let text = readFileSync(messagePublishPath, 'utf8');
  const original = text;
  text = replaceAll(text, [
    ["const sidebarSource = readFileSync(new URL('./Sidebar.tsx', import.meta.url), 'utf8');", "const sidebarSource = readFileSync(new URL('./Sidebar.tsx', import.meta.url), 'utf8');\nconst actionHandlersSource = readFileSync(new URL('./sidebar/useSidebarV2ActionHandlers.tsx', import.meta.url), 'utf8');"],
    ["it('adds a Kafka topic publish action in both legacy and v2 table menus'", "it('adds a Kafka topic publish action in the v2 table menu'"],
    ["expect(sidebarSource).toContain(\"key: 'publish-message'\");", "expect(actionHandlersSource).toContain(\"case 'publish-message':\");"],
    ["expect(sidebarSource).toContain(\"label: t('message_publish_modal.title')\");", "expect(contextMenuSource).toContain(\"title: t('message_publish_modal.title')\");"],
    ["expect(sidebarSource).toContain('openMessagePublishModal(node)');", "expect(actionHandlersSource).toContain('openMessagePublishModal(node)');"],
  ]);
  if (text !== original) {
    writeFileSync(messagePublishPath, text);
    changed += 1;
    console.log('updated Sidebar.message-publish.test.tsx');
  }
}

const externalSqlMenuLabelsPath = path.join(componentsDir, 'SidebarExternalSqlMenuLabels.i18n.test.ts');
{
  let text = readFileSync(externalSqlMenuLabelsPath, 'utf8');
  const original = text;
  const next = `import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const titleRenderSource = readFileSync(new URL('./sidebar/useSidebarTitleRender.tsx', import.meta.url), 'utf8');
const externalSqlWorkflowSource = readFileSync(new URL('./sidebar/SidebarExternalSqlWorkflow.tsx', import.meta.url), 'utf8');
const combinedSource = [titleRenderSource, externalSqlWorkflowSource].join('\\n');

describe('Sidebar external SQL menu labels i18n', () => {
  it('localizes external SQL tree menu labels without changing node actions', () => {
    [
      "label: '新建 SQL 文件'",
      "label: '新建目录'",
      "label: '重命名目录'",
      "label: '刷新目录'",
      "label: '删除本地目录'",
      "label: '删除目录'",
      "label: '重命名 SQL 文件'",
      "label: '在此目录新建 SQL 文件'",
      "label: '在此目录新建目录'",
      "label: '删除 SQL 文件'",
      "title=\\"添加外部 SQL 目录\\"",
      "aria-label=\\"添加外部 SQL 目录\\"",
    ].forEach((snippet) => {
      expect(combinedSource).not.toContain(snippet);
    });

    [
      'sidebar.menu.add_sql_directory',
      'sidebar.external_sql.root',
      'sidebar.modal.confirm_delete_sql_file.title',
      'sidebar.modal.confirm_delete_sql_file.content',
      'sidebar.message.delete_sql_file_failed',
      'sidebar.message.external_sql_directory_added',
      'sidebar.message.external_sql_directory_removed',
      'sidebar.message.external_sql_directory_refreshed',
    ].forEach((key) => {
      expect(combinedSource).toContain(key);
    });

    [
      'openCreateExternalSQLFileModal',
      'openCreateExternalSQLDirectoryModal',
      'openRenameExternalSQLDirectoryModal',
      'handleRefreshExternalSQLDirectory',
      'handleRemoveExternalSQLDirectory',
      'handleDeleteExternalSQLDirectory',
      'openRenameExternalSQLFileModal',
      'openExternalSQLFile',
      'handleDeleteExternalSQLFile',
    ].forEach((action) => {
      expect(combinedSource).toContain(action);
    });
  });
});
`;
  if (text !== next) {
    writeFileSync(externalSqlMenuLabelsPath, next);
    changed += 1;
    console.log('updated SidebarExternalSqlMenuLabels.i18n.test.ts');
  }
}

console.log('pass4 files changed', changed);
