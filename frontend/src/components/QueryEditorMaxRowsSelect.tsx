import React, { useMemo, useState } from 'react';
import { Button, InputNumber, Modal, Popover, Select, Tooltip, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

import { t as defaultTranslate } from '../i18n';
import { useOptionalI18n } from '../i18n/provider';
import {
  DEFAULT_MAX_ROWS,
  MAX_MAX_ROWS,
  addMaxRowsCustomPreset,
  removeMaxRowsCustomPreset,
  type QueryMaxRowsState,
} from '../utils/queryMaxRows';

const CUSTOM_OPTION_VALUE = '__custom__';

export type QueryEditorMaxRowsSelectProps = {
  isV2Ui: boolean;
  maxRows: number;
  maxRowsCustomPresets: number[];
  onChange: (next: QueryMaxRowsState) => void;
};

const QueryEditorMaxRowsSelect: React.FC<QueryEditorMaxRowsSelectProps> = ({
  isV2Ui,
  maxRows,
  maxRowsCustomPresets,
  onChange,
}) => {
  const i18n = useOptionalI18n();
  const t = i18n?.t ?? defaultTranslate;
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<number | null>(maxRows);

  const currentState = useMemo(
    (): QueryMaxRowsState => ({ maxRows, maxRowsCustomPresets }),
    [maxRows, maxRowsCustomPresets],
  );

  const presetOptions = maxRowsCustomPresets.map((value) => ({
    label: t('query_editor.max_rows.option_custom_value', { count: value }),
    value,
  }));

  const selectOptions: Array<{ label: string; value: number | typeof CUSTOM_OPTION_VALUE }> = [
    { label: t('query_editor.max_rows.option_100'), value: DEFAULT_MAX_ROWS },
    ...presetOptions,
    { label: t('query_editor.max_rows.option_custom'), value: CUSTOM_OPTION_VALUE },
  ];

  const applyCustomValue = () => {
    const nextValue = Number(customDraft);
    if (!Number.isFinite(nextValue) || nextValue < 1 || nextValue > MAX_MAX_ROWS) {
      return;
    }
    const truncated = Math.trunc(nextValue);
    if (maxRowsCustomPresets.includes(truncated)) {
      onChange({ maxRows: truncated, maxRowsCustomPresets });
      setCustomPopoverOpen(false);
      return;
    }
    const next = addMaxRowsCustomPreset(currentState, truncated);
    if (
      next.maxRowsCustomPresets.length === maxRowsCustomPresets.length
      && truncated !== maxRows
      && !maxRowsCustomPresets.includes(truncated)
    ) {
      message.warning(t('query_editor.max_rows.custom.limit_reached'));
      setManageModalOpen(true);
      return;
    }
    onChange(next);
    setCustomPopoverOpen(false);
  };

  const customPopover = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 220 }}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>
        {t('query_editor.max_rows.custom.title')}
      </div>
      <InputNumber
        min={1}
        max={MAX_MAX_ROWS}
        precision={0}
        style={{ width: '100%' }}
        placeholder={t('query_editor.max_rows.custom.placeholder')}
        value={customDraft}
        onChange={(value) => setCustomDraft(typeof value === 'number' ? value : null)}
        onPressEnter={applyCustomValue}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Button
          type="link"
          size="small"
          onClick={() => setManageModalOpen(true)}
          disabled={maxRowsCustomPresets.length === 0}
        >
          {t('query_editor.max_rows.custom.manage')}
        </Button>
        <Button type="primary" size="small" onClick={applyCustomValue}>
          {t('query_editor.max_rows.custom.confirm')}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Popover
        open={customPopoverOpen}
        onOpenChange={setCustomPopoverOpen}
        trigger="click"
        placement="bottomLeft"
        content={customPopover}
      >
        <Tooltip title={t('query_editor.max_rows.tooltip')}>
          <Select
            className={
              isV2Ui
                ? 'gn-v2-query-toolbar-select gn-v2-query-toolbar-max-rows-select'
                : undefined
            }
            style={isV2Ui ? undefined : { width: 170 }}
            value={maxRows}
            onChange={(val) => {
              if (String(val) === CUSTOM_OPTION_VALUE) {
                setCustomDraft(maxRows);
                setCustomPopoverOpen(true);
                return;
              }
              onChange({
                maxRows: Number(val),
                maxRowsCustomPresets,
              });
            }}
            options={selectOptions}
          />
        </Tooltip>
      </Popover>
      <Modal
        open={manageModalOpen}
        title={t('query_editor.max_rows.custom.manage')}
        footer={null}
        onCancel={() => setManageModalOpen(false)}
      >
        {maxRowsCustomPresets.length === 0 ? (
          <div>{t('query_editor.max_rows.custom.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {maxRowsCustomPresets.map((value) => (
              <div
                key={value}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
              >
                <span>{t('query_editor.max_rows.option_custom_value', { count: value })}</span>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label={t('query_editor.max_rows.custom.delete')}
                  onClick={() => onChange(removeMaxRowsCustomPreset(currentState, value))}
                />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
};

export default QueryEditorMaxRowsSelect;
