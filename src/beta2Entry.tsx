import { createRoot } from "react-dom/client";
import { productDemoRoute, siteLanguage, sitePath } from "./productSite";

const lang = siteLanguage(location.search, navigator.language);
const route = productDemoRoute(sitePath(location.pathname));
const root = document.getElementById("root")!;
document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

function failed() {
  root.textContent = lang === "zh" ? "页面未能加载。" : "The page could not load.";
  if (parent !== window) parent.postMessage({ channel: "navopath-product-demo", type: "error" }, location.origin);
}

if (route === "execute" || route === "ai") {
  void Promise.all([import("./productDemoRuntime"), import("./productDemoStory")])
    .then(([{ installProductDemo }, { createProductDemoStory }]) => {
      installProductDemo(route, createProductDemoStory);
      return import("./main");
    })
    .catch(failed);
} else {
  if (lang === "en") {
    document.title = "NavoPath · A product tour on one page";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "Explore the NavoPath workspace, plugins, AI, and MCP in one continuous tour.");
  }
  void import("./BetaStory").then(({ default: BetaStory }) => {
    createRoot(root).render(<BetaStory lang={lang} />);
  }).catch(failed);
}
