import React from 'react';
import { Button } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import Modal from '../common/ResizableDraggableModal';
import Editor from '../MonacoEditor';
import { t as defaultTranslate } from '../../i18n';

export interface SidebarDdlModalProps {
  open: boolean;
  tableName: string;
  ddlText: string;
  ddlLoading: boolean;
  darkMode: boolean;
  onClose: () => void;
  onCopy: () => void;
  translate?: (key: string) => string;
}

const SidebarDdlModal: React.FC<SidebarDdlModalProps> = ({
  open,
  tableName,
  ddlText,
  ddlLoading,
  darkMode,
  onClose,
  onCopy,
  translate = defaultTranslate,
}) => (
  <Modal
    title={tableName ? `DDL - ${tableName}` : 'DDL'}
    open={open}
    onCancel={onClose}
    destroyOnHidden
    width={960}
    footer={[
      <Button key="copy" icon={<CopyOutlined />} onClick={onCopy} disabled={!ddlText.trim()}>
        {translate('data_grid.ddl.copy')}
      </Button>,
      <Button key="close" type="primary" onClick={onClose}>
        {translate('common.close')}
      </Button>,
    ]}
  >
    {open && (
      <Editor
        height="56vh"
        language="sql"
        theme={darkMode ? 'transparent-dark' : 'transparent-light'}
        value={ddlLoading ? translate('data_grid.ddl.loading') : ddlText}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          fontSize: 12,
          tabSize: 2,
          automaticLayout: true,
        }}
      />
    )}
  </Modal>
);

export default SidebarDdlModal;
