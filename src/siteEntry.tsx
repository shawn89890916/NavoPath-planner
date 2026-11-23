import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { isBetaSite, legacyFeatureRoute, principleRoute, productDemoRoute, productFeature, siteHref, siteLanguage, sitePath } from "./productSite";
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
        <p>{zh ? "页面未能正常加载。" : "Page could not load."}</p>
        <button type="button" onClick={() => location.reload()}>
          {zh ? "重新加载" : "Reload"}
        </button>
      </div>
    );
  }
}

const path = sitePath(window.location.pathname);
const feature = productFeature(path);
const demo = productDemoRoute(path);
const principles = principleRoute(path);
const privacy = /^\/privacy\/?$/.test(path);
if (legacyFeatureRoute(path)) {
  location.replace(siteHref(`/features/workspace${location.search}${location.hash}`));
} else if (demo) {
  void import("./productDemoRuntime").then(({ installProductDemo }) => {
    installProductDemo(demo);
    return import("./main");
  }).catch(() => {
    if (parent !== window) parent.postMessage({ channel: "navopath-product-demo", type: "error" }, location.origin);
    document.getElementById("root")!.textContent = "NavoPath…";
  });
} else if (isBetaSite && path === "/") {
  const BetaLandingPage = lazy(() => import("./BetaLandingPage"));
  createRoot(document.getElementById("root")!).render(
    <SiteErrorBoundary demo={false}>
      <Suspense fallback={null}><BetaLandingPage /></Suspense>
    </SiteErrorBoundary>,
  );
} else if (feature || principles || privacy) {
  const Page = lazy(privacy ? () => import("./PrivacyPage") : feature ? () => loadFeature(feature) : () => loadPrinciple(principles!));
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
