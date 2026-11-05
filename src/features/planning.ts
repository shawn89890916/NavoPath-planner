import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "把长期目标，拆解为可落实的行动步骤。",
    "description": "将工作、学业与生活目标归纳为项目树，在时间轴旁切换任务视图和管理项目。",
    "benefits": [
      [
        "项目全貌，一览无余。",
        "在同一个项目下组织相关任务。展开节点即可看清前置事项、待办细节与已完成成果。"
      ],
      [
        "在同一区域切换任务视图。",
        "项目管理保留层级结构。列表方便快速检索，看板跟踪状态，矩阵辅助权衡优先级。"
      ],
      [
        "明确今日推进重点。",
        "「今日候选」自动显示各项目的待安排任务。直接将任务拖入旁边的时间轴。"
      ]
    ],
    "faq": [
      [
        "日常应该如何选用不同的规划视图？",
        "整理目标时打开项目管理。浏览待办可用列表，跟进状态可用看板，权衡轻重缓急可用矩阵。"
      ],
      [
        "父任务与子任务在逻辑上有何区别？",
        "父任务代表阶段性成果，子任务承载具体落地步骤。子任务同样支持独立设定时间并排入时间轴。"
      ],
      [
        "如何安排项目中的任务？",
        "在左浮栏找到任务，直接拖入时间轴。竖屏也可以点「安排」选择时间。"
      ],
      [
        "切换规划视图会影响任务数据吗？",
        "完全不会。各视图共享同一底层数据，无论在何种视图下修改状态或内容，均实时全局同步。"
      ],
      [
        "排程后，任务是否仍保留在原项目中？",
        "任务仍在原项目中。可以在项目管理中查看，或在「更多」里打开「显示已安排」。"
      ],
      [
        "在介绍页交互演示中所做的更改会被保存吗？",
        "演示中的操作仅保存在当前页面会话中，刷新即重置。登录个人账户后即可持久保存正式规划数据。"
      ]
    ],
    "next": "execute"
  },
  "en": {
    "title": "Turn long-term goals into clear actions.",
    "description": "Organize goals into projects, switch task views, and manage projects alongside the timeline.",
    "benefits": [
      [
        "See the entire project structure.",
        "Group related tasks under common objectives to clearly see what is ahead and what is already done."
      ],
      [
        "Switch task views in one place.",
        "Project management shows the hierarchy. List aids review, Kanban tracks status, and Matrix clarifies priorities."
      ],
      [
        "Select today's next actionable steps.",
        "Today's Candidates brings together tasks waiting for a time slot. Drag them straight onto the timeline."
      ]
    ],
    "faq": [
      [
        "Which planning view fits which workflow?",
        "Use project management to break down goals, List for daily scanning, Kanban to track workflow, and Matrix to weigh urgency."
      ],
      [
        "How do parent tasks and subtasks relate?",
        "Tasks capture specific deliverables; subtasks break down procedural steps and can be scheduled independently."
      ],
      [
        "How do I schedule a project task?",
        "Find the task in the left panel and drag it onto the timeline. In portrait, you can also select Schedule and choose a time."
      ],
      [
        "Does switching views alter or duplicate tasks?",
        "No. All views reflect the exact same underlying task objects; edits synchronize across views instantly."
      ],
      [
        "Does a scheduled task remain in its project?",
        "Yes. Find it under Manage projects or turn on Show scheduled in the More menu."
      ],
      [
        "Are modifications made in the demo saved permanently?",
        "Demo changes exist only in your current session. Sign in to your account to build persistent project workspaces."
      ]
    ],
    "next": "execute"
  }
} satisfies Record<Language, FeatureCopy>;
