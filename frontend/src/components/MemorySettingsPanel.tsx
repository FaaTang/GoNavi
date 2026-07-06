import React, { useMemo } from "react";
import { Button, Collapse, InputNumber, Select, Switch, Tooltip } from "antd";
import { InfoCircleOutlined, UndoOutlined } from "@ant-design/icons";
import { useI18n } from "../i18n/provider";
import { useStore } from "../store";
import {
  DEFAULT_MEMORY_SETTINGS,
  effectiveLowMemoryModeFromEnv,
  type MemoryAdvancedOptionKey,
} from "../utils/memoryPolicy";

const IMPACT_KEYS = [
  "app.memory.low_memory.impact.inactive_tabs_dom",
  "app.memory.low_memory.impact.inactive_results",
  "app.memory.low_memory.impact.transparency",
  "app.memory.low_memory.impact.default_max_rows",
  "app.memory.low_memory.impact.sidebar_cache",
  "app.memory.low_memory.impact.sql_logs",
  "app.memory.low_memory.impact.ai_messages",
  "app.memory.low_memory.impact.large_export",
  "app.memory.low_memory.impact.idle_sidebar",
  "app.memory.low_memory.impact.lazy_modules",
] as const;

const IDLE_RELEASE_OPTIONS = [0, 15, 30, 60];

interface MemorySettingsPanelProps {
  onLowMemoryModeChange?: (enabled: boolean) => void;
  mutedTextStyle?: React.CSSProperties;
}

