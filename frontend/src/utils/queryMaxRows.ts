export const DEFAULT_MAX_ROWS = 100;
export const MAX_MAX_ROWS = 50000;
export const LEGACY_UNLIMITED_MAX_ROWS = 50000;
export const MAX_CUSTOM_PRESETS = 5;

export type QueryMaxRowsState = {
  maxRows: number;
  maxRowsCustomPresets: number[];
};

const clampMaxRows = (value: number): number =>
  Math.min(MAX_MAX_ROWS, Math.max(1, Math.trunc(value)));

export const sanitizeMaxRowsCustomPresets = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<number>();
  for (const item of value) {
    const n = Number(item);
    if (Number.isFinite(n) && n >= 1 && n <= MAX_MAX_ROWS) unique.add(clampMaxRows(n));
  }
  return [...unique].sort((a, b) => a - b).slice(0, MAX_CUSTOM_PRESETS);
};

const normalizeLegacyMaxRows = (raw: number): number => {
  if (!Number.isFinite(raw) || raw <= 0) return LEGACY_UNLIMITED_MAX_ROWS;
  return clampMaxRows(raw);
};

export const migrateQueryMaxRows = (raw: unknown): QueryMaxRowsState => {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const hasMaxRowsKey = 'maxRows' in input;
  const hasPresets =
    Array.isArray(input.maxRowsCustomPresets) && input.maxRowsCustomPresets.length > 0;

  if (!hasMaxRowsKey && !hasPresets) {
    return {
      maxRows: DEFAULT_MAX_ROWS,
      maxRowsCustomPresets: [],
    };
  }

  const maxRows = normalizeLegacyMaxRows(Number(input.maxRows));
  let presets = sanitizeMaxRowsCustomPresets(input.maxRowsCustomPresets);
  if (maxRows !== DEFAULT_MAX_ROWS && !presets.includes(maxRows)) {
    presets = sanitizeMaxRowsCustomPresets([...presets, maxRows]);
  }
  if (presets.length > MAX_CUSTOM_PRESETS) {
    const keep = new Set<number>([maxRows]);
    for (const p of presets) {
      if (keep.size >= MAX_CUSTOM_PRESETS) break;
      keep.add(p);
    }
    presets = [...keep].sort((a, b) => a - b);
  }
  return {
    maxRows,
    maxRowsCustomPresets: presets,
  };
};

export const addMaxRowsCustomPreset = (
  state: QueryMaxRowsState,
  value: number,
): QueryMaxRowsState => {
  const next = clampMaxRows(value);
  if (state.maxRowsCustomPresets.includes(next)) {
    return { ...state, maxRows: next };
  }
  if (state.maxRowsCustomPresets.length >= MAX_CUSTOM_PRESETS) {
    return state;
  }
  return {
    maxRows: next,
    maxRowsCustomPresets: sanitizeMaxRowsCustomPresets([...state.maxRowsCustomPresets, next]),
  };
};

export const removeMaxRowsCustomPreset = (
  state: QueryMaxRowsState,
  value: number,
): QueryMaxRowsState => ({
  maxRows: state.maxRows === value ? DEFAULT_MAX_ROWS : state.maxRows,
  maxRowsCustomPresets: state.maxRowsCustomPresets.filter((item) => item !== value),
});
