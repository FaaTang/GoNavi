import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { t as defaultTranslate, type I18nParams } from '../i18n';
import { type SqlExecutionChooserOption, type SqlExecutionChooserOptionId } from '../utils/sqlExecutionScope';
import { getNormalizedPositionAtOffset, normalizeEditorPosition } from './queryEditor/QueryEditorHelpers';

const SQL_EXECUTION_CHOOSER_WIDGET_ID = 'gonavi.sqlExecutionChooser';
const SQL_EXECUTION_CHOOSER_HIGHLIGHT_STYLE_ID = 'gonavi-sql-execution-chooser-highlight-style';

export type SqlExecutionChooserOptionView = Pick<
  SqlExecutionChooserOption,
  'id' | 'sql' | 'preview' | 'statementCount'
>;

type SqlExecutionChooserTranslate = (key: string, params?: I18nParams) => string;

type SqlExecutionChooserPanelProps = {
  options: SqlExecutionChooserOptionView[];
  selectedId: SqlExecutionChooserOptionId;
  onSelectedIdChange: (nextId: SqlExecutionChooserOptionId) => void;
  onConfirm: (sql: string, optionId: SqlExecutionChooserOptionId) => void;
  onCancel: () => void;
  onOpenSettings: () => void;
  translate?: SqlExecutionChooserTranslate;
};

export type MountSqlExecutionChooserProps = Omit<SqlExecutionChooserPanelProps, 'options'> & {
  options: SqlExecutionChooserOption[];
};

const resolveSelectedOption = <T extends { id: SqlExecutionChooserOptionId }>(
  options: T[],
  selectedId: SqlExecutionChooserOptionId,
): T | null => options.find((option) => option.id === selectedId) || options[0] || null;

const resolveNextOptionId = (
  options: { id: SqlExecutionChooserOptionId }[],
  selectedId: SqlExecutionChooserOptionId,
  direction: -1 | 1,
): SqlExecutionChooserOptionId | null => {
  if (options.length === 0) return null;
  const currentIndex = options.findIndex((option) => option.id === selectedId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeIndex + direction + options.length) % options.length;
  return options[nextIndex]?.id || null;
};

const ensureSqlExecutionChooserHighlightStyle = () => {
  if (document.getElementById(SQL_EXECUTION_CHOOSER_HIGHLIGHT_STYLE_ID)) return;

  const styleNode = document.createElement('style');
  styleNode.id = SQL_EXECUTION_CHOOSER_HIGHLIGHT_STYLE_ID;
  styleNode.textContent = `
.gn-sql-execution-chooser-highlight {
  background: rgba(24, 144, 255, 0.2);
  border-radius: 2px;
}
`;
  document.head.appendChild(styleNode);
};

