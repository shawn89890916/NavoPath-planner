import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "JEV：将 AI 聚焦于局部的小判断。", description: "创建任务时自动推测预估用时与项目归类，减少重复的表单录入。",
    steps: [["录入", "快速输入任务标题与关联信息"], ["研判", "估算合理时长（15分钟至4小时）与推荐分类"], ["补充", "后台静默填充，不打断输入心流"]],
    sections: [
      ["聚焦明确的单点决策", "JEV 采用结构化决策机制，不负责宏观的人生大计，专注于在毫秒级内完成“该归入哪个项目、大致需要多久”这类微小判断。"],
      ["先记录任务，后台异步完善", "创建任务瞬间完成保存，无需等待网络或模型推测返回。已启用的预测服务在后台异步计算并补齐属性。"],
      ["严守职责范围与时间边界", "后台推测结果写入前会复核用户是否已进行手动设定，同时将时长约束在合理范围（15分钟至4小时）。"],
    ],
    sources: [["JEV 结构化决策规范文档", "https://docs.typesafe.ai/introduction"], ["任务属性预测引擎实现", "https://github.com/shawn89890916/NavoPath-planner/blob/main/supabase/functions/ai-assistant/jevPrediction.ts"]],
  },
  en: {
    title: "JEV: Focused AI for small decisions.", description: "Lighten repetitive entry by predicting duration and project category when capturing tasks.",
    steps: [["Capture", "Enter task title and contextual notes"], ["Predict", "Estimate realistic duration (15m–4h) and project classification"], ["Enrich", "Enrich task metadata asynchronously without stalling input"]],
    sections: [
      ["Constrain questions to narrow boundaries", "JEV focuses on structured, narrow micro-decisions: determining which project a task belongs to and estimating its duration within milliseconds."],
      ["Capture first, enrich in background", "Task saving is instantaneous. Configured prediction services run in the background without blocking the UI."],
      ["Keep clear behavioral boundaries", "Inferences verify that the user has not manually overridden values, keeping duration estimates constrained between 15 minutes and 4 hours."],
    ],
    sources: [["Official JEV specification documentation", "https://docs.typesafe.ai/introduction"], ["Task prediction engine implementation", "https://github.com/shawn89890916/NavoPath-planner/blob/main/supabase/functions/ai-assistant/jevPrediction.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
