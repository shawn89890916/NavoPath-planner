import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "把目标，变成能推进的任务。",
    "description": "项目、任务和今天要做的事，放在一起。",
    "benefits": [
      [
        "项目，一目了然。",
        "工作、学习与生活，各有各的进度。"
      ],
      [
        "选出今天的下一步。",
        "换个视角，找到值得推进的任务。"
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
    "description": "Projects, tasks, and today’s next steps in one place.",
    "benefits": [
      [
        "See the whole project.",
        "Work, learning, and life, each at its own pace."
      ],
      [
        "Choose today’s next step.",
        "Switch perspectives to find what matters."
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
