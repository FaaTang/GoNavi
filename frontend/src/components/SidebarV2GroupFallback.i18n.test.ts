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
  './sidebarV2Utils.ts',
].map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\n');
const source = combinedSource;
const sidebarV2UtilsSource = readFileSync(new URL('./sidebarV2Utils.ts', import.meta.url), 'utf8');

const locales = ['zh-CN', 'en-US'] as const;
const requiredKeys = [
  'connection.sidebar.group.untitled',
  'connection.sidebar.group.badge',
];

describe('Sidebar v2 connection group fallback i18n', () => {
  it('localizes v2 connection group fallback names and badges', () => {
    [
      "name: tag.name || '未命名分组'",
      "fallback = '组'",
    ].forEach((snippet) => {
      expect(source).not.toContain(snippet);
      expect(sidebarV2UtilsSource).not.toContain(snippet);
    });

    expect(source).toContain("tag.name || t('connection.sidebar.group.untitled')");
    expect(source).toContain("fallback = t('connection.sidebar.group.badge')");
    expect(sidebarV2UtilsSource).toContain("fallback = t('connection.sidebar.group.badge')");
  });

  it('keeps v2 connection group fallback keys available in every locale', () => {
    locales.forEach((locale) => {
      const catalog = JSON.parse(readFileSync(new URL(`../../../shared/i18n/${locale}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      requiredKeys.forEach((key) => {
        expect(catalog[key], `${locale}:${key}`).toBeTruthy();
      });
    });
  });
});
