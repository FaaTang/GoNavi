import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { t as defaultTranslate, type I18nParams } from '../i18n';
import {
  isSqlExecutionStatementOptionId,
  isSqlExecutionSubqueryOptionId,
  isSqlExecutionTableOptionId,
  type SqlExecutionChooserOption,
  type SqlExecutionChooserOptionId,
} from '../utils/sqlExecutionScope';
import { getNormalizedPositionAtOffset, normalizeEditorPosition } from './queryEditor/QueryEditorHelpers';

const SQL_EXECUTION_CHOOSER_WIDGET_ID = 'gonavi.sqlExecutionChooser';
const SQL_EXECUTION_CHOOSER_HIGHLIGHT_STYLE_ID = 'gonavi-sql-execution-chooser-highlight-style';
const SQL_EXECUTION_CHOOSER_OVERLAY_STYLE_ID = 'gonavi-sql-execution-chooser-overlay-style';

export type SqlExecutionChooserOptionView = Pick<
  SqlExecutionChooserOption,
  'id' | 'sql' | 'preview' | 'statementCount' | 'tableName'
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
  overlayRoot?: HTMLElement | null;
};

const resolveSelectedOption = <T extends { id: SqlExecutionChooserOptionId }>(
  options: T[],
  selectedId: SqlExecutionChooserOptionId,
): T | null => options.find((option) => option.id === selectedId) || options[0] || null;

const isPrimaryChooserOptionId = (id: SqlExecutionChooserOptionId): boolean => (
  isSqlExecutionStatementOptionId(id)
  || isSqlExecutionTableOptionId(id)
  || id === 'all'
);

const splitSqlExecutionChooserColumns = <T extends { id: SqlExecutionChooserOptionId }>(
  options: T[],
): { primaryOptions: T[]; subqueryOptions: T[] } => ({
  primaryOptions: options.filter((option) => isPrimaryChooserOptionId(option.id)),
  subqueryOptions: options.filter((option) => isSqlExecutionSubqueryOptionId(option.id)),
});

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

const resolveColumnNavigateOptionId = (
  options: { id: SqlExecutionChooserOptionId }[],
  selectedId: SqlExecutionChooserOptionId,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
): SqlExecutionChooserOptionId | null => {
  const { primaryOptions, subqueryOptions } = splitSqlExecutionChooserColumns(options);
  const inPrimary = primaryOptions.some((option) => option.id === selectedId);
  const inSubquery = subqueryOptions.some((option) => option.id === selectedId);
  const activeColumn = inSubquery
    ? subqueryOptions
    : (inPrimary ? primaryOptions : (primaryOptions.length > 0 ? primaryOptions : subqueryOptions));
  const otherColumn = activeColumn === primaryOptions ? subqueryOptions : primaryOptions;

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    return resolveNextOptionId(activeColumn, selectedId, key === 'ArrowDown' ? 1 : -1);
  }

  if ((key === 'ArrowLeft' || key === 'ArrowRight') && otherColumn.length > 0) {
    if (key === 'ArrowLeft' && activeColumn === primaryOptions) return null;
    if (key === 'ArrowRight' && activeColumn === subqueryOptions) return null;
    const currentIndex = Math.max(0, activeColumn.findIndex((option) => option.id === selectedId));
    return otherColumn[Math.min(currentIndex, otherColumn.length - 1)]?.id || otherColumn[0]?.id || null;
  }

  return null;
};

const ensureSqlExecutionChooserHighlightStyle = () => {
  if (!document.getElementById(SQL_EXECUTION_CHOOSER_HIGHLIGHT_STYLE_ID)) {
    const styleNode = document.createElement('style');
    styleNode.id = SQL_EXECUTION_CHOOSER_HIGHLIGHT_STYLE_ID;
    styleNode.textContent = `
.gn-sql-execution-chooser-highlight {
  background: rgba(24, 144, 255, 0.2);
  border-radius: 2px;
}
`;
    document.head.appendChild(styleNode);
  }

  if (!document.getElementById(SQL_EXECUTION_CHOOSER_OVERLAY_STYLE_ID)) {
    const overlayStyleNode = document.createElement('style');
    overlayStyleNode.id = SQL_EXECUTION_CHOOSER_OVERLAY_STYLE_ID;
    overlayStyleNode.textContent = `
.gn-sql-execution-chooser-overlay {
  position: absolute;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
  overflow: visible;
}
.gn-sql-execution-chooser-overlay.is-open {
  pointer-events: auto;
}
.gn-sql-execution-chooser-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background: transparent;
}
.gn-sql-execution-chooser-host {
  position: absolute;
  pointer-events: auto;
  z-index: 1;
}
`;
    document.head.appendChild(overlayStyleNode);
  }
};

