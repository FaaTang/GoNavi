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
const key = 'sidebar.menu.view_object_definition';

describe('Sidebar view definition menu i18n', () => {
  it('localizes routine and event view definition menu labels', () => {
    expect(source).not.toContain("label: '查看定义'");
    expect(source).not.toContain("label: '查看定义'");
  });

  it('keeps the generic view definition key available in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      expect(catalog[key], `${locale}:${key}`).toBeTruthy();
    });
  });
});
