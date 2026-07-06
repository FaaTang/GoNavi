import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const titleRenderSource = readFileSync(new URL('./sidebar/useSidebarTitleRender.tsx', import.meta.url), 'utf8');
const externalSqlWorkflowSource = readFileSync(new URL('./sidebar/SidebarExternalSqlWorkflow.tsx', import.meta.url), 'utf8');
const combinedSource = [titleRenderSource, externalSqlWorkflowSource].join('\n');

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
      "title=\"添加外部 SQL 目录\"",
      "aria-label=\"添加外部 SQL 目录\"",
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