const SqlExecutionChooserPanel: React.FC<SqlExecutionChooserPanelProps> = ({
  options,
  selectedId,
  onSelectedIdChange,
  onConfirm,
  onCancel,
  onOpenSettings,
  translate = defaultTranslate,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => resolveSelectedOption(options, selectedId),
    [options, selectedId],
  );

  const handleMoveSelection = useCallback((direction: -1 | 1) => {
    const nextId = resolveNextOptionId(options, selectedId, direction);
    if (nextId) onSelectedIdChange(nextId);
  }, [onSelectedIdChange, options, selectedId]);

  const handleConfirm = useCallback(() => {
    if (!selectedOption) return;
    onConfirm(selectedOption.sql, selectedOption.id);
  }, [onConfirm, selectedOption]);

  const handleSettingsKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onOpenSettings();
    }
  }, [onOpenSettings]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('.gn-sql-execution-chooser-settings-link')) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      handleMoveSelection(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      handleMoveSelection(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      handleConfirm();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }, [handleConfirm, handleMoveSelection, onCancel]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      ref={panelRef}
      className="gn-sql-execution-chooser"
      data-testid="sql-execution-chooser-panel"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        position: 'absolute',
        minWidth: 320,
        maxWidth: 420,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #d9d9d9',
        background: '#fff',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 40,
      }}
    >
      {options.map((option) => {
        const isSelected = option.id === selectedId;
        const label = option.id === 'current'
          ? translate('query_editor.execution.chooser.current_statement')
          : translate('query_editor.execution.chooser.all_statements', { count: option.statementCount });
        return (
          <button
            key={option.id}
            aria-pressed={isSelected}
            onClick={() => onSelectedIdChange(option.id)}
            type="button"
            style={{
              textAlign: 'left',
              borderRadius: 6,
              border: isSelected ? '1px solid #1677ff' : '1px solid #d9d9d9',
              background: isSelected ? 'rgba(22, 119, 255, 0.08)' : '#fff',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1f1f1f' }}>{label}</span>
            <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {option.preview}
            </span>
          </button>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 2 }}>
        <button
          type="button"
          className="gn-sql-execution-chooser-settings-link"
          onKeyDown={handleSettingsKeyDown}
          onClick={(event) => {
            event.preventDefault();
            onOpenSettings();
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#1677ff',
            fontSize: 12,
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {translate('query_editor.execution.chooser.settings_link')}
        </button>
      </div>
    </div>
  );
};

export function mountSqlExecutionChooser(
  editor: any,
  monaco: any,
  props: MountSqlExecutionChooserProps,
): () => void {
  if (!editor || !monaco || !props.options?.length) {
    return () => {};
  }

  ensureSqlExecutionChooserHighlightStyle();
  const domNode = document.createElement('div');
  const root = createRoot(domNode);
  let decorationIds: string[] = [];
  let currentSelectedId = props.selectedId;
  let disposed = false;

  const getSelectedOption = () => resolveSelectedOption(props.options, currentSelectedId);

  const applyHighlight = () => {
    if (!editor?.deltaDecorations) return;
    const selected = getSelectedOption();
    const model = editor.getModel?.();
    const sqlText = String(model?.getValue?.() || '');
    if (!selected || !model || !sqlText) {
      decorationIds = editor.deltaDecorations(decorationIds, []);
      return;
    }

    const start = getNormalizedPositionAtOffset(sqlText, selected.highlightStart);
    const end = getNormalizedPositionAtOffset(sqlText, selected.highlightEnd);
    const endColumn = (
      start.lineNumber === end.lineNumber && end.column <= start.column
        ? start.column + 1
        : end.column
    );

    decorationIds = editor.deltaDecorations(decorationIds, [
      {
        range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, endColumn),
        options: {
          inlineClassName: 'gn-sql-execution-chooser-highlight',
        },
      },
    ]);
  };

  const updateSelected = (nextId: SqlExecutionChooserOptionId) => {
    if (disposed || currentSelectedId === nextId) return;
    currentSelectedId = nextId;
    props.onSelectedIdChange(nextId);
    renderChooser();
    applyHighlight();
  };

  const confirmSelected = () => {
    const selected = getSelectedOption();
    if (!selected) return;
    props.onConfirm(selected.sql, selected.id);
  };

  const handleKey = (key: string): boolean => {
    if (key === 'ArrowDown') {
      const nextId = resolveNextOptionId(props.options, currentSelectedId, 1);
      if (nextId) updateSelected(nextId);
      return true;
    }
    if (key === 'ArrowUp') {
      const nextId = resolveNextOptionId(props.options, currentSelectedId, -1);
      if (nextId) updateSelected(nextId);
      return true;
    }
    if (key === 'Enter') {
      confirmSelected();
      return true;
    }
    if (key === 'Escape') {
      props.onCancel();
      return true;
    }
    return false;
  };

  const widget = {
    getId: () => SQL_EXECUTION_CHOOSER_WIDGET_ID,
    getDomNode: () => domNode,
    getPosition: () => {
      const anchor = normalizeEditorPosition(editor.getPosition?.());
      if (!anchor) return null;
      return {
        position: anchor,
        preference: [monaco.editor.ContentWidgetPositionPreference.BELOW],
      };
    },
  };

  const renderChooser = () => {
    if (disposed) return;
    root.render(
      <SqlExecutionChooserPanel
        options={props.options}
        selectedId={currentSelectedId}
        onSelectedIdChange={updateSelected}
        onConfirm={(sql, optionId) => props.onConfirm(sql, optionId)}
        onCancel={props.onCancel}
        onOpenSettings={props.onOpenSettings}
        translate={props.translate}
      />,
    );
  };

  renderChooser();
  editor.addContentWidget?.(widget);
  applyHighlight();

  const editorKeydownDisposable = editor.onKeyDown?.((event: any) => {
    const key = String(event?.browserEvent?.key || '');
    if (!handleKey(key)) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
  });

  const cursorChangeDisposable = editor.onDidChangeCursorPosition?.(() => {
    editor.layoutContentWidget?.(widget);
  });

  const contentChangeDisposable = editor.onDidChangeModelContent?.(() => {
    applyHighlight();
  });

  return () => {
    if (disposed) return;
    disposed = true;

    editor.removeContentWidget?.(widget);
    if (editor?.deltaDecorations) {
      decorationIds = editor.deltaDecorations(decorationIds, []);
    }

    editorKeydownDisposable?.dispose?.();
    cursorChangeDisposable?.dispose?.();
    contentChangeDisposable?.dispose?.();
    root.unmount();
  };
}

export default SqlExecutionChooserPanel;
