import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n/provider';
import AIChatAttachmentStrip from './AIChatAttachmentStrip';

vi.mock('../../i18n/runtime', () => ({
  syncLanguageRuntime: vi.fn(async () => undefined),
}));

vi.mock('@ant-design/icons', async () => {
  const React = await import('react');
  const makeIcon = (name: string) => () => React.createElement('span', { 'data-icon': name });
  return {
    FileTextOutlined: makeIcon('file-text'),
    WarningOutlined: makeIcon('warning'),
  };
});

const source = readFileSync(new URL('./AIChatAttachmentStrip.tsx', import.meta.url), 'utf8');
const zhCnCatalog = JSON.parse(readFileSync(new URL('../../../../shared/i18n/zh-CN.json', import.meta.url), 'utf8'));
const enUsCatalog = JSON.parse(readFileSync(new URL('../../../../shared/i18n/en-US.json', import.meta.url), 'utf8'));

const renderAttachmentStrip = (
  attachments: Array<Record<string, unknown>>,
  preference: 'en-US' | 'zh-CN' = 'en-US',
) => renderToStaticMarkup(
  <I18nProvider
    preference={preference}
    systemLanguages={[preference]}
    onPreferenceChange={() => undefined}
  >
    <AIChatAttachmentStrip
      attachments={attachments as any}
      onRemove={() => undefined}
    />
  </I18nProvider>,
);

const renderAttachmentStripWithoutProvider = (
  attachments: Array<Record<string, unknown>>,
) => renderToStaticMarkup(
  <AIChatAttachmentStrip
    attachments={attachments as any}
    onRemove={() => undefined}
  />,
);

describe('AIChatAttachmentStrip i18n source guards', () => {
  it('uses i18n keys instead of legacy Chinese remove aria labels', () => {
    expect(source).toContain('useOptionalI18n()');
    expect(source).toContain("catalogTranslate('en-US', key, params)");
    expect(source).toContain("ai_chat.input.attachment.remove_file");
    expect(source).toContain("ai_chat.input.attachment.remove_image");
    expect(source).toContain("ai_chat.input.attachment.kind.text");
    expect(source).toContain("ai_chat.input.attachment.kind.image");
    expect(source).toContain("ai_chat.input.attachment.kind.file");
    expect(source).toContain("ai_chat.message.image_alt");
    expect(source).not.toContain('aria-label="移除附件"');
    expect(source).not.toContain('aria-label="移除图片"');
    expect(source).not.toContain('alt={`Draft ${index}`}');
    expect(source).not.toContain("return 'Text';");
    expect(source).not.toContain("return 'Image';");
    expect(source).not.toContain("return 'File';");
  });

  it('keeps required attachment aria-label keys present in supported catalogs', () => {
    const requiredKeys = [
      'ai_chat.input.attachment.remove_file',
      'ai_chat.input.attachment.remove_image',
      'ai_chat.input.attachment.kind.text',
      'ai_chat.input.attachment.kind.image',
      'ai_chat.input.attachment.kind.file',
      'ai_chat.message.image_alt',
    ];
    for (const key of requiredKeys) {
      expect(zhCnCatalog[key]).toBeTruthy();
      expect(enUsCatalog[key]).toBeTruthy();
    }
  });

  it('renders localized remove aria labels and attachment kind labels while preserving raw attachment names', () => {
    const fileAttachment = [{
      id: 'file-1',
      name: 'orders.csv',
      kind: 'text',
      size: 128,
      mimeType: 'text/csv',
    }];
    const genericAttachment = [{
      id: 'file-2',
      name: 'dump.bin',
      kind: 'document',
      size: 64,
      mimeType: 'application/octet-stream',
    }];
    const imageAttachment = [{
      id: 'image-1',
      name: 'draft.png',
      kind: 'image',
      size: 256,
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AA==',
    }];
    const imageWithoutPreviewAttachment = [{
      id: 'image-2',
      name: 'screenshot.png',
      kind: 'image',
      size: 96,
      mimeType: 'image/png',
    }];

    const fileMarkup = renderAttachmentStrip(fileAttachment);
    const imageMarkup = renderAttachmentStrip(imageAttachment);
    const zhFileMarkup = renderAttachmentStrip(fileAttachment, 'zh-CN');
    const zhGenericMarkup = renderAttachmentStrip(genericAttachment, 'zh-CN');
    const zhImageNoPreviewMarkup = renderAttachmentStrip(imageWithoutPreviewAttachment, 'zh-CN');

    expect(fileMarkup).toContain('aria-label="Remove attachment"');
    expect(imageMarkup).toContain('aria-label="Remove image"');
    expect(imageMarkup).toContain('alt="Attached image 0"');
    expect(fileMarkup).toContain('orders.csv');
    expect(zhFileMarkup).toContain('文本');
    expect(zhGenericMarkup).toContain('文件');
    expect(zhImageNoPreviewMarkup).toContain('图片');
  });

  it('falls back to English attachment labels without an i18n provider while preserving raw names', () => {
    const fileAttachment = [{
      id: 'file-1',
      name: 'orders.csv',
      kind: 'text',
      size: 128,
      mimeType: 'text/csv',
    }];
    const genericAttachment = [{
      id: 'file-2',
      name: 'dump.bin',
      kind: 'document',
      size: 64,
      mimeType: 'application/octet-stream',
    }];
    const imageAttachment = [{
      id: 'image-1',
      name: 'draft.png',
      kind: 'image',
      size: 256,
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AA==',
    }];
    const imageWithoutPreviewAttachment = [{
      id: 'image-2',
      name: 'screenshot.png',
      kind: 'image',
      size: 96,
      mimeType: 'image/png',
    }];

    expect(() => renderAttachmentStripWithoutProvider(fileAttachment)).not.toThrow();
    expect(() => renderAttachmentStripWithoutProvider(imageAttachment)).not.toThrow();

    const fileMarkup = renderAttachmentStripWithoutProvider(fileAttachment);
    const imageMarkup = renderAttachmentStripWithoutProvider(imageAttachment);
    const genericMarkup = renderAttachmentStripWithoutProvider(genericAttachment);
    const imageNoPreviewMarkup = renderAttachmentStripWithoutProvider(imageWithoutPreviewAttachment);

    expect(fileMarkup).toContain('aria-label="Remove attachment"');
    expect(imageMarkup).toContain('aria-label="Remove image"');
    expect(imageMarkup).toContain('alt="Attached image 0"');
    expect(fileMarkup).toContain('orders.csv');
    expect(fileMarkup).toContain('Text');
    expect(genericMarkup).toContain('File');
    expect(imageNoPreviewMarkup).toContain('Image');
    expect(fileMarkup).not.toContain('ai_chat.input.attachment.remove_file');
  });
});
