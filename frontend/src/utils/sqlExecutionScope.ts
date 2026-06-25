import {
  findSqlStatementRanges,
  resolveCurrentSqlStatementRange,
  resolveExecutableSql,
} from './sqlStatementSelection';

export type SqlExecutionChooserOptionId = 'current' | 'all';

export type SqlExecutionChooserOption = {
  id: SqlExecutionChooserOptionId;
  sql: string;
  preview: string;
  highlightStart: number;
  highlightEnd: number;
  statementCount: number;
};

export type SqlExecutionIntent =
  | { kind: 'execute'; sql: string }
  | {
      kind: 'chooser';
      options: SqlExecutionChooserOption[];
      defaultOptionId: SqlExecutionChooserOptionId;
    }
  | { kind: 'use-auto' }
  | { kind: 'empty' };

export function truncateSqlPreview(sql: string, maxLength = 80): string {
  const singleLine = String(sql || '').replace(/\s+/g, ' ').trim();
  if (!singleLine) return '';
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function buildAllStatementsSql(fullSql: string): string {
  const statements = findSqlStatementRanges(fullSql)
    .map((range) => stripLeadingSqlNoise(range.text))
    .filter((sql) => sql.trim() && hasExecutableSqlContent(sql));
  if (statements.length <= 1) {
    return statements[0] || '';
  }

  let merged = statements[0];
  for (let i = 1; i < statements.length; i += 1) {
    const previous = merged.replace(/\s+$/g, '');
    const separator = /[;；]$/.test(previous) ? '\n' : ';\n';
    merged += `${separator}${statements[i]}`;
  }
  return merged;
}

export function buildSqlExecutionChooserOptions(
  fullSql: string,
  cursorOffset: number,
): SqlExecutionChooserOption[] {
  const text = String(fullSql || '').replace(/\r\n/g, '\n');
  const ranges = findSqlStatementRanges(text);
  const currentRange = resolveCurrentSqlStatementRange(text, cursorOffset);
  const executableStatementCount = ranges
    .map((range) => stripLeadingSqlNoise(range.text))
    .filter((sql) => sql.trim() && hasExecutableSqlContent(sql))
    .length;
  const fallbackSelection = resolveExecutableSql(text, cursorOffset, '');
  const currentSqlCandidate = fallbackSelection?.sql?.trim()
    ? fallbackSelection.sql
    : (currentRange?.text || '');
  const currentSql = stripLeadingSqlNoise(currentSqlCandidate);
  const allSql = buildAllStatementsSql(text);

  const options: SqlExecutionChooserOption[] = [];
  if (currentSql.trim() && hasExecutableSqlContent(currentSql)) {
    options.push({
      id: 'current',
      sql: currentSql,
      preview: truncateSqlPreview(currentSql),
      highlightStart: currentRange?.start ?? 0,
      highlightEnd: currentRange?.end ?? text.length,
      statementCount: 1,
    });
  }
  if (allSql.trim()) {
    options.push({
      id: 'all',
      sql: allSql,
      preview: truncateSqlPreview(allSql),
      highlightStart: 0,
      highlightEnd: text.length,
      statementCount: executableStatementCount,
    });
  }
  return options;
}

const hasExecutableSqlContent = (sql: string): boolean => {
  const text = String(sql || '');
  let i = 0;
  while (i < text.length) {
    // Whitespace
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i += 1;
      continue;
    }

    // Line comment: -- ...
    if (ch === '-' && i + 1 < text.length && text[i + 1] === '-') {
      i += 2;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    // Line comment: # ...
    if (ch === '#') {
      i += 1;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    // Block comment: /* ... */
    if (ch === '/' && i + 1 < text.length && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        i += 1;
      }
      if (i + 1 < text.length) i += 2;
      continue;
    }

    // Any other char means there's something executable-ish.
    return true;
  }
  return false;
};

const stripLeadingSqlNoise = (sql: string): string => {
  const text = String(sql || '');
  let i = 0;
  while (i < text.length) {
    // Whitespace
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i += 1;
      continue;
    }

    // Line comment: -- ...
    if (ch === '-' && i + 1 < text.length && text[i + 1] === '-') {
      i += 2;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    // Line comment: # ...
    if (ch === '#') {
      i += 1;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    // Block comment: /* ... */
    if (ch === '/' && i + 1 < text.length && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        i += 1;
      }
      if (i + 1 < text.length) i += 2;
      continue;
    }

    break;
  }
  return text.slice(i);
};

const cursorLineHasExecutableSql = (fullSql: string, cursorOffset: number): boolean => {
  const text = String(fullSql || '').replace(/\r\n/g, '\n');
  const offset = Math.max(0, Math.min(text.length, Number.isFinite(cursorOffset) ? cursorOffset : 0));
  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const nextLineBreak = text.indexOf('\n', offset);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const line = text.slice(lineStart, lineEnd);
  return hasExecutableSqlContent(line);
};

export function resolveSqlExecutionIntent(input: {
  fullSql: string;
  selectedSql: string;
  cursorOffset: number;
  askWhatToExecute: boolean;
}): SqlExecutionIntent {
  const selected = String(input.selectedSql || '').trim();
  if (selected) {
    return { kind: 'execute', sql: input.selectedSql };
  }

  if (!input.askWhatToExecute) {
    return { kind: 'use-auto' };
  }

  const text = String(input.fullSql || '').replace(/\r\n/g, '\n');
  const executableRanges = findSqlStatementRanges(text)
    .map((range) => ({
      ...range,
      text: stripLeadingSqlNoise(range.text),
    }))
    .filter((range) => range.text.trim() && hasExecutableSqlContent(range.text));
  if (executableRanges.length < 2) {
    if (executableRanges.length === 1) {
      return { kind: 'execute', sql: executableRanges[0].text };
    }

    // Spec expects "current statement" semantics even when cursor is outside of it (e.g. leading comments).
    // Still, pure comment/whitespace scripts should not execute.
    //
    // Note: our statement splitter can merge leading comments with the following statement. In that case,
    // prefer the executable statement text (without the comment prefix) when it can be resolved.
    const selection = resolveExecutableSql(text, input.cursorOffset, '');
    if (selection?.sql?.trim() && hasExecutableSqlContent(selection.sql)) {
      const stripped = stripLeadingSqlNoise(selection.sql);
      if (stripped.trim() && hasExecutableSqlContent(stripped)) {
        return { kind: 'execute', sql: stripped };
      }
      return { kind: 'execute', sql: selection.sql };
    }

    const current = resolveCurrentSqlStatementRange(text, input.cursorOffset);
    if (current?.text?.trim() && hasExecutableSqlContent(current.text)) {
      const stripped = stripLeadingSqlNoise(current.text);
      if (stripped.trim() && hasExecutableSqlContent(stripped)) {
        return { kind: 'execute', sql: stripped };
      }
      return { kind: 'execute', sql: current.text };
    }

    return { kind: 'empty' };
  }

  if (!cursorLineHasExecutableSql(text, input.cursorOffset)) {
    return { kind: 'empty' };
  }

  const options = buildSqlExecutionChooserOptions(text, input.cursorOffset);
  if (options.length === 0) {
    return { kind: 'empty' };
  }

  return {
    kind: 'chooser',
    options,
    defaultOptionId: options.some((option) => option.id === 'current') ? 'current' : 'all',
  };
}
