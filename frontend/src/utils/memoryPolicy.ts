import {
  resolveAppearanceValues,
  type AppearanceSettingsLike,
} from "./appearance";
import {
  migrateQueryMaxRows,
  type QueryMaxRowsState,
} from "./queryMaxRows";

export interface MemoryPolicyAppearance {
  enabled: boolean;
  opacity: number;
  blur: number;
}

export interface MemoryAdvancedSettings {
  destroyInactiveTabs: boolean;
  sidebarDbCacheLimit: number;
  runtimeSqlLogLimit: number;
  aiMessageMemoryLimit: number;
  sidebarIdleReleaseMinutes: number;
  goGCPercent: number;
}

export interface MemorySettings {
  lowMemoryMode: boolean;
  /** When false, AI UI modules are not loaded and AI entry points are hidden. */
  aiAssistantEnabled: boolean;
  advanced: MemoryAdvancedSettings;
  /** Stashed query max-rows state restored when low-memory mode is turned off. */
  queryMaxRowsStash: QueryMaxRowsState | null;
}

export type MemoryAdvancedOptionKey = keyof MemoryAdvancedSettings;

export interface MemoryPolicy {
  effectiveLowMemoryMode: boolean;
  envForced: boolean;
  memorySettings: MemorySettings;
  appearance: MemoryPolicyAppearance;
}

export const NORMAL_SIDEBAR_DB_CACHE_LIMIT = 12;
export const NORMAL_RUNTIME_SQL_LOG_LIMIT = 120;
export const NORMAL_GO_GC_PERCENT = 50;

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  lowMemoryMode: false,
  aiAssistantEnabled: false,
  advanced: {
    destroyInactiveTabs: true,
    sidebarDbCacheLimit: 6,
    runtimeSqlLogLimit: 60,
    aiMessageMemoryLimit: 50,
    sidebarIdleReleaseMinutes: 30,
    goGCPercent: 40,
  },
  queryMaxRowsStash: null,
};

const LOW_MEMORY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.trunc(value)));

const sanitizeBoundedInt = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  const raw = Number(value);
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  return clampInt(raw, min, max);
};

const sanitizeSidebarDbCacheLimit = (value: unknown): number => {
  const fallback = DEFAULT_MEMORY_SETTINGS.advanced.sidebarDbCacheLimit;
  const raw = Number(value);
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  const clamped = clampInt(raw, 6, 24);
  return clamped % 2 === 0 ? clamped : clamped - 1;
};

const sanitizeRuntimeSqlLogLimit = (value: unknown): number =>
  sanitizeBoundedInt(
    value,
    30,
    120,
    DEFAULT_MEMORY_SETTINGS.advanced.runtimeSqlLogLimit,
  );

const sanitizeAiMessageMemoryLimit = (value: unknown): number =>
  sanitizeBoundedInt(
    value,
    20,
    200,
    DEFAULT_MEMORY_SETTINGS.advanced.aiMessageMemoryLimit,
  );

const sanitizeSidebarIdleReleaseMinutes = (value: unknown): number => {
  const fallback = DEFAULT_MEMORY_SETTINGS.advanced.sidebarIdleReleaseMinutes;
  const raw = Number(value);
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  if (raw <= 0) {
    return 0;
  }
  const allowed = [15, 30, 60];
  if (allowed.includes(raw)) {
    return raw;
  }
  return fallback;
};

const sanitizeGoGCPercent = (value: unknown): number =>
  sanitizeBoundedInt(
    value,
    40,
    100,
    DEFAULT_MEMORY_SETTINGS.advanced.goGCPercent,
  );

