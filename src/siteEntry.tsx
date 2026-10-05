import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { principleRoute, productFeature, siteLanguage, type ProductFeature } from "./productSite";

class SiteErrorBoundary extends React.Component<
  { children: React.ReactNode; demo: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    if (this.props.demo && parent !== window)
      parent.postMessage(
        { channel: "navopath-product-demo", type: "error" },
        location.origin,
      );
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const zh = siteLanguage(location.search, navigator.language) === "zh";
    return (
      <div
        role="alert"
        style={{
          padding: 32,
          color: "#27231e",
          background: "#f4f7f9",
          minHeight: "100vh",
        }}
      >
        <p>{zh ? "页面暂时未能加载。" : "This page could not load."}</p>
        <button type="button" onClick={() => location.reload()}>
          {zh ? "重新加载" : "Try again"}
        </button>
      </div>
    );
  }
}

const featureContent = {
  planning: () => import("./features/planning"),
  execute: () => import("./features/execute"),
  ai: () => import("./features/ai"),
};
async function loadFeature(feature: ProductFeature) {
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
async function loadPrinciple(topic: NonNullable<ReturnType<typeof principleRoute>>) {
  const page = await import("./ProductPrinciplesPage");
  if (topic === "index") return { default: () => <page.default /> };
  const content = await principleContent[topic]();
  return { default: () => <page.default topic={topic} copy={content.default} /> };
}
const feature = productFeature(window.location.pathname, "features");
const demo = productFeature(window.location.pathname, "product-demo");
const principles = principleRoute(window.location.pathname);
if (demo) {
  void import("./productDemoRuntime").then(({ installProductDemo }) => {
    installProductDemo(demo);
    return import("./main");
  }).catch(() => {
    if (parent !== window) parent.postMessage({ channel: "navopath-product-demo", type: "error" }, location.origin);
    document.getElementById("root")!.textContent = "NavoPath…";
  });
} else if (feature || principles) {
  const Page = lazy(feature ? () => loadFeature(feature) : () => loadPrinciple(principles!));
  createRoot(document.getElementById("root")!).render(
    <SiteErrorBoundary demo={Boolean(demo)}>
      <Suspense
        fallback={
          <div
            role="status"
            style={{ padding: 32, background: "#f4f7f9", color: "#27231e" }}
          >
            NavoPath…
          </div>
        }
      >
        <Page />
      </Suspense>
    </SiteErrorBoundary>,
  );
} else {
  void import("./main");
}
