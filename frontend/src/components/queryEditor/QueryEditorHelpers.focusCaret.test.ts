import { describe, expect, it, vi } from 'vitest';

import { focusQueryEditorCaret } from './QueryEditorHelpers';

describe('focusQueryEditorCaret', () => {
  it('returns false when editor is missing', () => {
    expect(focusQueryEditorCaret(null)).toBe(false);
    expect(focusQueryEditorCaret(undefined)).toBe(false);
  });

  it('focuses the editor without moving the caret by default', () => {
    const editor = {
      getModel: vi.fn(() => ({
        getLineCount: () => 3,
        getLineMaxColumn: () => 12,
      })),
      setPosition: vi.fn(),
      revealPosition: vi.fn(),
      focus: vi.fn(),
    };

    expect(focusQueryEditorCaret(editor)).toBe(true);
    expect(editor.focus).toHaveBeenCalledTimes(1);
    expect(editor.setPosition).not.toHaveBeenCalled();
  });

  it('moves the caret to the end of the document when requested', () => {
    const editor = {
      getModel: vi.fn(() => ({
        getLineCount: () => 2,
        getLineMaxColumn: (lineNumber: number) => (lineNumber === 2 ? 9 : 4),
      })),
      setPosition: vi.fn(),
      revealPosition: vi.fn(),
      focus: vi.fn(),
    };

    expect(focusQueryEditorCaret(editor, { toEnd: true })).toBe(true);
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 2, column: 9 });
    expect(editor.revealPosition).toHaveBeenCalledWith({ lineNumber: 2, column: 9 });
    expect(editor.focus).toHaveBeenCalledTimes(1);
  });
});
