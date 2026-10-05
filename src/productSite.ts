import type { Language } from "./types";

export type ProductFeature = "planning" | "execute" | "ai";
export const PRODUCT_FEATURES: ProductFeature[] = ["execute", "planning", "ai"];
export const PRINCIPLES = ["jev", "feedback", "time", "control", "views", "records"] as const;
export type Principle = typeof PRINCIPLES[number];
export const principleNames = {
  zh: { jev: "JEV 的小判断", feedback: "置信度与个人记录", time: "时间安排规则", control: "预览与撤回", views: "同一任务，多种视角", records: "任务与时间记录" },
  en: { jev: "Small decisions with JEV", feedback: "Confidence and personal records", time: "Scheduling rules", control: "Previews and undo", views: "One task, several views", records: "Tasks and time records" },
};
export function principleRoute(path: string): Principle | "index" | null {
  const value = path.replace(/\/$/, "").split("/");
  if (value.length === 2 && value[1] === "principles") return "index";
  return value.length === 3 && value[1] === "principles" && PRINCIPLES.includes(value[2] as Principle) ? value[2] as Principle : null;
}
export function principleHref(topic: Principle | "index", lang: Language) {
  return `/principles${topic === "index" ? "" : `/${topic}`}?lang=${lang}`;
}
export type PrincipleCopy = { title: string; description: string; steps: [string, string][]; sections: [string, string][]; sources: [string, string][] };
export function productFeature(
  path: string,
  prefix: "features" | "product-demo",
): ProductFeature | null {
  const value = path.replace(/\/$/, "").split("/");
  return value.length === 3 &&
    value[1] === prefix &&
    PRODUCT_FEATURES.includes(value[2] as ProductFeature)
    ? (value[2] as ProductFeature)
    : null;
}
export function siteLanguage(search: string, browserLanguage = "en"): Language {
  const requested = new URLSearchParams(search).get("lang");
  return requested === "zh" || requested === "en"
    ? requested
    : browserLanguage.toLowerCase().startsWith("zh")
      ? "zh"
      : "en";
}
export function featureHref(feature: ProductFeature, lang: Language) {
  return `/features/${feature}?lang=${lang}`;
}
export const featureNames = {
  zh: { planning: "规划", execute: "执行", ai: "Navo AI" },
  en: { planning: "Planning", execute: "Execute", ai: "Navo AI" },
};
export type DemoCommand = {
  channel: "navopath-product-demo";
  type: "stage" | "reset" | "visibility";
  stage: number;
  lang: Language;
  visible?: boolean;
};
export type DemoEvent = {
  channel: "navopath-product-demo";
  type: "ready" | "interacting" | "error";
};
export function isDemoCommand(value: unknown): value is DemoCommand {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<DemoCommand>;
  return (
    v.channel === "navopath-product-demo" &&
    ["stage", "reset", "visibility"].includes(v.type || "") &&
    Number.isInteger(v.stage) &&
    Number(v.stage) >= 0 &&
    Number(v.stage) <= 3 &&
    (v.lang === "en" || v.lang === "zh") &&
    (v.type !== "visibility" || typeof v.visible === "boolean")
  );
}

export type FeatureCopy = { title: string; description: string; benefits: [string, string][]; faq: [string, string][]; next: ProductFeature };
