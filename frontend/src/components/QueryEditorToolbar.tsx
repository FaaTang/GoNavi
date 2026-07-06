import React from "react";
import { Button, Dropdown, Select, Tooltip, type MenuProps } from "antd";
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  FormatPainterOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SaveOutlined,
  SettingOutlined,
  StopOutlined,
} from "@ant-design/icons";

import { t as defaultTranslate } from '../i18n';
import { useOptionalI18n } from '../i18n/provider';
import type { SavedConnection } from "../types";
import {
  getShortcutDisplayLabel,
  type ShortcutPlatform,
  type ShortcutPlatformBinding,
} from "../utils/shortcuts";
import QueryEditorTransactionSettings, {
  type SqlEditorCommitMode,
} from "./QueryEditorTransactionSettings";
import QueryEditorMaxRowsSelect from "./QueryEditorMaxRowsSelect";
import type { QueryMaxRowsState } from "../utils/queryMaxRows";

type QueryEditorToolbarProps = {  currentConnectionId: string;
  currentDb: string;
  queryCapableConnections: SavedConnection[];
  dbList: string[];
  maxRows: number;
  maxRowsCustomPresets: number[];
  sqlEditorCommitMode: SqlEditorCommitMode;
  sqlEditorAutoCommitDelayMs: number;
  pendingTransactionToolbar: React.ReactNode;
  runQueryShortcutBinding: ShortcutPlatformBinding;
  saveQueryShortcutBinding: ShortcutPlatformBinding;
  toggleQueryResultsPanelShortcutBinding: ShortcutPlatformBinding;
  activeShortcutPlatform: ShortcutPlatform;
  isResultPanelVisible: boolean;
  loading: boolean;
  saveMoreMenuItems: MenuProps["items"];
  formatSettingsMenu: MenuProps["items"];
  formatSettingsOpen?: boolean;
  onFormatSettingsOpenChange?: (open: boolean) => void;
  onConnectionChange: (connectionId: string) => void;
  onDatabaseChange: (dbName: string) => void;
  onMaxRowsChange: (next: QueryMaxRowsState) => void;
  onCommitModeChange: (mode: SqlEditorCommitMode) => void;
  onAutoCommitDelayMsChange: (delayMs: number) => void;
  onCaptureEditorCursorPosition: () => void;
  onRun: () => void;
  onCancel: () => void;
  onQuickSave: () => void;
  onFormat: () => void;
  onToggleResultPanelVisibility: () => void;
  onAIAction: (action: "generate" | "explain" | "optimize" | "schema") => void;
};

