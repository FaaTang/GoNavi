import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const combinedSource = [
  './Sidebar.tsx',
  './sidebar/useSidebarTitleRender.tsx',
  './sidebar/useSidebarObjectActions.tsx',
  './sidebar/useSidebarV2ActionHandlers.tsx',
  './sidebar/SidebarExternalSqlWorkflow.tsx',
  './sidebar/useSidebarTreeLoaders.tsx',
  './sidebar/useSidebarBatchExport.ts',
  './sidebar/SidebarEntityModals.tsx',
  './V2TableContextMenu.tsx',
].map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\n');
const source = combinedSource;
const locales = ['zh-CN', 'en-US'] as const;

describe('Sidebar view create and edit i18n', () => {
  it('localizes view create and edit tab titles and menu labels', () => {
    expect(source).not.toContain('title: `编辑视图: ${viewName}`');
    expect(source).not.toContain('title: `新建视图`');
    expect(source).not.toContain("label: '新建视图'");
    expect(source).not.toContain("label: '编辑视图'");
    expect(source).toContain("title: t('sidebar.tab.edit_view'");
    expect(source).toContain("title: t('sidebar.tab.create_view')");
  });

  it('keeps view create and edit catalog entries available in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      expect(catalog['sidebar.tab.edit_view'], `${locale}:edit view tab`).toContain('{{name}}');
      expect(catalog['sidebar.tab.create_view'], `${locale}:create view tab`).toBeTruthy();
      expect(catalog['sidebar.menu.create_view'], `${locale}:create view menu`).toBeTruthy();
      expect(catalog['sidebar.menu.edit_view'], `${locale}:edit view menu`).toBeTruthy();
    });
  });
});
