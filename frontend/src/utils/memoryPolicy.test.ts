import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MEMORY_SETTINGS,
  buildMemoryPolicyPayload,
  effectiveLowMemoryModeFromEnv,
  resolveAiMessageMemoryLimit,
  resolveEffectiveAppearanceValues,
  resolveMemoryPolicy,
  resolveRuntimeSqlLogLimit,
  resolveSidebarDbCacheLimit,
  sanitizeMemorySettings,
  shouldDestroyInactiveTabs,
  shouldLazyLoadHeavyModules,
  shouldLoadAIAssistant,
} from "./memoryPolicy";

const DEFAULT_APPEARANCE_FOR_POLICY = {
  enabled: true,
  opacity: 1,
  blur: 0,
};

describe("memoryPolicy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults aiAssistantEnabled to false", () => {
    expect(DEFAULT_MEMORY_SETTINGS.aiAssistantEnabled).toBe(false);
  });

  it("uses normal limits when low memory is off", () => {
    const policy = resolveMemoryPolicy(DEFAULT_MEMORY_SETTINGS, DEFAULT_APPEARANCE_FOR_POLICY);
    expect(resolveSidebarDbCacheLimit(policy)).toBe(12);
    expect(resolveRuntimeSqlLogLimit(policy)).toBe(120);
    expect(shouldDestroyInactiveTabs(policy)).toBe(false);
    expect(resolveAiMessageMemoryLimit(policy)).toBeNull();
    expect(shouldLazyLoadHeavyModules(policy)).toBe(false);
    expect(shouldLoadAIAssistant(policy)).toBe(false);
    expect(buildMemoryPolicyPayload(policy)).toEqual({
      lowMemoryMode: false,
      goGCPercent: 50,
    });
  });

  it("uses advanced limits when low memory is on", () => {
    const settings = {
      ...DEFAULT_MEMORY_SETTINGS,
      lowMemoryMode: true,
    };
    const policy = resolveMemoryPolicy(settings, DEFAULT_APPEARANCE_FOR_POLICY);
    expect(resolveSidebarDbCacheLimit(policy)).toBe(6);
    expect(resolveRuntimeSqlLogLimit(policy)).toBe(60);
    expect(shouldDestroyInactiveTabs(policy)).toBe(true);
    expect(resolveAiMessageMemoryLimit(policy)).toBe(50);
    expect(shouldLazyLoadHeavyModules(policy)).toBe(true);
    expect(buildMemoryPolicyPayload(policy)).toEqual({
      lowMemoryMode: true,
      goGCPercent: 40,
    });
  });

  it("respects env override over store settings", () => {
    vi.stubEnv("GONAVI_LOW_MEMORY_MODE", "1");
    expect(effectiveLowMemoryModeFromEnv()).toBe(true);
    const policy = resolveMemoryPolicy(DEFAULT_MEMORY_SETTINGS, DEFAULT_APPEARANCE_FOR_POLICY);
    expect(policy.effectiveLowMemoryMode).toBe(true);
    expect(policy.envForced).toBe(true);
    expect(shouldDestroyInactiveTabs(policy)).toBe(true);
  });

  it("sanitizeMemorySettings clamps advanced values", () => {
    expect(sanitizeMemorySettings(undefined)).toEqual(DEFAULT_MEMORY_SETTINGS);
    expect(sanitizeMemorySettings({
      lowMemoryMode: true,
      advanced: {
        destroyInactiveTabs: false,
        sidebarDbCacheLimit: 99,
        runtimeSqlLogLimit: 10,
        aiMessageMemoryLimit: 5,
        sidebarIdleReleaseMinutes: 45,
        goGCPercent: 200,
      },
    })).toEqual({
      lowMemoryMode: true,
      aiAssistantEnabled: true,
      advanced: {
        destroyInactiveTabs: false,
        sidebarDbCacheLimit: 24,
        runtimeSqlLogLimit: 30,
        aiMessageMemoryLimit: 20,
        sidebarIdleReleaseMinutes: 30,
        goGCPercent: 100,
      },
      queryMaxRowsStash: null,
    });
  });

  it("shouldLoadAIAssistant follows aiAssistantEnabled setting", () => {
    const disabledPolicy = resolveMemoryPolicy(DEFAULT_MEMORY_SETTINGS, DEFAULT_APPEARANCE_FOR_POLICY);
    expect(shouldLoadAIAssistant(disabledPolicy)).toBe(false);

    const enabledPolicy = resolveMemoryPolicy(
      { ...DEFAULT_MEMORY_SETTINGS, aiAssistantEnabled: true },
      DEFAULT_APPEARANCE_FOR_POLICY,
    );
    expect(shouldLoadAIAssistant(enabledPolicy)).toBe(true);
  });

  it("sanitizes queryMaxRowsStash and ignores incomplete stash objects", () => {
    expect(sanitizeMemorySettings({
      lowMemoryMode: true,
      queryMaxRowsStash: { maxRows: 5000, maxRowsCustomPresets: [5000] },
    }).queryMaxRowsStash).toEqual({
      maxRows: 5000,
      maxRowsCustomPresets: [5000],
    });
    expect(sanitizeMemorySettings({
      lowMemoryMode: true,
      queryMaxRowsStash: { maxRowsCustomPresets: [5000] },
    }).queryMaxRowsStash).toBeNull();
  });

  it("forces opaque appearance values while low memory is effective", () => {
    expect(resolveEffectiveAppearanceValues(
      { ...DEFAULT_MEMORY_SETTINGS, lowMemoryMode: true },
      { enabled: true, opacity: 0.72, blur: 12 },
    )).toEqual({ opacity: 1, blur: 0 });
    expect(resolveEffectiveAppearanceValues(
      DEFAULT_MEMORY_SETTINGS,
      { enabled: true, opacity: 0.72, blur: 12 },
    )).toEqual({ opacity: 0.72, blur: 12 });
  });
});
