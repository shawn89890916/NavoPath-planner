import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "把长期目标，拆解为可落实的行动步骤。",
    "description": "将工作、学业与生活目标归纳为项目树，通过不同视图洞察全局进展，并挑选任务进入今日候选。",
    "benefits": [
      [
        "项目全貌，一览无余。",
        "在同一个项目下组织相关任务。展开节点即可看清前置事项、待办细节与已完成成果。"
      ],
      [
        "一份数据源，四重视角自由切换。",
        "树状图理清层级结构，列表方便快速检索，看板跟踪执行状态，四象限矩阵辅助决策优先级。"
      ],
      [
        "明确今日推进重点。",
        "将计划今日推进的任务加入“今日候选”，再前往执行页排入时间轴；未选中的任务仍保留在项目库中。"
      ]
    ],
    "faq": [
      [
        "日常应该如何选用不同的规划视图？",
        "目标梳理首选树视图；待办检视推荐列表；多流程跟进使用看板；面对冲突时使用矩阵权衡轻重缓急。"
      ],
      [
        "父任务与子任务在逻辑上有何区别？",
        "父任务代表阶段性成果，子任务承载具体落地步骤。子任务同样支持独立设定时间并排入时间轴。"
      ],
      [
        "如何将项目中的任务加入今日候选？",
        "点击任务卡片右侧的“加入今日候选”图标，进入执行页即可在候选列表中看到并安排入日程。"
      ],
      [
        "切换规划视图会影响任务数据吗？",
        "完全不会。四种视图完全共享同一底层数据，无论在何种视图下修改状态或内容，均实时全局同步。"
      ],
      [
        "任务加入今日候选后，是否仍保留在原项目中？",
        "仍在原项目中。“今日候选”仅代表当天的执行聚焦标记，不会改变任务在项目树中的归属关系。"
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
    "description": "Organize goals into structured projects, inspect progress across multiple views, and choose today's candidates.",
    "benefits": [
      [
        "See the entire project structure.",
        "Group related tasks under common objectives to clearly see what is ahead and what is already done."
      ],
      [
        "One set of tasks, four distinct views.",
        "Tree view reveals hierarchy, List aids rapid review, Kanban tracks status, and Matrix clarifies priorities."
      ],
      [
        "Select today's next actionable steps.",
        "Send tasks to Today's Candidates for timeline scheduling, while remaining items stay organized in the project."
      ]
    ],
    "faq": [
      [
        "Which planning view fits which workflow?",
        "Use Tree to break down goals, List for daily scanning, Kanban to track workflow, and Matrix to weigh urgency."
      ],
      [
        "How do parent tasks and subtasks relate?",
        "Tasks capture specific deliverables; subtasks break down procedural steps and can be scheduled independently."
      ],
      [
        "How do I add a project task to Today's Candidates?",
        "Click the candidate icon beside any task, then open the Execute page to schedule it on the timeline."
      ],
      [
        "Does switching views alter or duplicate tasks?",
        "No. All views reflect the exact same underlying task objects; edits synchronize across views instantly."
      ],
      [
        "Does a task remain in its project after becoming a candidate?",
        "Yes. Being a candidate simply marks intention for today; project hierarchy and context remain untouched."
      ],
      [
        "Are modifications made in the demo saved permanently?",
        "Demo changes exist only in your current session. Sign in to your account to build persistent project workspaces."
      ]
    ],
    "next": "execute"
  }
} satisfies Record<Language, FeatureCopy>;
