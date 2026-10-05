import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "JEV：把 AI 放进小判断。", description: "记下一项任务时，让估时和归类少一点重复填写。",
    steps: [["输入", "任务标题与已有项目"], ["判断", "建议时长与项目选项"], ["补充", "在后台完善任务信息"]],
    sections: [
      ["把问题缩小", "JEV 是 TypeSafe AI 的结构化决策模型。NavoPath 分别询问任务大概需要多久、适合哪个已有项目；返回明确选项与各自的置信度，供产品处理。"],
      ["先记下来，再补充", "创建任务无需等预测完成。任务先保存，已配置且可用的预测服务在后台补充建议；时长从 15 分钟到 4 小时中选择，项目也可以保持未归类。"],
      ["有明确的边界", "后台结果仍要检查任务是否变化、你是否已手动修改。JEV 在这里处理估时和归类；整天安排还需要时间规则与其他 AI 操作流程。"],
    ],
    sources: [["JEV 官方文档", "https://docs.typesafe.ai/introduction"], ["任务预测实现", "https://github.com/shawn89890916/NavoPath-planner/blob/main/supabase/functions/ai-assistant/jevPrediction.ts"]],
  },
  en: {
    title: "JEV, for the small decisions.", description: "A little less repetitive input when estimating and organizing a task.",
    steps: [["Input", "Task title and existing projects"], ["Decide", "Duration and project choices"], ["Enrich", "Update task details in the background"]],
    sections: [
      ["Ask a focused question", "JEV is TypeSafe AI’s structured decision model. NavoPath asks separately how long a task may take and which existing project it fits. Choices and separate confidence values give the product results it can process."],
      ["Capture first, enrich later", "Task creation does not wait for prediction. When a prediction service is configured and available, suggestions follow in the background. Duration choices run from 15 minutes to four hours; a project can remain unassigned."],
      ["Keep the scope clear", "Background results are checked against subsequent task changes and manual edits. JEV handles duration and project decisions here; arranging a day also involves scheduling rules and other AI action flows."],
    ],
    sources: [["Official JEV documentation", "https://docs.typesafe.ai/introduction"], ["Task prediction implementation", "https://github.com/shawn89890916/NavoPath-planner/blob/main/supabase/functions/ai-assistant/jevPrediction.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
