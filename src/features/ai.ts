import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "整理与安排，多一个帮手。",
    "description": "从任务建议到安排预览，查看、调整并应用 AI 给出的下一步。",
    "steps": [
      [
        "查看估时与项目建议",
        "创建任务时，估时和项目建议帮助你开始整理。示例里可以调整时长，或接受项目建议。"
      ],
      [
        "生成安排预览",
        "选择「安排今天」，检查任务怎样避开已有安排。这里使用固定示例，不消耗 AI 额度。"
      ],
      [
        "调整并应用",
        "在真实 AI 面板里修改建议时间、时长或项目，再选择要应用的建议。结果写入这份示例一天。"
      ],
      [
        "撤回本轮操作",
        "应用之后仍可以撤回。试试「调整一项安排」和「撤回本轮操作」，观察示例时间轴的变化。"
      ]
    ],
    "benefits": [
      [
        "建议看得见",
        "任务的用时、项目与安排位置呈现在界面中，方便检查。"
      ],
      [
        "应用前可调整",
        "选择需要的建议，改好时间与时长，再应用到时间轴。"
      ],
      [
        "操作有回路",
        "确认、取消与撤回都在面板里，方便保留自己的判断。"
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
    "title": "A little help with organizing and scheduling.",
    "description": "Review, adjust, and apply the next steps suggested by AI, from task estimates to schedule previews.",
    "steps": [
      [
        "Review task suggestions",
        "Duration and project suggestions help you organize a new task. Adjust the estimate or accept a project suggestion in this example."
      ],
      [
        "Preview a schedule",
        "Choose Schedule today and review how the tasks fit around existing commitments. This fixed example uses no AI credits."
      ],
      [
        "Adjust and apply",
        "Change suggested times, durations, or projects in the real AI panel. Apply selected suggestions to the example day."
      ],
      [
        "Undo the changes",
        "You can undo after applying. Try Adjust a task and Undo this run to see the example timeline change."
      ]
    ],
    "benefits": [
      [
        "See the suggestions",
        "Estimates, projects, and suggested positions are visible and easy to review."
      ],
      [
        "Adjust before applying",
        "Choose the suggestions you want and refine their time and duration."
      ],
      [
        "Keep your judgment",
        "Confirm, cancel, and undo from the same panel."
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
