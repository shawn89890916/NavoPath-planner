import type { FeatureCopy } from "../productSite";
import type { Language } from "../types";

export default {
  zh: {
    title: "从项目计划到今天的时间轴。",
    description: "在一体化工作区里拆解项目、挑选今天要推进的事，再给任务留出实际可用的时间。",
    benefits: [
      ["拆解项目", "在项目树展开「推进个人网站」，找到「撰写个人介绍」。"],
      ["选为今日候选", "把任务加入今日候选，再切到执行视图确认它已出现在列表中。"],
      ["排入时间轴", "将同一项任务拖到空闲时段，按需要调整时长。"],
    ],
    faq: [
      ["规划和执行会创建两份任务吗？", "两处使用同一项任务。排程为它添加一条执行记录。"],
      ["浏览器里试玩会修改我的工作区吗？", "横屏试玩使用独立的示例数据，刷新页面即可恢复。"],
    ],
    next: "plugins",
  },
  en: {
    title: "From a project plan to today’s timeline.",
    description: "Break down a project, choose what to advance today, and make room for it in the same workspace.",
    benefits: [
      ["Break down a project", "Open Build a personal website in the project tree and find Write your introduction."],
      ["Choose it for today", "Add the task to Today’s Candidates, then switch to Execute to find it in the list."],
      ["Make time for it", "Drag the same task to an open slot on the timeline and adjust its duration as needed."],
    ],
    faq: [
      ["Do Planning and Execute create separate tasks?", "Both views use the same task. Scheduling adds an execution record to it."],
      ["Will the demo change my workspace?", "The landscape demo uses its own sample data. Refresh the page to reset it."],
    ],
    next: "plugins",
  },
} satisfies Record<Language, FeatureCopy>;
