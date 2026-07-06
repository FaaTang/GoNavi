import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_ROWS,
  LEGACY_UNLIMITED_MAX_ROWS,
  LOW_MEMORY_MAX_ROWS_CAP,
  addMaxRowsCustomPreset,
  capQueryMaxRowsForLowMemory,
  migrateQueryMaxRows,
  queryMaxRowsNeedsLowMemoryCap,
  resolveCappedTabMaxRows,
  resolveEffectiveTabMaxRows,
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

  it('does not store the fixed default max rows in custom presets', () => {
    expect(sanitizeMaxRowsCustomPresets([100, 5000, 100, 5000])).toEqual([5000]);
    expect(addMaxRowsCustomPreset({ maxRows: 5000, maxRowsCustomPresets: [5000] }, 100)).toEqual({
      maxRows: 100,
      maxRowsCustomPresets: [5000],
    });
  });

  it('caps max rows and presets for low-memory mode', () => {
    expect(queryMaxRowsNeedsLowMemoryCap({ maxRows: 50, maxRowsCustomPresets: [] })).toBe(false);
    expect(queryMaxRowsNeedsLowMemoryCap({
      maxRows: 100,
      maxRowsCustomPresets: [5000],
    })).toBe(true);
    expect(capQueryMaxRowsForLowMemory({
      maxRows: 5000,
      maxRowsCustomPresets: [5000, 200],
    })).toEqual({
      maxRows: LOW_MEMORY_MAX_ROWS_CAP,
      maxRowsCustomPresets: [],
    });
  });

  it('resolves per-tab max rows with global fallback', () => {
    expect(resolveEffectiveTabMaxRows(undefined, 5000)).toBe(5000);
    expect(resolveEffectiveTabMaxRows(200, 5000)).toBe(200);
    expect(resolveEffectiveTabMaxRows(0, 5000)).toBe(5000);
  });

  it('applies low-memory cap on top of tab override', () => {
    expect(resolveCappedTabMaxRows(5000, 100, LOW_MEMORY_MAX_ROWS_CAP)).toBe(100);
    expect(resolveCappedTabMaxRows(undefined, 5000, LOW_MEMORY_MAX_ROWS_CAP)).toBe(100);
    expect(resolveCappedTabMaxRows(50, 5000, LOW_MEMORY_MAX_ROWS_CAP)).toBe(50);
  });
});
