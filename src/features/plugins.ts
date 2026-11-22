import type { FeatureCopy } from "../productSite";
import type { Language } from "../types";

export default {
  zh: {
    title: "为工作区添加需要的能力。",
    description: "在 NavoPath 打开「设置 → 插件 → 浏览市场」，查找并安装适合你的插件。",
    benefits: [
      ["浏览市场", "按名称搜索，打开插件详情查看来源、支持平台和最低应用版本。"],
      ["选择规划视图", "树和指标是预装视图。需要时可以从市场安装看板、矩阵或列表。"],
      ["管理已安装插件", "在设置的插件页管理已安装项目、检查更新，或配置插件提供的选项。"],
    ],
    faq: [
      ["可以在介绍页安装插件吗？", "打开 NavoPath，在设置的插件市场中安装。"],
      ["在哪里查看插件支持的平台？", "市场中的插件详情会列出支持的平台和最低应用版本。"],
    ],
    next: "ai",
  },
  en: {
    title: "Add the tools your workspace needs.",
    description: "In NavoPath, open Settings → Plugins → Browse market to find and install plugins.",
    benefits: [
      ["Browse the market", "Search by name and open a plugin’s details to check its source, supported platforms, and required app version."],
      ["Choose your Planning views", "Tree and Metrics are preinstalled. Add Board, Matrix, or List from the market when you need them."],
      ["Manage installed plugins", "Use the Plugins settings to manage installations, check for updates, and change options where available."],
    ],
    faq: [
      ["Where do I install plugins?", "Open NavoPath and use the plugin market in Settings."],
      ["Where can I check platform compatibility?", "The plugin’s market details list supported platforms and the required app version."],
    ],
    next: "ai",
  },
} satisfies Record<Language, FeatureCopy>;