const QueryEditorToolbar: React.FC<QueryEditorToolbarProps> = ({  currentConnectionId,
  currentDb,
  queryCapableConnections,
  dbList,
  maxRows,
  maxRowsCustomPresets,
  sqlEditorCommitMode,
  sqlEditorAutoCommitDelayMs,
  pendingTransactionToolbar,
  runQueryShortcutBinding,
  saveQueryShortcutBinding,
  toggleQueryResultsPanelShortcutBinding,
  activeShortcutPlatform,
  isResultPanelVisible,
  loading,
  saveMoreMenuItems,
  formatSettingsMenu,
  formatSettingsOpen,
  onFormatSettingsOpenChange,
  onConnectionChange,
  onDatabaseChange,
  onMaxRowsChange,
  onCommitModeChange,
  onAutoCommitDelayMsChange,
  onCaptureEditorCursorPosition,
  onRun,
  onCancel,
  onQuickSave,
  onFormat,
  onToggleResultPanelVisibility,
  onAIAction,
}) => {
  const i18n = useOptionalI18n();
  const t = i18n?.t ?? defaultTranslate;
  const baseMoreMenuItems = saveMoreMenuItems ?? [];
  const toggleResultPanelShortcutLabel =
    toggleQueryResultsPanelShortcutBinding.enabled &&
    toggleQueryResultsPanelShortcutBinding.combo
      ? getShortcutDisplayLabel(
          toggleQueryResultsPanelShortcutBinding.combo,
          activeShortcutPlatform,
        )
      : "";
  const toggleResultPanelTitle =
    toggleQueryResultsPanelShortcutBinding.enabled &&
    toggleQueryResultsPanelShortcutBinding.combo
      ? t(
          isResultPanelVisible
            ? "query_editor.action.hide_results_panel_with_shortcut"
            : "query_editor.action.show_results_panel_with_shortcut",
          { shortcut: toggleResultPanelShortcutLabel },
        )
      : isResultPanelVisible
        ? t("query_editor.action.hide_results_panel")
        : t("query_editor.action.show_results_panel");
  const aiMenuItems: MenuProps["items"] = [
    {
      key: "ai-generate",
      label: t("query_editor.action.ai_generate_sql_menu"),
      icon: <RobotOutlined />,
      onClick: () => onAIAction("generate"),
    },
    {
      key: "ai-explain",
      label: t("query_editor.action.ai_explain_sql_menu"),
      icon: <RobotOutlined />,
      onClick: () => onAIAction("explain"),
    },
    {
      key: "ai-optimize",
      label: t("query_editor.action.ai_optimize_sql_menu"),
      icon: <RobotOutlined />,
      onClick: () => onAIAction("optimize"),
    },
    { type: "divider" as const },
    {
      key: "ai-schema",
      label: t("query_editor.action.ai_schema_analysis"),
      icon: <RobotOutlined />,
      onClick: () => onAIAction("schema"),
    },
  ];
  const moreMenuItems: MenuProps["items"] = [
        ...baseMoreMenuItems,
        ...(baseMoreMenuItems.length > 0 ? [{ type: "divider" as const }] : []),
        {
          key: "toggle-result-panel",
          label: toggleResultPanelTitle,
          icon: isResultPanelVisible ? (
            <EyeInvisibleOutlined />
          ) : (
            <EyeOutlined />
          ),
          onClick: onToggleResultPanelVisibility,
        },
      ];
  const selects = (
    <div
      className={"gn-v2-query-toolbar-selects"}
      style={{
        display: "flex",
        gap: "8px",
        flexShrink: 0,
        alignItems: "center",
      }}
    >
      <Select
        className="gn-v2-query-toolbar-select gn-v2-query-toolbar-connection-select"
        placeholder={t("query_editor.placeholder.connection")}
        value={currentConnectionId}
        onChange={onConnectionChange}
        options={queryCapableConnections.map((c) => ({
          label: c.name,
          value: c.id,
        }))}
        showSearch
      />
      <Select
        className="gn-v2-query-toolbar-select gn-v2-query-toolbar-database-select"
        placeholder={t("query_editor.placeholder.database")}
        value={currentDb}
        onChange={onDatabaseChange}
        options={dbList.map((db) => ({ label: db, value: db }))}
        showSearch
      />
      <QueryEditorMaxRowsSelect
        maxRows={maxRows}
        maxRowsCustomPresets={maxRowsCustomPresets}
        onChange={onMaxRowsChange}
      />
      <QueryEditorTransactionSettings
        commitMode={sqlEditorCommitMode}
        autoCommitDelayMs={sqlEditorAutoCommitDelayMs}
        onCommitModeChange={onCommitModeChange}
        onAutoCommitDelayMsChange={onAutoCommitDelayMsChange}
      />
    </div>
  );

  const actions = (
    <div
      className={"gn-v2-query-toolbar-actions"}
      style={{
        display: "flex",
        gap: "8px",
        flexShrink: 0,
        alignItems: "center",
      }}
    >
      <div
        className={"gn-v2-query-toolbar-action-group"}
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        <Tooltip
          title={
            runQueryShortcutBinding.enabled && runQueryShortcutBinding.combo
              ? t("query_editor.action.run_with_shortcut", {
                  shortcut: getShortcutDisplayLabel(
                    runQueryShortcutBinding.combo,
                    activeShortcutPlatform,
                  ),
                })
              : t("query_editor.action.run")
          }
        >
          <Button
            className={"gn-v2-query-toolbar-run-action"}
            type="primary"
            icon={<PlayCircleOutlined />}
            onMouseDown={onCaptureEditorCursorPosition}
            onClick={onRun}
            loading={loading}
          >
            {t("query_editor.action.run")}
          </Button>
        </Tooltip>
        {loading && (
          <Button
            type="primary"
            danger
            icon={<StopOutlined />}
            onClick={onCancel}
          >
            {t("query_editor.action.stop")}
          </Button>
        )}
      </div>
      {pendingTransactionToolbar}
      <div
        className={"gn-v2-query-toolbar-action-pair"}
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        <Tooltip
          title={
            saveQueryShortcutBinding.enabled && saveQueryShortcutBinding.combo
              ? t("query_editor.action.save_with_shortcut", {
                  shortcut: getShortcutDisplayLabel(
                    saveQueryShortcutBinding.combo,
                    activeShortcutPlatform,
                  ),
                })
              : t("query_editor.action.save")
          }
        >
          <Button icon={<SaveOutlined />} onClick={onQuickSave}>
            {t("query_editor.action.save")}
          </Button>
        </Tooltip>
        <Dropdown
          menu={{ items: aiMenuItems }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button
            className={"gn-v2-query-toolbar-ai-action"}
            icon={<RobotOutlined />}
            style={{ color: "#818cf8" }}
          >
            AI
          </Button>
        </Dropdown>
        <Dropdown
          menu={{ items: moreMenuItems }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button>{t("query_editor.action.more")}</Button>
        </Dropdown>
      </div>

      <div
        className={"gn-v2-query-toolbar-action-pair"}
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        <Tooltip title={t("query_editor.action.format_sql")}>
          <Button icon={<FormatPainterOutlined />} onClick={onFormat}>
            {t("query_editor.action.format")}
          </Button>
        </Tooltip>
        <Dropdown
          open={formatSettingsOpen}
          onOpenChange={onFormatSettingsOpenChange}
          menu={{ items: formatSettingsMenu }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button
            className={"gn-v2-query-toolbar-icon-action"}
            icon={<SettingOutlined />}
          />
        </Dropdown>
      </div>

      
    </div>
  );

  return (
    <div
      className="gn-v2-query-toolbar"
      style={{
        padding: "4px 8px 8px",
        display: "flex",
        gap: "8px",
        flexShrink: 0,
      }}
    >
      <div
        className="gn-v2-query-toolbar-main"
        style={{
          display: "flex",
          gap: "8px",
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        {selects}
        {actions}
      </div>
    </div>
  );
};

export default QueryEditorToolbar;
