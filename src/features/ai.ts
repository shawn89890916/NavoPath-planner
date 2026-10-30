import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "下一步安排，有辅助可依。",
    "description": "选择预设示例，体验 AI 如何将待办合理排入日程空档，或将任务灵活改期。排程建议可直观预览。",
    "benefits": [
      [
        "自然语言，辅助排程。",
        "点击“今日候选”右上角的 AI 安排图标，查看系统如何将写作、阅读与锻炼等任务依序排入空闲时段。"
      ],
      [
        "日程有变，从容改期。",
        "点击“帮我改期”并选择目标任务与日期，时间轴即刻定位到对应日期，呈现调整后的位置。"
      ],
      [
        "每项建议，皆可撤回。",
        "如果建议不符合预期，随时可以撤回最近一轮调整，恢复原样。此处的交互仅作用于演示数据。"
      ]
    ],
    "faq": [
      [
        "示例演示与真实 AI 功能有何区别？",
        "本演示完整复用正式界面与交互组件，但采用固定的示例数据与预设逻辑，不会发起远程 AI 请求。"
      ],
      [
        "示例如何进行排程与撤回操作？",
        "点击排程按钮后，时间轴将呈现建议结果；点击“撤回”即可还原至排程前的状态。"
      ],
      [
        "在正式版中启用 AI 需要哪些配置？",
        "在 NavoPath 设置的 Navo AI 面板中，配置所支持的模型服务商及其 API Key 即可启用。"
      ],
      [
        "任务改期会修改任务的截止日期吗？",
        "改期仅调整任务在时间轴上的执行时段，原有的截止日期保持不变。排程器会自动在新日期寻找可用空档。"
      ],
      [
        "采纳 AI 建议后，还能手动微调吗？",
        "完全可以。排入时间轴的任务始终受你控制，可随时拖拽修改时间、调整时长或标记完成。"
      ],
      [
        "浏览本介绍页的示例会消耗 API 额度吗？",
        "不会。本演示完全基于本地静态数据，不会产生外部网络调用或消耗任何模型额度。"
      ]
    ],
    "next": "planning"
  },
  "en": {
    "title": "Thoughtful assistance with your next step.",
    "description": "Choose a preset request to see how AI suggests fitting tasks into free slots or rescheduling them, with full preview before applying.",
    "benefits": [
      [
        "One request to organize your day.",
        "Click the AI schedule icon beside Today's Candidates to preview how tasks are placed into open hours."
      ],
      [
        "Plans shift. Move a task effortlessly.",
        "Click 'Reschedule a task' and pick a target date to see the timeline jump directly to the proposed new slot."
      ],
      [
        "Every change remains completely reversible.",
        "Undo the last round of adjustments at any time to restore previous plans. Demo actions affect only sample data."
      ]
    ],
    "faq": [
      [
        "How does this demo differ from the real AI feature?",
        "This demo uses the real application interface and layout but runs on preset data without sending live API requests."
      ],
      [
        "How do preset scheduling and undo work in the demo?",
        "Click the schedule button to preview timeline placements; click 'Undo' to restore your prior layout."
      ],
      [
        "What is required to use AI in the actual app?",
        "Open NavoPath Settings, navigate to Navo AI, and configure your preferred provider and API key."
      ],
      [
        "Does rescheduling change a task's deadline?",
        "Rescheduling only alters the planned execution time on the timeline, keeping original deadlines intact."
      ],
      [
        "Can I manually adjust tasks after accepting suggestions?",
        "Yes. All scheduled tasks remain under full manual control; you can drag, resize, or edit them at any time."
      ],
      [
        "Does trying this demo consume AI quota?",
        "No. All interactions use local preset data and will not make external calls or use API credits."
      ]
    ],
    "next": "planning"
  }
} satisfies Record<Language, FeatureCopy>;
