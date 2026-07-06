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

describe('Sidebar materialized view menu labels i18n', () => {
  it('localizes materialized view context menu labels', () => {
    expect(source).not.toContain("label: '浏览物化视图数据'");
    expect(source).not.toContain("label: '查看物化视图定义'");
    expect(source).not.toContain("label: '浏览物化视图数据'");
    expect(source).not.toContain("label: '查看物化视图定义'");
  });

  it('keeps materialized view context menu catalog entries available in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      expect(catalog['sidebar.menu.browse_materialized_view_data'], `${locale}:browse materialized view data`).toBeTruthy();
      expect(catalog['sidebar.menu.materialized_view_definition'], `${locale}:materialized view definition`).toBeTruthy();
    });
  });
});
