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
const requiredKeys = [
  'sidebar.object_group.views',
  'sidebar.object_group.routines',
  'sidebar.object_group.triggers',
  'sidebar.message.sphinx_unsupported_objects',
  'sidebar.punctuation.list_separator',
];

describe('Sidebar Sphinx capability i18n', () => {
  it('localizes Sphinx unsupported object capability warning text', () => {
    [
      "unsupportedObjects.push('视图')",
      "unsupportedObjects.push('函数/存储过程')",
      "unsupportedObjects.push('触发器')",
      "unsupportedObjects.join('、')",
      '当前 Sphinx 实例未开放以下对象能力',
      '已自动降级兼容',
    ].forEach((snippet) => {
      expect(source).not.toContain(snippet);
    });

    requiredKeys.forEach((key) => {
      expect(source).toContain(`t('${key}'`);
    });
  });

  it('keeps Sphinx capability warning keys available in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      requiredKeys.forEach((key) => {
        expect(catalog[key], `${locale}:${key}`).toBeTruthy();
      });
    });
  });
});
