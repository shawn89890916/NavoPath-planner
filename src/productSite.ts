import type { Language } from "./types";

export type ProductFeature = "planning" | "execute" | "ai";
export const PRODUCT_FEATURES: ProductFeature[] = ["planning", "execute", "ai"];
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
