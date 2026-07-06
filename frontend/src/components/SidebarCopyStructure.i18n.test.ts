import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

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

describe('Sidebar copy structure i18n guard', () => {
  it('uses the shared localized success message when copying table structure', () => {
    expect(source).not.toContain("message.success('表结构已复制到剪贴板')");
    expect(source).toContain("t('table_overview.message.copy_structure_success')");
  });

  it('keeps the reused success key available in every supported locale', () => {
    for (const locale of locales) {
      const catalog = JSON.parse(
        readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8'),
      ) as Record<string, string>;

      expect(catalog['table_overview.message.copy_structure_success']).toBeTruthy();
    }
  });
});
