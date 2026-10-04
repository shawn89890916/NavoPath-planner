import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "下一步，多一个帮手。",
    "description": "让 Navo AI 根据任务和空闲时间提出安排。先查看建议、调整细节，再决定哪些放进今天。",
    "benefits": [
      [
        "结合任务，提出安排。",
        "从今日候选出发，参考任务时长和已有安排，为下一步找到合适的空闲时段。"
      ],
      [
        "先检查，再应用。",
        "逐项查看建议的时间、时长和所属项目。调整后，只应用你选中的任务。"
      ],
      [
        "保留调整的余地。",
        "应用后，安排会出现在时间轴中。可以继续调整，也可以撤回本轮操作，恢复之前的状态。"
      ]
    ],
    "faq": [
      [
        "示例体验与真实 AI 有什么区别？",
        "这里复用产品界面与操作组件，回复是预设示例，所有变化只保留在当前演示内。正式工作区会根据你的配置和任务请求真实 AI。"
      ],
      [
        "建议怎样应用和撤回？",
        "检查建议，调整时间、时长或项目，然后应用选中的项。应用后可以撤回本轮操作，恢复应用前的状态。"
      ],
      [
        "真实使用需要怎样配置？",
        "进入正式工作区，在 Navo AI 设置中选择支持的提供商并完成配置。可用能力取决于账号、提供商和工作区设置。"
      ]
    ],
    "next": "planning"
  },
  "en": {
    "title": "A little help with the next step.",
    "description": "Let Navo AI suggest a schedule from your tasks and free time. Review the details, make adjustments, and choose what belongs in your day.",
    "benefits": [
      [
        "A plan that fits your tasks.",
        "Start from Today's Candidates. Task durations and existing plans help find room for your next step."
      ],
      [
        "Review before applying.",
        "Check the time, duration, and project for each suggestion. Make changes and apply only the tasks you select."
      ],
      [
        "Room to change your mind.",
        "Applied tasks appear on the timeline. Keep adjusting, or undo the latest round to restore the previous state."
      ]
    ],
    "faq": [
      [
        "Is this a real AI request?",
        "The demo uses real product components with preset responses. Changes stay in this demo. The workspace uses your configuration and tasks to request real AI."
      ],
      [
        "How do I apply and undo?",
        "Review and edit the suggestions, then apply selected items. Undo restores the state before that batch was applied."
      ],
      [
        "What does real AI need?",
        "Open the workspace and configure a supported provider in Navo AI settings. Available capabilities depend on your account, provider, and workspace settings."
      ]
    ],
    "next": "planning"
  }
} satisfies Record<Language, FeatureCopy>;
