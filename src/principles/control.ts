import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "每一次改变，都清晰可见。", description: "将 AI 的排程建议转化为可检查、可微调的具体操作。",
    steps: [["预览", "目标任务、排期时段与推荐理由"], ["校验", "严格遵循产品排程规则与时间网格"], ["撤回", "支持一键还原当前轮次的全部调整"]],
    sections: [
      ["将建议转化为具体排程动作", "Navo AI 将排程建议拆解为直观的任务操作，在界面中清晰标明目标任务、起始时间与调整依据。"],
      ["采纳建议仍受规则约束", "AI 建议写入时间轴时必须通过日程冲突与网格对齐校验。模型仅负责生成方案，系统代码负责守住逻辑边界。"],
      ["始终保留返回退路", "所有支持撤回的操作都会记录变动快照，方便一键回退到原有日程。演示页操作同样提供完整的撤回支持。"],
    ],
    sources: [["AI 操作与请求数据结构", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/aiAssistantApi.ts"], ["产品操作与撤回处理机制", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/main.tsx"]],
  },
  en: {
    title: "Changes you can inspect.", description: "Turn AI suggestions into concrete actions you can review and adjust.",
    steps: [["Review", "Target task, scheduled interval, and rationale"], ["Verify", "Enforce product scheduling rules and timeline grid"], ["Undo", "Restore previous state from the latest modification round"]],
    sections: [
      ["Translate suggestions into concrete operations", "Navo AI formats recommendations into actionable changes, displaying the target task, timeline slot, and reasoning."],
      ["Enforce structural consistency checks", "Proposed schedules must pass conflict detection and grid alignment. The model suggests; product logic validates."],
      ["Always maintain a clear path back", "Reversible operations record snapshot diffs so you can easily restore previous plans. The demo provides full undo support."],
    ],
    sources: [["AI action and request data contracts", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/aiAssistantApi.ts"], ["Product action handlers and undo execution", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/main.tsx"]],
  },
} satisfies Record<Language, PrincipleCopy>;
