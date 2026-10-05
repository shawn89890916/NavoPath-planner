import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "建议有分寸，选择留给你。", description: "用置信度控制建议，用个人记录改善参考值。",
    steps: [["建议", "估时与项目分别判断"], ["检查", "置信度、已有选择与任务变化"], ["优先", "保留你的手动修改"]],
    sections: [
      ["有把握，才进一步", "置信度反映结果有多明确，不等于正确率。产品据此决定是否应用估时、提示项目，或在更有把握时自动归类；两项建议分别处理。"],
      ["修改有优先级", "你明确选择的项目和手动修改的时长受到保护。例如把时长改成 90 分钟后，稍晚返回的后台预测不会覆盖这次修改。"],
      ["参考已有记录", "相似任务、记录过的用时和项目统计会参与个人规划参考。产品用已有记录整理默认值和偏好，供后续规划参考。"],
    ],
    sources: [["置信度的含义", "https://docs.typesafe.ai/confidence"], ["个人记录与预测实现", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/aiPersonalization.ts"]],
  },
  en: {
    title: "Suggestions with room for your judgment.", description: "Confidence guides suggestions; personal records inform the defaults.",
    steps: [["Suggest", "Assess duration and project separately"], ["Check", "Confidence, choices and task changes"], ["Respect", "Keep your manual edits"]],
    sections: [
      ["Act with appropriate confidence", "Confidence describes how clearly an answer stands out, rather than its accuracy. The product uses it to apply an estimate, suggest a project, or assign one at higher confidence. Each field is assessed separately."],
      ["Give your edits priority", "Explicit project choices and manually changed durations are protected. Set a duration to 90 minutes, and a background prediction arriving later will preserve that edit."],
      ["Use the records already available", "Similar tasks, recorded time, and project statistics inform planning references. These records help establish defaults and preferences for later planning."],
    ],
    sources: [["Understanding confidence", "https://docs.typesafe.ai/confidence"], ["Personalization implementation", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/aiPersonalization.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