const sanitizeQueryMaxRowsStash = (value: unknown): QueryMaxRowsState | null => {
  if (value == null || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (!("maxRows" in raw)) {
    return null;
  }
  return migrateQueryMaxRows(raw);
};

const readLowMemoryEnvValue = (): string => {
  const importMetaEnv = import.meta.env as Record<string, string | undefined>;
  if (importMetaEnv.GONAVI_LOW_MEMORY_MODE) {
    return String(importMetaEnv.GONAVI_LOW_MEMORY_MODE);
  }
  const runtimeProcess = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return String(runtimeProcess?.env?.GONAVI_LOW_MEMORY_MODE ?? "");
};

export const effectiveLowMemoryModeFromEnv = (): boolean => {
  const raw = readLowMemoryEnvValue().trim().toLowerCase();
  return raw ? LOW_MEMORY_ENV_VALUES.has(raw) : false;
};

export const sanitizeMemorySettings = (value: unknown): MemorySettings => {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_MEMORY_SETTINGS };
  }
  const raw = value as Record<string, unknown>;
  const advancedRaw = raw.advanced && typeof raw.advanced === "object"
    ? (raw.advanced as Record<string, unknown>)
    : {};

  return {
    lowMemoryMode: raw.lowMemoryMode === true,
    aiAssistantEnabled: typeof raw.aiAssistantEnabled === "boolean"
      ? raw.aiAssistantEnabled
      : true,
    advanced: {
      destroyInactiveTabs: advancedRaw.destroyInactiveTabs !== false,
      sidebarDbCacheLimit: sanitizeSidebarDbCacheLimit(advancedRaw.sidebarDbCacheLimit),
      runtimeSqlLogLimit: sanitizeRuntimeSqlLogLimit(advancedRaw.runtimeSqlLogLimit),
      aiMessageMemoryLimit: sanitizeAiMessageMemoryLimit(advancedRaw.aiMessageMemoryLimit),
      sidebarIdleReleaseMinutes: sanitizeSidebarIdleReleaseMinutes(
        advancedRaw.sidebarIdleReleaseMinutes,
      ),
      goGCPercent: sanitizeGoGCPercent(advancedRaw.goGCPercent),
    },
    queryMaxRowsStash: sanitizeQueryMaxRowsStash(raw.queryMaxRowsStash),
  };
};

export const resolveMemoryPolicy = (
  memory: MemorySettings,
  appearance: Partial<MemoryPolicyAppearance>,
): MemoryPolicy => {
  const sanitized = sanitizeMemorySettings(memory);
  const envForced = effectiveLowMemoryModeFromEnv();
  return {
    effectiveLowMemoryMode: envForced || sanitized.lowMemoryMode,
    envForced,
    memorySettings: sanitized,
    appearance: {
      enabled: appearance.enabled !== false,
      opacity: typeof appearance.opacity === "number" ? appearance.opacity : 1,
      blur: typeof appearance.blur === "number" ? appearance.blur : 0,
    },
  };
};

export const shouldDestroyInactiveTabs = (policy: MemoryPolicy): boolean => {
  if (!policy.effectiveLowMemoryMode) {
    return false;
  }
  return policy.memorySettings.advanced.destroyInactiveTabs;
};

export const resolveSidebarDbCacheLimit = (policy: MemoryPolicy): number => {
  if (!policy.effectiveLowMemoryMode) {
    return NORMAL_SIDEBAR_DB_CACHE_LIMIT;
  }
  return policy.memorySettings.advanced.sidebarDbCacheLimit;
};

export const resolveRuntimeSqlLogLimit = (policy: MemoryPolicy): number => {
  if (!policy.effectiveLowMemoryMode) {
    return NORMAL_RUNTIME_SQL_LOG_LIMIT;
  }
  return policy.memorySettings.advanced.runtimeSqlLogLimit;
};

export const resolveAiMessageMemoryLimit = (policy: MemoryPolicy): number | null => {
  if (!policy.effectiveLowMemoryMode) {
    return null;
  }
  return policy.memorySettings.advanced.aiMessageMemoryLimit;
};

export const shouldLazyLoadHeavyModules = (policy: MemoryPolicy): boolean => {
  return policy.effectiveLowMemoryMode;
};

export const shouldLoadAIAssistant = (policy: MemoryPolicy): boolean => {
  return policy.memorySettings.aiAssistantEnabled;
};

export const resolveGoGCPercent = (policy: MemoryPolicy): number => {
  if (!policy.effectiveLowMemoryMode) {
    return NORMAL_GO_GC_PERCENT;
  }
  return policy.memorySettings.advanced.goGCPercent;
};

export const buildMemoryPolicyPayload = (policy: MemoryPolicy) => ({
  lowMemoryMode: policy.effectiveLowMemoryMode,
  goGCPercent: resolveGoGCPercent(policy),
});

/** Appearance used for rendering / OS translucency while low-memory mode is active. */
export const resolveEffectiveAppearanceValues = (
  memorySettings: MemorySettings,
  appearance: AppearanceSettingsLike | undefined,
): { opacity: number; blur: number } => {
  const policy = resolveMemoryPolicy(memorySettings, {
    enabled: appearance?.enabled,
    opacity: appearance?.opacity,
    blur: appearance?.blur,
  });
  if (policy.effectiveLowMemoryMode) {
    return { opacity: 1, blur: 0 };
  }
  return resolveAppearanceValues(appearance);
};
