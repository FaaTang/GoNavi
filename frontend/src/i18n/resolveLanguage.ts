import type { LanguagePreference, SupportedLanguage } from "./types";

export const DEFAULT_LANGUAGE: SupportedLanguage = "en-US";
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  "zh-CN",
  "en-US",
];
export const LANGUAGE_PREFERENCES: LanguagePreference[] = [
  "system",
  ...SUPPORTED_LANGUAGES,
];

export function normalizeLanguage(value: unknown): SupportedLanguage | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/_/g, "-").toLowerCase();
  if (!normalized) return null;
  if (
    normalized === "zh"
    || normalized === "zh-cn"
    || normalized === "zh-sg"
    || normalized === "zh-tw"
    || normalized === "zh-hk"
    || normalized === "zh-mo"
  ) {
    return "zh-CN";
  }
  if (normalized === "en-us" || normalized.startsWith("en-")) return "en-US";
  if (normalized === "ja" || normalized.startsWith("ja-")) return "en-US";
  if (normalized === "de" || normalized.startsWith("de-")) return "en-US";
  if (normalized === "ru" || normalized.startsWith("ru-")) return "en-US";
  return null;
}

export function resolveLanguage(
  preference: LanguagePreference | string | undefined,
  systemLanguages: readonly string[] = [],
): SupportedLanguage {
  const explicit = normalizeLanguage(preference);
  if (explicit) return explicit;

  for (const systemLanguage of systemLanguages) {
    const resolved = normalizeLanguage(systemLanguage);
    if (resolved) return resolved;
  }

  return DEFAULT_LANGUAGE;
}
