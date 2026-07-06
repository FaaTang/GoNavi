import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n/provider';
import { AIChatInput } from './AIChatInput';
import { buildOverlayWorkbenchTheme } from '../../utils/overlayWorkbenchTheme';

vi.mock('../../store', () => ({
  useStore: (selector: (state: any) => any) => selector({
    aiContexts: {},
    addAIContext: vi.fn(),
    removeAIContext: vi.fn(),
  }),
}));

vi.mock('../../../wailsjs/go/app/App', () => ({
  DBGetTables: vi.fn(),
  DBShowCreateTable: vi.fn(),
  DBGetDatabases: vi.fn(),
  DBGetColumns: vi.fn(),
}));

vi.mock('../../i18n/runtime', () => ({
  syncLanguageRuntime: vi.fn(async () => undefined),
}));

vi.mock('antd', async () => {
  const React = await import('react');
  const actual = await vi.importActual<any>('antd');
  return {
    ...actual,
    Tooltip: ({
      title,
      children,
    }: {
      title?: React.ReactNode;
      children?: React.ReactNode;
    }) => React.createElement(
      'div',
      { 'data-tooltip-title': typeof title === 'string' ? title : undefined },
      children,
    ),
  };
});

const source = readFileSync(new URL('./AIChatInput.tsx', import.meta.url), 'utf8');
const draftAttachmentsHookSource = readFileSync(new URL('./useAIChatDraftAttachments.ts', import.meta.url), 'utf8');
const zhCnCatalog = JSON.parse(readFileSync(new URL('../../../../shared/i18n/zh-CN.json', import.meta.url), 'utf8'));
const enUsCatalog = JSON.parse(readFileSync(new URL('../../../../shared/i18n/en-US.json', import.meta.url), 'utf8'));

const baseProvider = {
  id: 'provider-1',
  type: 'openai' as const,
  name: 'OpenAI 主账号',
  apiKey: '',
  hasSecret: true,
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  models: [] as string[],
  maxTokens: 32000,
  temperature: 0.2,
};

const renderAIChatInput = (
  language: 'zh-CN' | 'en-US',
  overrides: Partial<React.ComponentProps<typeof AIChatInput>> = {},
) => renderToStaticMarkup(
  <I18nProvider
    preference={language}
    systemLanguages={[language]}
    onPreferenceChange={() => undefined}
  >
    <AIChatInput
      input=""
      setInput={() => {}}
      draftAttachments={[]}
      setDraftAttachments={() => {}}
      sending={false}
      onSend={() => {}}
      onStop={() => {}}
      handleKeyDown={() => {}}
      activeConnName=""
      activeContext={null}
      activeProvider={baseProvider}
      dynamicModels={[]}
      loadingModels={false}
      sendShortcutBinding={{ combo: 'Enter', enabled: true }}
      composerNotice={null}
      onComposerAction={() => {}}
      onModelChange={() => {}}
      onFetchModels={() => {}}
      textareaRef={React.createRef<HTMLTextAreaElement>()}
      darkMode={false}
      textColor="#162033"
      mutedColor="rgba(16,24,40,0.55)"
      overlayTheme={buildOverlayWorkbenchTheme(false)}
      {...overrides}
    />
  </I18nProvider>,
);

const renderAIChatInputWithoutProvider = (
  overrides: Partial<React.ComponentProps<typeof AIChatInput>> = {},
) => renderToStaticMarkup(
  <AIChatInput
    input=""
    setInput={() => {}}
    draftAttachments={[]}
    setDraftAttachments={() => {}}
    sending={false}
    onSend={() => {}}
    onStop={() => {}}
    handleKeyDown={() => {}}
    activeConnName=""
    activeContext={null}
    activeProvider={baseProvider}
    dynamicModels={[]}
    loadingModels={false}
    sendShortcutBinding={{ combo: 'Enter', enabled: true }}
    composerNotice={null}
    onComposerAction={() => {}}
    onModelChange={() => {}}
    onFetchModels={() => {}}
    textareaRef={React.createRef<HTMLTextAreaElement>()}
    darkMode={false}
    textColor="#162033"
    mutedColor="rgba(16,24,40,0.55)"
    overlayTheme={buildOverlayWorkbenchTheme(false)}
    {...overrides}
  />,
);

