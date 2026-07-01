import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import type { SupportedLanguage } from "./types";

export function getAntdLocale(language: SupportedLanguage) {
  switch (language) {
    case "zh-CN":
      return zhCN;
    default:
      return enUS;
  }
}
