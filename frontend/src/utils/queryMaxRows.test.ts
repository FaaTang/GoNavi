import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_ROWS,
  LEGACY_UNLIMITED_MAX_ROWS,
  migrateQueryMaxRows,
  sanitizeMaxRowsCustomPresets,
} from './queryMaxRows';

describe('queryMaxRows', () => {
  it('defaults new users to 100 with empty presets', () => {
    expect(migrateQueryMaxRows(undefined)).toEqual({
      maxRows: DEFAULT_MAX_ROWS,
      maxRowsCustomPresets: [],
    });
  });

  it('defaults empty persisted object to 100 with empty presets', () => {
    expect(migrateQueryMaxRows({})).toEqual({
      maxRows: DEFAULT_MAX_ROWS,
      maxRowsCustomPresets: [],
    });
  });

  it('keeps legacy maxRows=5000 and adds preset silently', () => {
    expect(migrateQueryMaxRows({ maxRows: 5000 })).toEqual({
      maxRows: 5000,
      maxRowsCustomPresets: [5000],
    });
  });

  it('maps legacy unlimited (0) to 50000', () => {
    expect(migrateQueryMaxRows({ maxRows: 0 })).toEqual({
      maxRows: LEGACY_UNLIMITED_MAX_ROWS,
      maxRowsCustomPresets: [LEGACY_UNLIMITED_MAX_ROWS],
    });
  });

  it('caps presets to 5 keeping current maxRows', () => {
    const result = migrateQueryMaxRows({
      maxRows: 3000,
      maxRowsCustomPresets: [1000, 2000, 4000, 5000, 8000],
    });
    expect(result.maxRows).toBe(3000);
    expect(result.maxRowsCustomPresets).toContain(3000);
    expect(result.maxRowsCustomPresets.length).toBeLessThanOrEqual(5);
  });

  it('sanitizes custom presets to unique sorted values within bounds', () => {
    expect(sanitizeMaxRowsCustomPresets([5000, 1000, 5000, 0, 999999, '2000'])).toEqual([
      1000, 2000, 5000,
    ]);
  });
});
