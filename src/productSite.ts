import type { Language } from "./types";
import type { RefObject } from "react";

export type ProductPageEmbed = {
  lang: Language;
  scroller: RefObject<HTMLDivElement | null>;
  close: () => void;
};

export const isBetaSite = import.meta.env.BASE_URL === "/beta/";
const sitePrefix = isBetaSite ? "/beta" : "";

export function siteHref(path: string) {
  return sitePrefix + path;
}

export function sitePath(path: string) {
  return sitePrefix && (path === sitePrefix || path.startsWith(sitePrefix + "/"))
    ? path.slice(sitePrefix.length) || "/"
    : path;
}

export const PRODUCT_FEATURES = ["workspace", "plugins", "ai"] as const;
export type ProductFeature = typeof PRODUCT_FEATURES[number];
const PRODUCT_DEMOS = ["workspace", "ai", "planning", "execute"] as const;
export type ProductDemo = typeof PRODUCT_DEMOS[number];
export const PERSONAL_SITE_URL = "https://xiaoyang-chen-now.shawn89890916.chatgpt.site/";
export const PRINCIPLES = ["jev", "feedback", "time", "control", "views", "records"] as const;
export type Principle = typeof PRINCIPLES[number];
export const principleNames = {
  zh: { jev: "JEV 估时机制", feedback: "置信度与个人数据", time: "时间网格与排程规则", control: "预览确认与撤回", views: "同一份数据，多种视角", records: "任务本体与执行记录" },
  en: { jev: "JEV Time Estimation", feedback: "Confidence & Personal Records", time: "Scheduling Rules", control: "Preview & Undo", views: "One Task, Multiple Views", records: "Tasks & Execution Records" },
};
export function principleRoute(path: string): Principle | "index" | null {
  const value = path.replace(/\/$/, "").split("/");
  if (value.length === 2 && value[1] === "principles") return "index";
  return value.length === 3 && value[1] === "principles" && PRINCIPLES.includes(value[2] as Principle) ? value[2] as Principle : null;
}
export function principleHref(topic: Principle | "index", lang: Language) {
  return siteHref(`/principles${topic === "index" ? "" : `/${topic}`}?lang=${lang}`);
}
export type PrincipleCopy = { title: string; description: string; steps: [string, string][]; sections: [string, string][]; sources: [string, string][] };
function routeEntry<T extends string>(path: string, prefix: string, entries: readonly T[]) {
  const value = path.replace(/\/$/, "").split("/");
  return value.length === 3 && value[1] === prefix
    ? entries.find(entry => entry === value[2]) ?? null
    : null;
}
export function productFeature(path: string) {
  return routeEntry(path, "features", PRODUCT_FEATURES);
}
export function productDemoRoute(path: string) {
  return routeEntry(path, "product-demo", PRODUCT_DEMOS);
}
export function legacyFeatureRoute(path: string) {
  return /^\/features\/(execute|planning)\/?$/.test(path);
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
  return siteHref(`/features/${feature}?lang=${lang}`);
}
export const featureNames = {
  zh: { workspace: "一体化工作区", plugins: "插件市场", ai: "Navo AI" },
  en: { workspace: "Workspace", plugins: "Plugin Market", ai: "Navo AI" },
};
export type DemoVisibility = {
  channel: "navopath-product-demo";
  type: "visibility";
  visible: boolean;
};

export function isDemoVisibility(value: unknown): value is DemoVisibility {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<DemoVisibility>;
  return message.channel === "navopath-product-demo" && message.type === "visibility" && typeof message.visible === "boolean";
}

export type FeatureCopy = { title: string; description: string; benefits: [string, string][]; faq: [string, string][]; next: ProductFeature };