export const positionSqlExecutionChooserHost = (
  editor: any,
  hostNode: HTMLElement,
  overlayRoot: HTMLElement,
  monaco?: any,
): boolean => {
  const anchor = normalizeEditorPosition(editor?.getPosition?.());
  const editorDom = editor?.getDomNode?.();
  if (!anchor || !editorDom) {
    return false;
  }

  const coords = editor.getScrolledVisiblePosition?.(anchor);
  if (!coords) {
    return false;
  }

  const overlayRect = overlayRoot.getBoundingClientRect();
  const editorRect = editorDom.getBoundingClientRect();
  const lineHeight = Number(editor?.getOption?.(monaco?.editor?.EditorOption?.lineHeight) || 20);
  const gap = 6;
  const margin = 8;
  const measuredWidth = Math.max(hostNode.offsetWidth || 0, hostNode.scrollWidth || 0);
  const measuredHeight = Math.max(hostNode.offsetHeight || 0, hostNode.scrollHeight || 0);
  const popupWidth = measuredWidth > 0 ? measuredWidth : 320;
  const popupHeight = measuredHeight > 0 ? measuredHeight : 120;
  const overlayWidth = overlayRect.width;
  const overlayHeight = overlayRect.height;

  const cursorX = editorRect.left - overlayRect.left + coords.left;
  const cursorTop = editorRect.top - overlayRect.top + coords.top;
  const cursorBottom = cursorTop + lineHeight;

  // Horizontally center on the cursor, then clamp inside the overlay.
  let left = cursorX - popupWidth / 2;
  const maxLeft = Math.max(margin, overlayWidth - popupWidth - margin);
  left = Math.min(Math.max(margin, left), maxLeft);

  // Prefer placing the top edge just below the cursor line.
  let top = cursorBottom + gap;
  const fitsBelow = top + popupHeight <= overlayHeight - margin;
  if (!fitsBelow) {
    const aboveTop = cursorTop - popupHeight - gap;
    if (aboveTop >= margin) {
      top = aboveTop;
    } else {
      top = Math.max(margin, overlayHeight - popupHeight - margin);
    }
  }

  hostNode.style.top = `${Math.round(top)}px`;
  hostNode.style.left = `${Math.round(left)}px`;
  return true;
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
  const { primaryOptions, subqueryOptions } = useMemo(
    () => splitSqlExecutionChooserColumns(options),
    [options],
  );
  const subqueryOptionCount = subqueryOptions.length;
  const statementOptionCount = useMemo(
    () => primaryOptions.filter((item) => isSqlExecutionStatementOptionId(item.id)).length,
    [primaryOptions],
  );
  const showTwoColumns = primaryOptions.length > 0 && subqueryOptions.length > 0;

  const resolveOptionLabel = useCallback((option: SqlExecutionChooserOptionView): string => {
    if (isSqlExecutionSubqueryOptionId(option.id)) {
      const subqueryIndexMatch = option.id.match(/^subquery-(\d+)$/);
      const subqueryIndex = subqueryIndexMatch ? Number(subqueryIndexMatch[1]) + 1 : 0;
      return subqueryOptionCount <= 1
        ? translate('query_editor.execution.chooser.current_subquery')
        : translate('query_editor.execution.chooser.subquery', { index: subqueryIndex });
    }
    if (isSqlExecutionTableOptionId(option.id)) {
      return translate('query_editor.execution.chooser.table', {
        name: option.tableName || option.preview,
      });
    }
    if (isSqlExecutionStatementOptionId(option.id)) {
      const statementIndexMatch = option.id.match(/^statement-(\d+)$/);
      const statementIndex = statementIndexMatch ? Number(statementIndexMatch[1]) + 1 : 0;
      return statementOptionCount <= 1
        ? translate('query_editor.execution.chooser.current_statement')
        : translate('query_editor.execution.chooser.statement', { index: statementIndex });
    }
    return translate('query_editor.execution.chooser.all_statements', { count: option.statementCount });
  }, [statementOptionCount, subqueryOptionCount, translate]);

  const handleMoveSelection = useCallback((key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight') => {
    const nextId = resolveColumnNavigateOptionId(options, selectedId, key);
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

    if (
      event.key === 'ArrowDown'
      || event.key === 'ArrowUp'
      || event.key === 'ArrowLeft'
      || event.key === 'ArrowRight'
    ) {
      event.preventDefault();
      handleMoveSelection(event.key);
      return;
    }
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        return;
      }
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

  const renderOptionButton = (option: SqlExecutionChooserOptionView) => {
    const isSelected = option.id === selectedId;
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
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1f1f1f' }}>
          {resolveOptionLabel(option)}
        </span>
        <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {option.preview}
        </span>
      </button>
    );
  };

  const renderColumn = (
    title: string,
    columnOptions: SqlExecutionChooserOptionView[],
    testId: string,
  ) => (
    <div
      data-testid={testId}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#8c8c8c', padding: '0 2px' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {columnOptions.map(renderOptionButton)}
      </div>
    </div>
  );

  return (
    <div
      ref={panelRef}
      className="gn-sql-execution-chooser"
      data-testid="sql-execution-chooser-panel"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        minWidth: showTwoColumns ? 560 : 320,
        maxWidth: showTwoColumns ? 720 : 420,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #d9d9d9',
        background: '#fff',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: showTwoColumns ? 'row' : 'column',
          alignItems: 'stretch',
          gap: showTwoColumns ? 10 : 8,
        }}
      >
        {primaryOptions.length > 0 && renderColumn(
          translate('query_editor.execution.chooser.column_statements'),
          primaryOptions,
          'sql-execution-chooser-primary-column',
        )}
        {showTwoColumns && (
          <div style={{ width: 1, alignSelf: 'stretch', background: '#f0f0f0', flex: '0 0 1px' }} />
        )}
        {subqueryOptions.length > 0 && renderColumn(
          translate('query_editor.execution.chooser.column_subqueries'),
          subqueryOptions,
          'sql-execution-chooser-subquery-column',
        )}
      </div>
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
  domNode.className = 'gn-sql-execution-chooser-host';
  const overlayRoot = props.overlayRoot || null;
  const useOverlayRoot = !!overlayRoot;
  let backdropNode: HTMLDivElement | null = null;
  const openedAt = performance.now();
  const OUTSIDE_DISMISS_GUARD_MS = 200;
  let handleOutsidePointerDown: ((event: MouseEvent) => void) | null = null;
  if (useOverlayRoot) {
    overlayRoot.classList.add('is-open');
    backdropNode = document.createElement('div');
    backdropNode.className = 'gn-sql-execution-chooser-backdrop';
    backdropNode.setAttribute('data-testid', 'sql-execution-chooser-backdrop');
    overlayRoot.appendChild(backdropNode);
    overlayRoot.appendChild(domNode);
    handleOutsidePointerDown = (event: MouseEvent) => {
      if (disposed) {
        return;
      }
      if (performance.now() - openedAt < OUTSIDE_DISMISS_GUARD_MS) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node) || domNode.contains(target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      props.onCancel();
    };
    document.addEventListener('mousedown', handleOutsidePointerDown, true);
  }
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

  const updateOverlayPosition = () => {
    if (!useOverlayRoot || !overlayRoot || disposed) return;
    positionSqlExecutionChooserHost(editor, domNode, overlayRoot, monaco);
  };

  const scheduleOverlayPosition = () => {
    if (!useOverlayRoot) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateOverlayPosition();
      });
    });
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
    scheduleOverlayPosition();
  };

  const handleKey = (event: any): boolean => {
    const key = String(event?.browserEvent?.key || event?.key || '');
    const shiftKey = !!(event?.browserEvent?.shiftKey ?? event?.shiftKey);
    if (
      key === 'ArrowDown'
      || key === 'ArrowUp'
      || key === 'ArrowLeft'
      || key === 'ArrowRight'
    ) {
      const nextId = resolveColumnNavigateOptionId(props.options, currentSelectedId, key);
      if (nextId) updateSelected(nextId);
      return true;
    }
    if (key === 'Enter') {
      if (shiftKey) {
        return false;
      }
      confirmSelected();
      return true;
    }
    if (key === 'Escape') {
      props.onCancel();
      return true;
    }
    return false;
  };

  renderChooser();
  if (useOverlayRoot) {
    updateOverlayPosition();
  } else {
    editor.addContentWidget?.(widget);
  }
  applyHighlight();

  const editorKeydownDisposable = editor.onKeyDown?.((event: any) => {
    if (!handleKey(event)) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.browserEvent?.preventDefault?.();
    event?.browserEvent?.stopPropagation?.();
  });

  const cursorChangeDisposable = editor.onDidChangeCursorPosition?.(() => {
    if (useOverlayRoot) {
      scheduleOverlayPosition();
      return;
    }
    editor.layoutContentWidget?.(widget);
  });

  const scrollChangeDisposable = useOverlayRoot
    ? editor.onDidScrollChange?.(() => {
        scheduleOverlayPosition();
      })
    : null;

  const layoutChangeDisposable = useOverlayRoot
    ? editor.onDidLayoutChange?.(() => {
        scheduleOverlayPosition();
      })
    : null;

  const contentChangeDisposable = editor.onDidChangeModelContent?.(() => {
    applyHighlight();
  });

  return () => {
    if (disposed) return;
    disposed = true;

    if (useOverlayRoot) {
      overlayRoot?.classList.remove('is-open');
      backdropNode?.remove();
      domNode.remove();
    } else {
      editor.removeContentWidget?.(widget);
    }
    if (editor?.deltaDecorations) {
      decorationIds = editor.deltaDecorations(decorationIds, []);
    }

    editorKeydownDisposable?.dispose?.();
    cursorChangeDisposable?.dispose?.();
    scrollChangeDisposable?.dispose?.();
    layoutChangeDisposable?.dispose?.();
    contentChangeDisposable?.dispose?.();
    if (handleOutsidePointerDown) {
      document.removeEventListener('mousedown', handleOutsidePointerDown, true);
    }
    root.unmount();
  };
}

export default SqlExecutionChooserPanel;
