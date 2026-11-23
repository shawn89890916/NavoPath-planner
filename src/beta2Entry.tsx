import { createRoot } from "react-dom/client";
import BetaStory from "./BetaStory";
import { siteLanguage } from "./productSite";

const lang = siteLanguage(location.search, navigator.language);
document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
if (lang === "en") {
  document.title = "NavoPath · A product tour on one page";
  document.querySelector('meta[name="description"]')?.setAttribute("content", "Explore the NavoPath workspace, plugins, AI, and MCP in one continuous tour.");
}

createRoot(document.getElementById("root")!).render(<BetaStory lang={lang} />);
