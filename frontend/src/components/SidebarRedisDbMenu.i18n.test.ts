import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync(new URL('./Sidebar.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./V2TableContextMenu.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./sidebar/useSidebarV2ActionHandlers.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./RedisViewerKeyToolbar.tsx', import.meta.url), 'utf8'),
].join('\n');

describe('Sidebar Redis DB menu i18n', () => {
  it('localizes Redis context menu labels and tab titles', () => {
    [
      "label: '浏览 Key'",
      "label: '新建命令窗口'",
      "title: `命令 - db${redisDB}`",
      "label: 'Redis 实例监控'",
      "title: `监控 - db${redisDB}`",
    ].forEach((snippet) => {
      expect(source).not.toContain(snippet);
    });

    expect(source).toContain("tr('redis_viewer.title.key_explorer')");
    expect(source).toContain("t('sidebar.menu.new_command_window')");
    expect(source).toContain('buildConnectionRootRedisCommandTabTitle');
    expect(source).toContain("t('redis_monitor.title.instance')");
    expect(source).toContain('buildConnectionRootRedisMonitorTabTitle');
    expect(source).toContain("t('sidebar.tab.redis_monitor', { database: redisDbLabel })");
  });
});
