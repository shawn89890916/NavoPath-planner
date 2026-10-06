import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "换一个视角，仍是同一份任务。", description: "树、列表、看板与矩阵，共用项目和任务数据。",
    steps: [["数据", "项目、任务与子任务"], ["视角", "层级、状态或重要与紧急"], ["结果", "从不同角度查看同一任务"]],
    sections: [
      ["一份数据，多种组织方式", "规划页接收同一份项目和任务数据，再按视图整理。树状图呈现层级，列表方便逐项查看，看板按流程状态分组，矩阵按重要性和紧急程度定位。"],
      ["视图不复制任务", "切换视图会改变布局和分组，不会额外创建一套任务。你查看的是同一项任务的标题、状态、所属项目和其他属性。"],
      ["选择适合当前问题的视角", "拆解目标时用树；梳理进展时用看板；判断先做什么时用矩阵。视图负责帮助阅读，任务本身仍能继续进入今日候选与执行流程。"],
    ],
    sources: [["规划视图实现", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/PlanningView.tsx"], ["任务与项目数据结构", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/types.ts"]],
  },
  en: {
    title: "Different views. The same tasks.", description: "Tree, list, Kanban and matrix share project and task data.",
    steps: [["Data", "Projects, tasks and subtasks"], ["Lens", "Hierarchy, workflow or priority"], ["Result", "Another way to read the same task"]],
    sections: [
      ["Organize one dataset in several ways", "Planning receives the same projects and tasks, then organizes them by view. The tree shows hierarchy, the list supports reviewing items, Kanban groups workflow states, and the matrix uses importance and urgency."],
      ["A view does not copy a task", "Switching views changes layout and grouping without creating a second task set. You are reading the same task’s title, state, project and other properties."],
      ["Choose a lens for the question", "Use the tree to break down a goal, Kanban to review progress, and the matrix to consider priorities. Views help you read the work; tasks can still move into Today’s Candidates and execution."],
    ],
    sources: [["Planning view implementation", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/PlanningView.tsx"], ["Task and project types", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/types.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
