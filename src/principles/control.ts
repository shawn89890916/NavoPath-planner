import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "每一次改变，都看得清。", description: "让 AI 建议成为可检查、可调整的具体操作。",
    steps: [["查看", "目标任务、时间与原因"], ["应用", "通过产品规则检查"], ["撤回", "恢复支持撤回的本轮变化"]],
    sections: [
      ["建议落到具体任务", "Navo AI 将建议转成任务操作，在界面中展示目标任务、时间和原因。你可以检查将要改变什么，再决定应用哪些建议。"],
      ["应用仍要经过检查", "建议进入工作区时仍遵循产品的时间与冲突规则。模型给出建议，产品代码处理它对应的任务变化。"],
      ["保留返回的路", "支持撤回的操作记录本轮变化，便于恢复之前的安排。网站体验使用预设请求和内存数据；正式工作区按服务配置处理真实请求。"],
    ],
    sources: [["AI 操作与请求结构", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/aiAssistantApi.ts"], ["产品操作实现", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/main.tsx"]],
  },
  en: {
    title: "Changes you can inspect.", description: "Turn AI suggestions into concrete actions you can review and adjust.",
    steps: [["Review", "The task, times and reason"], ["Apply", "Check against product rules"], ["Undo", "Restore supported changes from a round"]],
    sections: [
      ["Make a suggestion concrete", "Navo AI translates suggestions into task actions, showing the task, times, and reason. Inspect the proposed changes, then decide which suggestions to apply."],
      ["Keep the product checks", "Applying suggestions still goes through the workspace’s time and conflict checks. The model proposes; product code handles the resulting task changes."],
      ["Keep a way back", "Supported undo operations record the changes in a round so earlier arrangements can be restored. The website uses presets and in-memory data; the workspace processes real requests according to its service configuration."],
    ],
    sources: [["AI action and request types", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/aiAssistantApi.ts"], ["Product action handlers", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/main.tsx"]],
  },
} satisfies Record<Language, PrincipleCopy>;
