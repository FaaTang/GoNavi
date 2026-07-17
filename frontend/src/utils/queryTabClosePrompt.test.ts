import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { catalogs } from '../i18n/catalog';

const QUERY_TAB_CLOSE_PROMPT_I18N_KEYS = [
  'tab_manager.query_close.action.yes',
  'tab_manager.query_close.action.no',
  'tab_manager.query_close.action.yes_to_all',
  'tab_manager.query_close.action.no_to_all',
  'tab_manager.query_close.remaining_hint',
  'tab_manager.query_close.save_confirm_title',
  'tab_manager.query_close.save_confirm_content',
  'tab_manager.query_close.dirty_single_label',
] as const;

describe('queryTabClosePrompt', () => {
  it('shows bulk save choices only when multiple dirty tabs remain', () => {
    const source = readFileSync(new URL('./queryTabClosePrompt.tsx', import.meta.url), 'utf8');

    expect(source).toContain("finish('yes')");
    expect(source).toContain("finish('no')");
    expect(source).toContain("finish('yes-all')");
    expect(source).toContain("finish('no-all')");
    expect(source).toContain('remainingCount > 1');
    QUERY_TAB_CLOSE_PROMPT_I18N_KEYS.forEach((key) => {
      expect(source).toContain(`t('${key}'`);
    });
    [
      '是',
      '否',
      '全部是',
      '全部否',
    ].forEach((text) => {
      expect(source).not.toContain(text);
    });
  });

  it('keeps query tab close prompt keys in every catalog', () => {
    Object.entries(catalogs).forEach(([language, catalog]) => {
      QUERY_TAB_CLOSE_PROMPT_I18N_KEYS.forEach((key) => {
        expect(catalog, `${language}:${key}`).toHaveProperty(key);
      });
    });
  });
});
