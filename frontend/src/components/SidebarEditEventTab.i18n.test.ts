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
const key = 'sidebar.tab.event';

describe('Sidebar edit event tab title i18n', () => {
  it('localizes edit event query tab titles', () => {
    expect(source).not.toContain('title: `编辑事件: ${eventName}`');
    expect(source).toContain(`title: t('${key}', { name: eventName })`);
    expect(source).not.toContain('title: `事件: ${eventName}`');
  });

  it('keeps the edit event tab key available in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      expect(catalog[key], `${locale}:${key}`).toBeTruthy();
      expect(catalog[key], `${locale}:${key}`).toContain('{{name}}');
    });
  });
});
