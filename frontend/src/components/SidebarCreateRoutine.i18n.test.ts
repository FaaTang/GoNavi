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

describe('Sidebar create routine i18n', () => {
  it('localizes create routine tab title and menu labels', () => {
    expect(source).not.toContain("title: isProc ? '新建存储过程' : '新建函数'");
    expect(source).not.toContain("label: '新建函数'");
    expect(source).not.toContain("label: '新建存储过程'");
    expect(source.match(/sidebar\.tab\.create_function/g) || []).toHaveLength(1);
    expect(source.match(/sidebar\.tab\.create_procedure/g) || []).toHaveLength(1);
  });

  it('keeps create routine catalog entries available in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      expect(catalog['sidebar.tab.create_function'], `${locale}:create function`).toBeTruthy();
      expect(catalog['sidebar.tab.create_procedure'], `${locale}:create procedure`).toBeTruthy();
    });
  });
});
