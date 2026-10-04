import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "把目标，变成能推进的任务。",
    "description": "把工作、学习和生活目标整理成项目，用适合自己的视图看清进度，再选出今天值得推进的任务。",
    "benefits": [
      [
        "项目，一目了然。",
        "把同一目标下的任务放在一起。展开项目，就能看清还有哪些事待推进、哪些已经完成。"
      ],
      [
        "同一份任务，四种视角。",
        "树视图看结构，列表便于逐项查看；看板跟进状态，矩阵帮助判断优先顺序。"
      ],
      [
        "选出今天的下一步。",
        "把准备推进的任务加入今日候选，再到执行页安排时间。项目中的其他任务仍留在原处。"
      ]
    ],
    "faq": [
      [
        "应该选择哪种视图？",
        "树适合拆解目标；列表适合逐项查看；看板适合观察推进状态；矩阵帮助比较任务的重要与紧急程度。切换视图会保留同一份数据。"
      ],
      [
        "任务与子任务有什么区别？",
        "任务承载一项具体工作，子任务继续拆出内部步骤。需要独立安排时，可以把子任务加入今日候选。"
      ],
      [
        "如何加入今日候选？",
        "在任务右侧点击加入今日候选的操作，再进入执行页，为选出的任务安排具体时间。再次操作可移出候选。"
      ]
    ],
    "next": "execute"
  },
  "en": {
    "title": "Make your next step clear.",
    "description": "Organize work, learning, and life into projects. See progress in the view that suits you, then choose what to move forward today.",
    "benefits": [
      [
        "See the whole project.",
        "Keep tasks for the same goal together. Expand a project to see what is still ahead and what is already complete."
      ],
      [
        "One set of tasks, four views.",
        "See structure in Tree, scan tasks in List, follow progress in Kanban, or compare priorities in Matrix."
      ],
      [
        "Choose today’s next step.",
        "Add tasks to Today's Candidates, then open Execute to give them time. The rest stay in their projects."
      ]
    ],
    "faq": [
      [
        "Which view should I use?",
        "Use the tree to break down goals, the list to scan tasks, Kanban to follow progress, and Matrix to compare importance and urgency. All views use the same data."
      ],
      [
        "How do tasks and subtasks differ?",
        "A task describes a piece of work. Subtasks describe its smaller steps. A subtask can be promoted to Today's Candidates when it needs its own time."
      ],
      [
        "How do I add a candidate?",
        "Use the candidate action beside a task, then open Execute to schedule it. Use the action again to remove it from the candidates."
      ]
    ],
    "next": "execute"
  }
} satisfies Record<Language, FeatureCopy>;
