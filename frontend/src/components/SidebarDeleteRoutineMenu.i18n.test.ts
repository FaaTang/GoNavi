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
  './V2TableContextMenu.tsx',
].map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\n');
const source = combinedSource;
const locales = ['zh-CN', 'en-US'] as const;

describe('Sidebar delete routine menu i18n', () => {
  it('localizes the routine delete menu label and routine type', () => {
    const dropRoutineSource = source.slice(
      source.indexOf('const handleDropRoutine ='),
      source.indexOf('const openMessagePublishModal ='),
    );

    expect(source).not.toContain('label: `删除${typeLabel}`');
    expect(dropRoutineSource).toContain("title: t('sidebar.modal.confirm_delete_routine.title'");
    expect(dropRoutineSource).toContain("t(routineType === 'PROCEDURE' ? 'sidebar.object.procedure' : 'sidebar.object.function')");
  });

  it('keeps delete routine catalog text usable in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      expect(catalog['sidebar.menu.delete_routine'], `${locale}:delete_routine`).toContain('{{type}}');
      expect(catalog['sidebar.object.function'], `${locale}:function`).toBeTruthy();
      expect(catalog['sidebar.object.procedure'], `${locale}:procedure`).toBeTruthy();
    });

    const zhCN = JSON.parse(readFileSync(new URL('../../../shared/i18n/zh-CN.json', import.meta.url), 'utf8')) as Record<string, string>;
    const enUS = JSON.parse(readFileSync(new URL('../../../shared/i18n/en-US.json', import.meta.url), 'utf8')) as Record<string, string>;
    expect(zhCN['sidebar.menu.delete_routine']).toBe('删除{{type}}');
    expect(enUS['sidebar.menu.delete_routine']).toContain('{{type}}');
  });
});
