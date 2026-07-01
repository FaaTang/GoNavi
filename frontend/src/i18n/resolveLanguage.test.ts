import { describe, expect, it } from "vitest";

import { normalizeLanguage, resolveLanguage } from "./resolveLanguage";

describe("resolveLanguage", () => {
  it("uses explicit language preference before system languages", () => {
    expect(resolveLanguage("zh-CN", ["en-US"])).toBe("zh-CN");
    expect(resolveLanguage("zh-TW", ["en-US"])).toBe("zh-CN");
    expect(resolveLanguage("en-US", ["zh-CN"])).toBe("en-US");
    expect(resolveLanguage("ja-JP", ["en-US"])).toBe("en-US");
    expect(resolveLanguage("de-DE", ["en-US"])).toBe("en-US");
    expect(resolveLanguage("ru-RU", ["en-US"])).toBe("en-US");
  });

  it("maps supported language families from system languages", () => {
    expect(resolveLanguage("system", ["zh-SG"])).toBe("zh-CN");
    expect(resolveLanguage("system", ["zh-HK"])).toBe("zh-CN");
    expect(resolveLanguage("system", ["en-IN"])).toBe("en-US");
    expect(resolveLanguage("system", ["ja"])).toBe("en-US");
    expect(resolveLanguage("system", ["de"])).toBe("en-US");
    expect(resolveLanguage("system", ["ru"])).toBe("en-US");
  });

  it("falls back to English for unsupported or empty values", () => {
    expect(normalizeLanguage("fr-FR")).toBeNull();
    expect(resolveLanguage("system", ["fr-FR"])).toBe("en-US");
    expect(resolveLanguage(undefined, [])).toBe("en-US");
  });
});
