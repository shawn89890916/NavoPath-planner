import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "时间排程，从寻找真实空档开始。", description: "让任务需要的时间，与一天中切实可支配的时间紧密吻合。",
    steps: [["扣除", "先扣除固定日程与已占用时段"], ["寻优", "寻找能够完整容纳任务的空闲区间"], ["规整", "基于统一的 15 分钟网格精准对齐"]],
    sections: [
      ["先确认时段充裕，再放置任务", "排程引擎首先从一天的时间线中扣除已知日程与已有安排，寻找能够容纳预估时长的空闲段，避免过度承诺。"],
      ["所有时间交互共用统一刻度", "标准 15 分钟网格为手动拖拽、边缘调整与算法排程提供统一的时间刻度，消除凌乱的碎片时间。"],
      ["明确厘清执行时段与截止日期", "执行时段回答“什么时候动手做”，截止日期界定“最晚何时交差”。两者分离，让日常安排更加从容。"],
    ],
    sources: [["时间排程引擎核心算法", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/autoSchedule.ts"], ["时间轴几何计算与吸附规范", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/timelineGeometry.ts"]],
  },
  en: {
    title: "Scheduling starts with available openings.", description: "Match the hours a task requires with the realistic open time you actually have.",
    steps: [["Subtract", "Account for fixed meetings and committed time"], ["Locate", "Identify a free window that fits the full task"], ["Align", "Align neatly to the consistent 15-minute grid"]],
    sections: [
      ["Confirm available space before scheduling", "The scheduling engine subtracts occupied blocks first, locating genuine openings large enough to contain the work."],
      ["One coherent scale across all interactions", "The 15-minute grid creates a shared temporal baseline for manual dragging, edge snapping, and automated scheduling."],
      ["Clearly separate execution slots from deadlines", "Scheduled slots answer 'when will I work on it', while deadlines state 'when is it due'. Separating both avoids false panic."],
    ],
    sources: [["Scheduling engine core algorithms", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/autoSchedule.ts"], ["Timeline geometry and grid-snapping rules", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/timelineGeometry.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
