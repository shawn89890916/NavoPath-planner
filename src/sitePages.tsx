import { principleRoute, productFeature, sitePath, type ProductFeature, type ProductPageEmbed } from "./productSite";

const featureContent = {
  workspace: () => import("./features/workspace"),
  plugins: () => import("./features/plugins"),
  ai: () => import("./features/ai"),
};
export async function loadFeature(feature: ProductFeature) {
  const [page, content] = await Promise.all([import("./ProductFeaturePage"), featureContent[feature]()]);
  return { default: ({ embedded }: { embedded?: ProductPageEmbed }) => <page.default feature={feature} copy={content.default} embedded={embedded} /> };
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
  return { default: ({ embedded }: { embedded?: ProductPageEmbed }) => <page.default topic={topic === "index" ? undefined : topic} copy={content?.default} embedded={embedded} /> };
}

// Warm only the chosen reading page. Importing it does not mount a demo or App.
export function preloadSitePage(href: string) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin) return;
  const path = sitePath(url.pathname);
  const feature = productFeature(path), topic = principleRoute(path);
  void (feature ? loadFeature(feature) : topic ? loadPrinciple(topic) : Promise.resolve()).catch(() => undefined);
}
