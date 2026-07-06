import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appSource = readFileSync(
  fileURLToPath(new globalThis.URL('./App.tsx', import.meta.url)),
  'utf8',
);

describe('V2-only UI shell', () => {
  it('loads the v2 theme stylesheet with the app shell', () => {
    expect(appSource).toContain("import './App.css';");
    expect(appSource).toContain("import './v2-theme.css';");
  });

  it('does not expose a legacy/v2 UI version switch in theme settings', () => {
    expect(appSource).not.toContain("t('app.theme.ui_version.title')");
    expect(appSource).not.toContain("setAppearance({ uiVersion:");
    expect(appSource).not.toContain("appearance.uiVersion");
  });

  it('keeps sidebar search mode settings in theme settings without uiVersion guard', () => {
    const themeBranchIndex = appSource.indexOf("{themeModalSection === 'theme' ? (");
    const sidebarSearchIndex = appSource.indexOf("t('app.appearance.sidebar_search.title')", themeBranchIndex);
    const lightThemeIndex = appSource.indexOf("t('app.theme.mode.light.label')", themeBranchIndex);

    expect(themeBranchIndex).toBeGreaterThan(-1);
    expect(sidebarSearchIndex).toBeGreaterThan(themeBranchIndex);
    expect(sidebarSearchIndex).toBeLessThan(lightThemeIndex);
    expect(appSource).toContain("value={appearance.sidebarSearchMode ?? 'command'}");
    expect(appSource).toContain("setAppearance({ sidebarSearchMode: value as 'command' | 'filter' })");
    expect(appSource).not.toContain("appearance.uiVersion === 'v2'");
  });

  it('always marks the document body as v2 UI', () => {
    expect(appSource).toContain("document.body.setAttribute('data-ui-version', 'v2')");
    expect(appSource).not.toContain('const true');
  });
});
