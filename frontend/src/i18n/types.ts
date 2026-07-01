export type SupportedLanguage = "zh-CN" | "en-US";
export type LanguagePreference = "system" | SupportedLanguage;
export type I18nParams = Record<string, string | number | boolean | null | undefined>;
