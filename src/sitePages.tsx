import { principleRoute, productFeature, type ProductFeature } from "./productSite";

const featureContent = {
  planning: () => import("./features/planning"),
  execute: () => import("./features/execute"),
  ai: () => import("./features/ai"),
};
export async function loadFeature(feature: ProductFeature) {
  const [page, content] = await Promise.all([import("./ProductFeaturePage"), featureContent[feature]()]);
  return { default: () => <page.default feature={feature} copy={content.default} /> };
}
const principleContent = {
  jev: () => import("./principles/jev"),
  feedback: () => import("./principles/feedback"),
  time: () => import("./principles/time"),
  control: () => import("./principles/control"),
  views: () => import("./principles/views"),
  records: () => import("./principles/records"),
};
export async function loadPrinciple(topic: NonNullable<ReturnType<typeof principleRoute>>) {
  const [page, content] = await Promise.all([import("./ProductPrinciplesPage"), topic === "index" ? Promise.resolve(null) : principleContent[topic]()]);
  return { default: () => <page.default topic={topic === "index" ? undefined : topic} copy={content?.default} /> };
}

// Warm only the chosen reading page. Importing it does not mount a demo or App.
export function preloadSitePage(href: string) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin) return;
  const feature = productFeature(url.pathname, "features"), topic = principleRoute(url.pathname);
  void (feature ? loadFeature(feature) : topic ? loadPrinciple(topic) : Promise.resolve()).catch(() => undefined);
}
