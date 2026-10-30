import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "换重视角浏览，依然是同一份数据。", description: "树状图、列表、看板与矩阵视图，完全共享底层项目与任务数据。",
    steps: [["数据本体", "统一维护的项目、任务与子任务集合"], ["组织棱镜", "层级结构、流程进度或优先级矩阵"], ["呈现结果", "满足不同思考阶段的查阅需要"]],
    sections: [
      ["同一数据源，多元化组织形态", "规划工作区接收统一的任务流，树视图呈现父子归属，列表便于搜索，看板掌控流程，矩阵辅助权衡决策。"],
      ["视图切换不产生任何冗余副本", "切换视图仅改变屏幕上的布局与筛选规则，绝不会在底层复制任务。在任意视图中的编辑均实时反映至全局。"],
      ["针对当前决策选择最适视图", "拆解复杂目标时使用树；梳理今日进度时使用看板；感到事情纷繁时使用矩阵排查优先级。各取所长。"],
    ],
    sources: [["规划视图渲染与交互逻辑", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/PlanningView.tsx"], ["任务与项目全局数据结构模型", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/types.ts"]],
  },
  en: {
    title: "Different perspectives. The same core dataset.", description: "Tree, List, Kanban, and Matrix views share a single source of truth.",
    steps: [["Core Data", "Unified projects, tasks, and subtasks structure"], ["Perspective", "Hierarchy, workflow stage, or priority quadrants"], ["Outcome", "Inspect the same work through the right analytical lens"]],
    sections: [
      ["One dataset, multiple organizational forms", "The workspace feeds identical task items into specialized views: Tree maps parentage, List optimizes search, Kanban tracks flow, and Matrix balances urgency."],
      ["Switching views creates zero data duplication", "Changing views reorganizes layout and grouping without duplicating records. Modifications anywhere update everywhere instantly."],
      ["Select the optimal lens for current decision", "Use Tree to break down ambitious goals, Kanban to balance active workflow, and Matrix to cut through conflicting priorities."],
    ],
    sources: [["Planning view renderers and interaction logic", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/PlanningView.tsx"], ["Task and project unified data models", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/types.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
