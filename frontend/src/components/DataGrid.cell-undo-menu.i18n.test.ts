import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const v2MenuSource = readFileSync(new URL('./V2TableContextMenu.tsx', import.meta.url), 'utf8');

describe('DataGrid cell undo menu i18n guards', () => {
  it('localizes cell undo action labels in the v2 context menu', () => {
    expect(v2MenuSource).toContain("data_grid.context_menu.undo_cell_change");
    expect(v2MenuSource).not.toContain('撤销此单元格修改');
  });
});
