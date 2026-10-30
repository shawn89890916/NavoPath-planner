import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "建议保持克制，决策权始终在你手中。", description: "通过置信度衡量建议确定性，结合个人历史记录持续优化参考基准。",
    steps: [["推测", "独立推测任务时长与所属项目"], ["衡量", "结合置信度、用户已有选择与上下文状态"], ["保护", "手动设定具备绝对最高优先级"]],
    sections: [
      ["有足够依据才给出建议", "置信度用于衡量当前预测的确定性程度。系统依据该数值决定是直接应用预估时长，还是保留为空等待手动输入。"],
      ["用户手动修改受到严格保护", "你手动选择的项目归属与填写的预估时长将被固化保护，后续预测绝不会擅自覆写已有人工输入。"],
      ["参考历史真实完成记录", "过往同类任务的实际用时记录将作为个性化预测的统计参考，越用越契合你的真实工作节奏。"],
    ],
    sources: [["置信度计算规则与阈值说明", "https://docs.typesafe.ai/confidence"], ["个性化记录统计与预测实现", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/aiPersonalization.ts"]],
  },
  en: {
    title: "Suggestions with room for your choice.", description: "Confidence guides suggestions; personal records refine baseline estimates over time.",
    steps: [["Infer", "Separately evaluate duration and project grouping"], ["Evaluate", "Factor in confidence score, prior choices, and task context"], ["Protect", "Explicit manual adjustments always take precedence"]],
    sections: [
      ["Recommend only with sufficient evidence", "Confidence indicates how clear the inference is. The system uses it to decide whether to fill an estimate or leave it for manual input."],
      ["Manual edits are strictly protected", "Explicit project assignments and manual durations are locked, ensuring automated predictions never overwrite human choices."],
      ["Reference truthful historical records", "Past execution times for similar tasks inform future estimates, adapting progressively to your real working pace."],
    ],
    sources: [["Understanding confidence thresholds", "https://docs.typesafe.ai/confidence"], ["Personal history and prediction implementation", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/aiPersonalization.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
