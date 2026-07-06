import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync(new URL('./sidebar/useSidebarObjectActions.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./sidebar/SidebarEntityModals.tsx', import.meta.url), 'utf8'),
].join('\n');
const locales = ['zh-CN', 'en-US'] as const;

describe('Sidebar view menu labels i18n', () => {
  it('localizes view action copy in object actions and modals', () => {
    expect(source).not.toContain("label: '浏览视图数据'");
    expect(source).not.toContain("label: '查看视图定义'");
    expect(source).not.toContain("label: '重命名视图'");
    expect(source).not.toContain("label: '删除视图'");
    expect(source).toContain("t('sidebar.modal.confirm_delete_view.title')");
    expect(source).toContain("t('sidebar.modal.confirm_delete_view.content'");
    expect(source).toContain("t('sidebar.menu.rename_view')");
  });

  it('keeps ordinary view context menu catalog entries available in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      expect(catalog['sidebar.menu.browse_view_data'], `${locale}:browse view data`).toBeTruthy();
      expect(catalog['sidebar.menu.view_definition'], `${locale}:view definition`).toBeTruthy();
      expect(catalog['sidebar.menu.rename_view'], `${locale}:rename view`).toBeTruthy();
      expect(catalog['sidebar.menu.delete_view'], `${locale}:delete view`).toBeTruthy();
    });
  });
});
