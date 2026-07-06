import React from 'react';
import { Button, Tooltip } from 'antd';
import { CodeOutlined, PictureOutlined, SendOutlined, StopOutlined, TableOutlined } from '@ant-design/icons';

import { t as catalogTranslate } from '../../i18n/catalog';
import { useOptionalI18n } from '../../i18n/provider';
import type { OverlayWorkbenchTheme } from '../../utils/overlayWorkbenchTheme';
import { AI_CHAT_ATTACHMENT_ACCEPT } from './aiChatAttachments';

interface AIChatComposerActionsProps {
  input: string;
  draftAttachmentCount: number;
  sending: boolean;
  overlayTheme: OverlayWorkbenchTheme;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAttachmentUpload: React.ChangeEventHandler<HTMLInputElement>;
  onOpenContext: () => void;
  onOpenSlashMenu?: () => void;
  onSend: () => void;
  onStop: () => void;
}

const AIChatComposerActions: React.FC<AIChatComposerActionsProps> = ({
  input,
  draftAttachmentCount,
  sending,
  overlayTheme,
  fileInputRef,
  onAttachmentUpload,
  onOpenContext,
  onOpenSlashMenu,
  onSend,
  onStop,
}) => {
  const i18n = useOptionalI18n();
  const t = i18n?.t ?? ((key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
    catalogTranslate('en-US', key, params));
  const canSend = input.trim().length > 0 || draftAttachmentCount > 0;
  const iconButtonStyle: React.CSSProperties = {
    color: overlayTheme.mutedText,
    border: 'none',
    background: 'transparent',
  };

  return (
    <div className="gn-v2-ai-input-actions">
      <input
        type="file"
        accept={AI_CHAT_ATTACHMENT_ACCEPT}
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={onAttachmentUpload}
      />
      <Tooltip title={t('ai_chat.input.tooltip.upload_attachment')}>
        <Button
          type="text"
          icon={<PictureOutlined />}
          onClick={() => fileInputRef.current?.click()}
          style={iconButtonStyle}
        />
      </Tooltip>
      <Tooltip title={t('ai_chat.input.tooltip.attach_table_context')}>
        <Button
          type="text"
          icon={<TableOutlined />}
          onClick={onOpenContext}
          style={iconButtonStyle}
        />
      </Tooltip>
      <Tooltip title={t('ai_chat.input.tooltip.slash_command')}>
        <Button
          type="text"
          icon={<CodeOutlined />}
          onClick={onOpenSlashMenu}
          style={iconButtonStyle}
        />
      </Tooltip>
      {sending ? (
        <button
          type="button"
          className="ai-chat-send-btn ai-chat-stop-btn gn-v2-ai-send"
          onClick={onStop}
          title={t('ai_chat.input.action.stop')}
        >
          <StopOutlined />
        </button>
      ) : (
        <button
          type="button"
          className="ai-chat-send-btn gn-v2-ai-send"
          onClick={() => onSend()}
          disabled={!canSend}
          title={t('ai_chat.input.action.send')}
        >
          <SendOutlined />
        </button>
      )}
    </div>
  );
};

export default AIChatComposerActions;
