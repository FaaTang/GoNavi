import React from 'react';
import { Segmented } from 'antd';
import { t as defaultTranslate, type I18nParams } from '../i18n';

type GridViewMode = 'table' | 'json' | 'text' | 'fields' | 'ddl' | 'er';

export type DataGridResultViewTranslate = (key: string, params?: I18nParams) => string;

export interface DataGridResultViewSwitcherProps {  darkMode: boolean;
  viewMode: GridViewMode;
  onViewModeChange: (nextMode: GridViewMode) => void;
  translate?: DataGridResultViewTranslate;
}

const DataGridResultViewSwitcher: React.FC<DataGridResultViewSwitcherProps> = ({  darkMode,
  viewMode,
  onViewModeChange,
  translate = defaultTranslate,
}) => (
  <div
    data-grid-view-switcher="true"
    className={'gn-v2-data-grid-result-switcher'}
    style={undefined}
  >
    <span style={undefined}>{translate('data_grid.view.result_view')}</span>
    <Segmented
      size="small"
      value={viewMode === 'json' || viewMode === 'text' ? viewMode : 'table'}
      options={[
        { label: translate('data_grid.view.table'), value: 'table' },
        { label: 'JSON', value: 'json' },
        { label: translate('data_grid.view.text'), value: 'text' },
      ]}
      onChange={(value) => onViewModeChange(String(value) as GridViewMode)}
    />
  </div>
);

export default DataGridResultViewSwitcher;
