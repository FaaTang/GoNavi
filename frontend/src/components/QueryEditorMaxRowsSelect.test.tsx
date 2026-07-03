import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../i18n/provider';
import QueryEditorMaxRowsSelect from './QueryEditorMaxRowsSelect';

vi.mock('../i18n/runtime', () => ({
  syncLanguageRuntime: vi.fn(async () => undefined),
}));

const source = readFileSync(new URL('./QueryEditorMaxRowsSelect.tsx', import.meta.url), 'utf8');
const toolbarSource = readFileSync(new URL('./QueryEditorToolbar.tsx', import.meta.url), 'utf8');

describe('QueryEditorMaxRowsSelect source guards', () => {
  it('uses 100 preset, custom presets, and custom entry option', () => {
    expect(source).toContain('query_editor.max_rows.option_100');
    expect(source).toContain('query_editor.max_rows.option_custom_value');
    expect(source).toContain('query_editor.max_rows.option_custom');
    expect(source).not.toContain('query_editor.max_rows.option_5000');
    expect(source).not.toContain('query_editor.max_rows.option_unlimited');
  });

  it('is wired through QueryEditorToolbar', () => {
    expect(toolbarSource).toContain('QueryEditorMaxRowsSelect');
    expect(toolbarSource).not.toContain('query_editor.max_rows.option_5000');
  });
});

describe('QueryEditorMaxRowsSelect', () => {
  it('shows the selected custom preset in the closed select', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider preference="zh-CN" systemLanguages={['zh-CN']} onPreferenceChange={() => undefined}>
        <QueryEditorMaxRowsSelect
          isV2Ui
          maxRows={5000}
          maxRowsCustomPresets={[5000, 20000]}
          onChange={() => undefined}
        />
      </I18nProvider>,
    );

    expect(markup).toContain('最大行数：5000');
    expect(markup).not.toContain('不限');
  });
});
