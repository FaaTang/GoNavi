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

    expect(source).toContain("onChoice('yes')");
    expect(source).toContain("onChoice('no')");
    expect(source).toContain("choice: 'yes-all'");
    expect(source).toContain("choice: 'no-all'");
    expect(source).toContain("onChoice('cancel')");
    expect(source).toContain('remainingCount > 1');
    expect(source).toContain("ch === 'y'");
    expect(source).toContain("ch === 'n'");
    expect(source).toContain("event.key === 'ArrowLeft'");
    expect(source).toContain("event.key === 'ArrowRight'");
    expect(source).toContain("event.key === 'Enter' || event.key === ' '");
    expect(source).toContain("type={index === selected ? 'primary' : 'default'}");
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