const MemorySettingsPanel: React.FC<MemorySettingsPanelProps> = ({
  onLowMemoryModeChange,
  mutedTextStyle,
}) => {
  const { t } = useI18n();
  const memorySettings = useStore((state) => state.memorySettings);
  const setMemorySettings = useStore((state) => state.setMemorySettings);
  const setMemoryAdvancedOption = useStore((state) => state.setMemoryAdvancedOption);
  const resetMemoryAdvancedOption = useStore((state) => state.resetMemoryAdvancedOption);
  const envForced = useMemo(() => effectiveLowMemoryModeFromEnv(), []);

  const renderAdvancedReset = (key: MemoryAdvancedOptionKey) => (
    <Tooltip title={t("app.memory.low_memory.advanced.reset")}>
      <Button
        type="text"
        size="small"
        icon={<UndoOutlined />}
        aria-label={t("app.memory.low_memory.advanced.reset")}
        onClick={() => resetMemoryAdvancedOption(key)}
      />
    </Tooltip>
  );

  const advancedItems = [
    {
      key: "destroyInactiveTabs",
      label: t("app.memory.low_memory.advanced.destroy_inactive_tabs"),
      hint: t("app.memory.low_memory.advanced.destroy_inactive_tabs_hint"),
      control: (
        <Switch
          checked={memorySettings.advanced.destroyInactiveTabs}
          onChange={(checked) => setMemoryAdvancedOption("destroyInactiveTabs", checked)}
        />
      ),
      resetKey: "destroyInactiveTabs" as const,
    },
    {
      key: "sidebarDbCacheLimit",
      label: t("app.memory.low_memory.advanced.sidebar_db_cache_limit"),
      hint: t("app.memory.low_memory.advanced.sidebar_db_cache_limit_hint"),
      control: (
        <InputNumber
          min={6}
          max={24}
          step={2}
          value={memorySettings.advanced.sidebarDbCacheLimit}
          onChange={(value) => {
            if (typeof value === "number") {
              setMemoryAdvancedOption("sidebarDbCacheLimit", value);
            }
          }}
        />
      ),
      resetKey: "sidebarDbCacheLimit" as const,
    },
    {
      key: "runtimeSqlLogLimit",
      label: t("app.memory.low_memory.advanced.runtime_sql_log_limit"),
      hint: t("app.memory.low_memory.advanced.runtime_sql_log_limit_hint"),
      control: (
        <InputNumber
          min={30}
          max={120}
          step={10}
          value={memorySettings.advanced.runtimeSqlLogLimit}
          onChange={(value) => {
            if (typeof value === "number") {
              setMemoryAdvancedOption("runtimeSqlLogLimit", value);
            }
          }}
        />
      ),
      resetKey: "runtimeSqlLogLimit" as const,
    },
    {
      key: "aiMessageMemoryLimit",
      label: t("app.memory.low_memory.advanced.ai_message_memory_limit"),
      hint: t("app.memory.low_memory.advanced.ai_message_memory_limit_hint"),
      control: (
        <InputNumber
          min={20}
          max={200}
          step={10}
          value={memorySettings.advanced.aiMessageMemoryLimit}
          onChange={(value) => {
            if (typeof value === "number") {
              setMemoryAdvancedOption("aiMessageMemoryLimit", value);
            }
          }}
        />
      ),
      resetKey: "aiMessageMemoryLimit" as const,
    },
    {
      key: "sidebarIdleReleaseMinutes",
      label: t("app.memory.low_memory.advanced.sidebar_idle_release_minutes"),
      hint: t("app.memory.low_memory.advanced.sidebar_idle_release_minutes_hint"),
      control: (
        <Select
          style={{ minWidth: 120 }}
          value={memorySettings.advanced.sidebarIdleReleaseMinutes}
          options={IDLE_RELEASE_OPTIONS.map((value) => ({
            value,
            label: value === 0
              ? t("app.memory.low_memory.advanced.sidebar_idle_release_minutes.never")
              : t("app.memory.low_memory.advanced.sidebar_idle_release_minutes.minutes", { count: value }),
          }))}
          onChange={(value) => setMemoryAdvancedOption("sidebarIdleReleaseMinutes", value)}
        />
      ),
      resetKey: "sidebarIdleReleaseMinutes" as const,
    },
    {
      key: "goGCPercent",
      label: t("app.memory.low_memory.advanced.go_gc_percent"),
      hint: t("app.memory.low_memory.advanced.go_gc_percent_hint"),
      control: (
        <InputNumber
          min={40}
          max={100}
          step={5}
          value={memorySettings.advanced.goGCPercent}
          onChange={(value) => {
            if (typeof value === "number") {
              setMemoryAdvancedOption("goGCPercent", value);
            }
          }}
        />
      ),
      resetKey: "goGCPercent" as const,
    },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 500 }}>{t("app.memory.low_memory.title")}</div>
          <div style={{ ...(mutedTextStyle ?? {}), marginTop: 4 }}>
            {t("app.memory.low_memory.summary")}
          </div>
        </div>
        <Switch
          checked={memorySettings.lowMemoryMode || envForced}
          disabled={envForced}
          onChange={(checked) => {
            setMemorySettings({ lowMemoryMode: checked });
            onLowMemoryModeChange?.(checked);
          }}
        />
      </div>

      {envForced ? (
        <div style={mutedTextStyle}>{t("app.memory.low_memory.env_forced_hint")}</div>
      ) : null}

      <div>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>
          {t("app.memory.low_memory.impact.title")}
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          {IMPACT_KEYS.map((key) => (
            <li key={key} style={{ ...(mutedTextStyle ?? {}), lineHeight: 1.6 }}>
              {t(key)}
            </li>
          ))}
        </ul>
        <div style={{ ...(mutedTextStyle ?? {}), marginTop: 8 }}>
          {t("app.memory.low_memory.restart_hint")}
        </div>
      </div>

      {memorySettings.lowMemoryMode || envForced ? (
        <Collapse
          bordered={false}
          items={[
            {
              key: "advanced",
              label: t("app.memory.low_memory.advanced.title"),
              children: (
                <div style={{ display: "grid", gap: 14 }}>
                  {advancedItems.map((item) => (
                    <div
                      key={item.key}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 500 }}>{item.label}</span>
                          <Tooltip title={item.hint}>
                            <InfoCircleOutlined style={{ opacity: 0.65 }} />
                          </Tooltip>
                        </div>
                        <div style={{ ...(mutedTextStyle ?? {}), marginTop: 4 }}>
                          {t("app.memory.low_memory.advanced.default_value", {
                            value: String(DEFAULT_MEMORY_SETTINGS.advanced[item.resetKey]),
                          })}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {item.control}
                        {renderAdvancedReset(item.resetKey)}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      ) : null}

      <div>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>
          {t("app.memory.max_rows.title")}
        </div>
        <div style={{ ...(mutedTextStyle ?? {}), lineHeight: 1.6 }}>
          {t("app.memory.max_rows.description")}
        </div>
      </div>
    </div>
  );
};

export default MemorySettingsPanel;
