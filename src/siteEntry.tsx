import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { principleRoute, productFeature, siteLanguage } from "./productSite";
import { loadFeature, loadPrinciple } from "./sitePages";

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
