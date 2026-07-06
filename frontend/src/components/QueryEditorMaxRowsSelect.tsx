import React, { useMemo, useState } from 'react';
import { Button, InputNumber, Modal, Select, Tooltip, message } from 'antd';
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
  maxRows: number;
  maxRowsCustomPresets: number[];
  maxRowsCap?: number;
  onChange: (next: QueryMaxRowsState) => void;
  variant?: 'toolbar' | 'settings';
};

const QueryEditorMaxRowsSelect: React.FC<QueryEditorMaxRowsSelectProps> = ({
  maxRows,
  maxRowsCustomPresets,
  maxRowsCap,
  onChange,
  variant = 'toolbar',
}) => {
  const i18n = useOptionalI18n();
  const t = i18n?.t ?? defaultTranslate;
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<number | null>(maxRows);
  const effectiveMaxRowsCap = Number.isFinite(maxRowsCap) && (maxRowsCap as number) > 0
    ? Math.trunc(maxRowsCap as number)
    : MAX_MAX_ROWS;

  const currentState = useMemo(
    (): QueryMaxRowsState => ({ maxRows, maxRowsCustomPresets }),
    [maxRows, maxRowsCustomPresets],
  );

  const selectOptions = useMemo(() => {
    const options: Array<{ label: string; value: number | typeof CUSTOM_OPTION_VALUE }> = [
      { label: t('query_editor.max_rows.option_100'), value: DEFAULT_MAX_ROWS },
    ];

    maxRowsCustomPresets.forEach((value) => {
      options.push({
        label: t('query_editor.max_rows.option_custom_value', { count: value }),
        value,
      });
    });

    if (
      maxRows !== DEFAULT_MAX_ROWS
      && !maxRowsCustomPresets.includes(maxRows)
    ) {
      options.push({
        label: t('query_editor.max_rows.option_custom_value', { count: maxRows }),
        value: maxRows,
      });
    }

    options.push({ label: t('query_editor.max_rows.option_custom'), value: CUSTOM_OPTION_VALUE });
    return options;
  }, [maxRows, maxRowsCustomPresets, t]);

  const applyCustomValue = () => {
    const nextValue = Number(customDraft);
    if (!Number.isFinite(nextValue) || nextValue < 1 || nextValue > effectiveMaxRowsCap) {
      return;
    }
    const truncated = Math.trunc(nextValue);

    if (truncated === DEFAULT_MAX_ROWS) {
      onChange({ maxRows: DEFAULT_MAX_ROWS, maxRowsCustomPresets });
      setCustomModalOpen(false);
      return;
    }

    if (maxRowsCustomPresets.includes(truncated)) {
      onChange({ maxRows: truncated, maxRowsCustomPresets });
      setCustomModalOpen(false);
      return;
    }

    const next = addMaxRowsCustomPreset(currentState, truncated);
    if (
      next.maxRowsCustomPresets.length === maxRowsCustomPresets.length
      && truncated !== maxRows
    ) {
      message.warning(t('query_editor.max_rows.custom.limit_reached'));
      setCustomModalOpen(false);
      setManageModalOpen(true);
      return;
    }

    onChange(next);
    setCustomModalOpen(false);
  };

  const openCustomModal = () => {
    setCustomDraft(maxRows);
    setCustomModalOpen(true);
  };

  return (
    <>
      <Tooltip title={t('query_editor.max_rows.tooltip')}>
        <Select
          className={
            variant === 'settings'
              ? 'gn-v2-settings-max-rows-select'
              : 'gn-v2-query-toolbar-select gn-v2-query-toolbar-max-rows-select'
          }
          style={undefined}
          value={maxRows}
          onChange={(val) => {
            if (String(val) === CUSTOM_OPTION_VALUE) {
              openCustomModal();
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
      <Modal
        open={customModalOpen}
        title={t('query_editor.max_rows.custom.title')}
        okText={t('query_editor.max_rows.custom.confirm')}
        cancelText={t('common.cancel')}
        onOk={applyCustomValue}
        onCancel={() => setCustomModalOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InputNumber
            min={1}
            max={effectiveMaxRowsCap}
            precision={0}
            style={{ width: '100%' }}
            placeholder={t('query_editor.max_rows.custom.placeholder')}
            value={customDraft}
            onChange={(value) => setCustomDraft(typeof value === 'number' ? value : null)}
            onPressEnter={applyCustomValue}
          />
          <Button
            type="link"
            size="small"
            style={{ alignSelf: 'flex-start', paddingInline: 0 }}
            onClick={() => {
              setCustomModalOpen(false);
              setManageModalOpen(true);
            }}
            disabled={maxRowsCustomPresets.length === 0}
          >
            {t('query_editor.max_rows.custom.manage')}
          </Button>
        </div>
      </Modal>
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