describe('AIChatInput i18n source guards', () => {
  it('uses i18n keys instead of legacy Chinese placeholder literals', () => {
    expect(source).toContain('useOptionalI18n()');
    expect(source).toContain("catalogTranslate('en-US', key, params)");
    expect(source).toContain("ai_chat.input.placeholder");
    expect(source).toContain("ai_chat.input.placeholder_compact");
    expect(source).toContain("ai_chat.input.shortcut.send_with_combo");
    expect(source).toContain("ai_chat.input.shortcut.disabled");
    expect(source).toContain("ai_chat.input.context.connection_tooltip");
    expect(source).toContain("ai_chat.input.context.memory_tooltip");
    expect(source).toMatch(/useAIChatDraftAttachments\(\{\s*[\s\S]*translate:\s*t,/);
    expect(source).toMatch(/useAISlashCommandMenu\(\{\s*[\s\S]*translate:\s*t,/);
    expect(draftAttachmentsHookSource).toContain('createAIChatAttachmentFromFile(file, translate)');
    expect(source).not.toContain('placeholder={`输入消息... (');
    expect(source).not.toContain('placeholder={`输入消息... ${getAIChatSendShortcutLabel');
    expect(source).not.toContain('当前数据查询上下文');
    expect(source).not.toContain('当前会话记忆已用字符。达到限制（');
  });

  it('keeps required placeholder keys present in supported catalogs', () => {
    const requiredKeys = [
      'ai_chat.input.placeholder',
      'ai_chat.input.placeholder_compact',
      'ai_chat.input.shortcut.send_with_combo',
      'ai_chat.input.shortcut.disabled',
      'ai_chat.input.context.connection_tooltip',
      'ai_chat.input.context.memory_tooltip',
    ];
    for (const key of requiredKeys) {
      expect(zhCnCatalog[key]).toBeTruthy();
      expect(enUsCatalog[key]).toBeTruthy();
    }
  });

  it('renders localized v2 placeholders in en-US with the dynamic shortcut label', () => {
    const markup = renderAIChatInput('en-US', {
      sendShortcutBinding: { combo: 'Meta+Enter', enabled: true },
      shortcutPlatform: 'mac',
    });

    expect(markup).toContain('placeholder="Type a message... ⌘↵ to send · / commands"');
  });

  it('renders the disabled shortcut placeholder copy instead of falling back to Enter', () => {
    const markup = renderAIChatInput('en-US', {
      sendShortcutBinding: { combo: 'Enter', enabled: false },
    });

    expect(markup).toContain('Shortcut sending disabled');
    expect(markup).not.toContain('Enter to send');
  });

  it('renders localized connection context tooltips in en-US while preserving raw connection context', () => {
    const markup = renderAIChatInput('en-US', {
      activeConnName: 'orders-db',
      activeContext: { connectionId: 'conn-1', dbName: 'analytics' },
    });

    expect(markup).toContain('data-tooltip-title="Current data query context"');
    expect(markup).toContain('orders-db / analytics');
  });

  it('renders localized memory usage tooltips in en-US while preserving the raw limit label', () => {
    const markup = renderAIChatInput('en-US', {
      contextUsageChars: 12800,
      maxContextChars: 32000,
    });

    expect(markup).toContain('data-tooltip-title="Current session memory usage. Auto-compression starts when it reaches the 32k limit."');
    expect(markup).toContain('12.8k/32k');
  });

  it('falls back to English placeholders and tooltips without an i18n provider while preserving raw connection context', () => {
    expect(() => renderAIChatInputWithoutProvider({
      activeConnName: 'orders-db',
      activeContext: { connectionId: 'conn-1', dbName: 'analytics' },
      contextUsageChars: 12800,
      maxContextChars: 32000,
      sendShortcutBinding: { combo: 'Meta+Enter', enabled: true },
      shortcutPlatform: 'mac',
    })).not.toThrow();

    const markup = renderAIChatInputWithoutProvider({
      activeConnName: 'orders-db',
      activeContext: { connectionId: 'conn-1', dbName: 'analytics' },
      contextUsageChars: 12800,
      maxContextChars: 32000,
      sendShortcutBinding: { combo: 'Meta+Enter', enabled: true },
      shortcutPlatform: 'mac',
    });

    expect(markup).toContain('placeholder="Type a message... ⌘↵ to send · / commands"');
    expect(markup).toContain('data-tooltip-title="Current data query context"');
    expect(markup).toContain('data-tooltip-title="Current session memory usage. Auto-compression starts when it reaches the 32k limit."');
    expect(markup).toContain('orders-db / analytics');
    expect(markup).not.toContain('ai_chat.input.context.connection_tooltip');
  });
});
