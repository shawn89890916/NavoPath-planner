import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "下一步，多一个帮手。",
    "description": "先看建议，再决定。",
    "benefits": [
      [
        "先预览。",
        "建议应用前，都可以检查和调整。"
      ],
      [
        "随时调整。",
        "应用后仍能修改，也能撤回本轮安排。"
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
    "description": "Review the suggestions. You decide.",
    "benefits": [
      [
        "Preview first.",
        "Review and adjust before applying."
      ],
      [
        "Keep control.",
        "Change the plan or undo the latest round."
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
