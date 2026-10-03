import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "大目标，拆成今天能推进的一步。",
    "description": "将工作、学习和生活目标整理成项目，选出今天值得推进的任务。",
    "steps": [
      [
        "看清项目全貌",
        "把个人网站、学习和生活安排放在各自的项目里。展开项目，看看接下来有哪些事。"
      ],
      [
        "展开任务与子任务",
        "从「准备网站内容」继续拆到介绍、案例和联系信息。展开任务，找到可以直接开始的小步骤。"
      ],
      [
        "从不同视角整理",
        "在树、列表、看板和矩阵之间切换。看清结构、推进状态，或比较重要与紧急。"
      ],
      [
        "加入今日候选",
        "挑选今天值得推进的任务，加入今日候选。具体几点做，接下来在执行页安排。"
      ]
    ],
    "benefits": [
      [
        "结构清楚",
        "项目、任务与子任务保留上下文，回到项目时能继续推进。"
      ],
      [
        "视角随你切换",
        "同一份任务在树、列表、看板和矩阵里查看，无需重复整理。"
      ],
      [
        "每天有所选择",
        "把今天想推进的任务加入今日候选，再为它安排时间。"
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
    "title": "Turn a big goal into a step you can take today.",
    "description": "Organize work, learning, and life into projects. Choose the tasks worth moving forward today.",
    "steps": [
      [
        "See the whole project",
        "Keep your personal website, learning, and life in their own projects. Expand a project to see what comes next."
      ],
      [
        "Find the smaller steps",
        "Break website content into an introduction, case studies, and contact details. Expand a task to find a step you can start."
      ],
      [
        "Choose your perspective",
        "Switch between tree, list, Kanban, and Matrix. See the structure, track progress, or compare importance and urgency."
      ],
      [
        "Choose today's candidates",
        "Bring the tasks worth advancing today into Today's Candidates. Give them a time in Execute next."
      ]
    ],
    "benefits": [
      [
        "Keep the context",
        "Projects, tasks, and subtasks make it easier to pick up where you left off."
      ],
      [
        "Change your perspective",
        "View the same tasks in a tree, list, Kanban, or Matrix without organizing them twice."
      ],
      [
        "Make a daily choice",
        "Bring selected work into Today's Candidates, then make room for it on your timeline."
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
