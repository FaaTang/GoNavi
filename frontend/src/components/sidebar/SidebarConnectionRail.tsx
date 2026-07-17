import React from 'react';
import { Tooltip } from 'antd';
import {
  FolderOpenOutlined,
  TableOutlined,
  DatabaseOutlined,
  FileAddOutlined,
  RobotOutlined,
  ToolOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';

// V2 Connection Rail 子组件（从 Sidebar.tsx 抽取）。
//
// 注意：本组件是 Sidebar.tsx 拆分的一部分，依赖大量主组件的 label/state/handler。
// 通过聚合 props 对象传递，避免 18+ 个独立 props 的 drilling 噪音。
// 后续状态管理重构（PR-A）会把 labels/handlers 迁到 useSidebarUIState hook。
//
// 设计取舍：用 labels + handlers 聚合对象 + FormInstance，换取 Sidebar.tsx 减少 ~100 行。
// 主组件 props drilling 复杂度可控（只有一处调用点）。

export interface SidebarConnectionRailProps {
  showLabels: boolean;
  showAIAssistant?: boolean;
  labels: {
    railSystemActions: string;
    railObjectActions: string;
    newGroup: string;
    batchTables: string;
    batchDatabases: string;
    openExternalSqlFile: string;
    aiAssistant: string;
    tools: string;
    settings: string;
    settingsTooltip?: string;
    expandButtonLabels: string;
    collapseButtonLabels: string;
  };
  handlers: {
    openCreateTagModal: () => void;
    openBatchTableExport: () => void;
    openBatchDatabaseExport: () => void;
    openExternalSqlFile: () => void;
    toggleAI?: () => void;
    openTools: () => void;
    openSettings: () => void;
    toggleShowLabels: () => void;
  };
}

type RailActionButtonProps = {
  label: string;
  tooltipLabel?: string;
  icon: React.ReactNode;
  onClick: () => void;
  showLabels: boolean;
  disabled?: boolean;
  className?: string;
  dataAttributes?: Record<string, string | boolean | undefined>;
};

const RailActionButton: React.FC<RailActionButtonProps> = ({
  label,
  tooltipLabel,
  icon,
  onClick,
  showLabels,
  disabled = false,
  className = 'gn-v2-rail-tool',
  dataAttributes,
}) => {
  const button = (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      {...dataAttributes}
    >
      <span className="gn-v2-rail-tool-icon" aria-hidden="true">{icon}</span>
      {showLabels ? <span className="gn-v2-rail-tool-label">{label}</span> : null}
    </button>
  );

  if (showLabels) {
    return button;
  }

  return (
    <Tooltip title={tooltipLabel || label} placement="right">
      {button}
    </Tooltip>
  );
};

const SidebarConnectionRail: React.FC<SidebarConnectionRailProps> = ({
  showLabels,
  showAIAssistant = false,
  labels,
  handlers,
}) => {
  const toggleLabel = showLabels ? labels.collapseButtonLabels : labels.expandButtonLabels;

  return (
    <div
      className={`gn-v2-connection-rail${showLabels ? ' is-labels-expanded' : ''}`}
      aria-label={labels.railSystemActions}
    >
      <div className="gn-v2-rail-primary-actions" aria-label={labels.railObjectActions}>
        <RailActionButton
          label={labels.newGroup}
          icon={<FolderOpenOutlined />}
          onClick={handlers.openCreateTagModal}
          showLabels={showLabels}
          className="gn-v2-rail-tool gn-v2-rail-action"
          dataAttributes={{ 'data-sidebar-create-group-action': true }}
        />
        <RailActionButton
          label={labels.batchTables}
          icon={<TableOutlined />}
          onClick={handlers.openBatchTableExport}
          showLabels={showLabels}
          className="gn-v2-rail-tool gn-v2-rail-action"
          dataAttributes={{ 'data-sidebar-batch-table-action': true }}
        />
        <RailActionButton
          label={labels.batchDatabases}
          icon={<DatabaseOutlined />}
          onClick={handlers.openBatchDatabaseExport}
          showLabels={showLabels}
          className="gn-v2-rail-tool gn-v2-rail-action"
          dataAttributes={{ 'data-sidebar-batch-database-action': true }}
        />
        <RailActionButton
          label={labels.openExternalSqlFile}
          icon={<FileAddOutlined />}
          onClick={handlers.openExternalSqlFile}
          showLabels={showLabels}
          className="gn-v2-rail-tool gn-v2-rail-action"
          dataAttributes={{ 'data-sidebar-open-external-sql-file-action': true }}
        />
      </div>
      <div className="gn-v2-rail-secondary-actions" aria-label={labels.railSystemActions}>
        {showAIAssistant && handlers.toggleAI ? (
        <RailActionButton
          label={labels.aiAssistant}
          icon={<RobotOutlined />}
          onClick={handlers.toggleAI}
          showLabels={showLabels}
          dataAttributes={{ 'data-gonavi-ai-entry-action': true }}
        />
        ) : null}
        <RailActionButton
          label={labels.tools}
          icon={<ToolOutlined />}
          onClick={handlers.openTools}
          showLabels={showLabels}
          dataAttributes={{ 'data-gonavi-open-tools-action': true }}
        />
        <RailActionButton
          label={labels.settings}
          tooltipLabel={labels.settingsTooltip}
          icon={<SettingOutlined />}
          onClick={handlers.openSettings}
          showLabels={showLabels}
          dataAttributes={{ 'data-sidebar-action': 'settings' }}
        />
      </div>
      <div className="gn-v2-rail-footer">
        {showLabels ? (
          <button
            type="button"
            className="gn-v2-rail-tool gn-v2-rail-toggle-labels"
            onClick={handlers.toggleShowLabels}
            aria-label={toggleLabel}
            aria-pressed="true"
            data-sidebar-rail-toggle-labels="true"
          >
            <span className="gn-v2-rail-tool-icon" aria-hidden="true"><MenuFoldOutlined /></span>
            <span className="gn-v2-rail-tool-label">{toggleLabel}</span>
          </button>
        ) : (
          <Tooltip title={toggleLabel} placement="right">
            <button
              type="button"
              className="gn-v2-rail-tool gn-v2-rail-toggle-labels"
              onClick={handlers.toggleShowLabels}
              aria-label={toggleLabel}
              aria-pressed="false"
              data-sidebar-rail-toggle-labels="true"
            >
              <span className="gn-v2-rail-tool-icon" aria-hidden="true"><MenuUnfoldOutlined /></span>
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default SidebarConnectionRail;
