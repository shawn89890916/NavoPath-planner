import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "下一步，多一个帮手。",
    "description": "选一个示例请求，让待办安排到合适的时间，或为一项任务换一天。结果直接显示在时间轴上。",
    "benefits": [
      [
        "一句话，安排今天。",
        "点击“帮我安排今天”，把今日待办放进空闲时段。已有安排会保留，任务时长也会一起考虑。"
      ],
      [
        "计划变了，换一天。",
        "点击“帮我改期”，选择一项任务和预设日期。时间轴会切到那一天，直接展示新的安排。"
      ],
      [
        "每一步，都能撤回。",
        "不合适就撤回最近一轮，恢复原来的安排。这里的操作只改变示例，不影响你的个人工作区。"
      ]
    ],
    "faq": [
      [
        "示例体验与真实 AI 有什么区别？",
        "这里复用产品界面与操作组件，回复是预设示例，所有变化只保留在当前演示内。正式工作区会根据你的配置和任务请求真实 AI。"
      ],
      [
        "示例怎样执行和撤回？",
        "选择预设请求后，示例安排会直接生效。点击“撤回”恢复最近一轮操作之前的状态；多轮操作可以逐轮撤回。"
      ],
      [
        "真实使用需要怎样配置？",
        "进入正式工作区，在 Navo AI 设置中选择支持的提供商并完成配置。可用能力取决于账号、提供商和工作区设置。"
      ],
      [
        "改期会改变截止日期吗？",
        "改期调整任务在哪一天执行，保留原有截止日期。示例会为任务寻找新一天的空闲时段。"
      ],
      [
        "应用建议后还能手动调整吗？",
        "可以。应用后的任务进入时间轴，仍可使用执行页的操作调整时间、时长或完成状态。"
      ],
      [
        "介绍页的示例会消耗 AI 额度吗？",
        "不会。这里使用预设回复和示例数据，不发起真实 AI 请求，也不会修改你的个人工作区。"
      ]
    ],
    "next": "planning"
  },
  "en": {
    "title": "A little help with the next step.",
    "description": "Choose an example request to schedule today’s tasks or move one to another day. See the result directly on the timeline.",
    "benefits": [
      [
        "One request. A planned day.",
        "Choose “Plan my day” to put today’s tasks into free slots, keeping existing plans and allowing enough time for each task."
      ],
      [
        "Plans change. Move a task.",
        "Choose “Reschedule a task”, then pick a task and preset date. The timeline opens that day with the new arrangement."
      ],
      [
        "Every step can be undone.",
        "Undo the latest round to restore the previous arrangement. These changes stay in the example, leaving your personal workspace intact."
      ]
    ],
    "faq": [
      [
        "Is this a real AI request?",
        "The demo uses real product components with preset responses. Changes stay in this demo. The workspace uses your configuration and tasks to request real AI."
      ],
      [
        "How do the presets and undo work?",
        "A preset applies the example schedule immediately. Undo restores the previous state, one round at a time."
      ],
      [
        "What does real AI need?",
        "Open the workspace and configure a supported provider in Navo AI settings. Available capabilities depend on your account, provider, and workspace settings."
      ],
      [
        "Does rescheduling change the due date?",
        "Rescheduling changes the execution day and keeps the original due date. The example finds a free slot on the new day."
      ],
      [
        "Can I adjust a task after applying a suggestion?",
        "Yes. Applied tasks appear on the timeline, where Execute controls let you adjust their time, duration, or completion status."
      ],
      [
        "Does this example use AI credits?",
        "No. It uses preset responses and example data, without making real AI requests or changing your personal workspace."
      ]
    ],
    "next": "planning"
  }
} satisfies Record<Language, FeatureCopy>;
