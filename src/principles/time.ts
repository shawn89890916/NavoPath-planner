import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "时间安排，从空闲时段开始。", description: "让任务需要的时间，与一天真正可用的时间对得上。",
    steps: [["扣除", "已有的忙碌时间"], ["寻找", "容得下任务的空闲段"], ["对齐", "一致的 15 分钟时间网格"]],
    sections: [
      ["先找能放下的位置", "安排引擎先扣除已有忙碌时间，再寻找能容纳任务的空闲段。任务时长、截止日期和项目的历史开始时间可以参与位置选择。"],
      ["所有操作用同一尺度", "默认 15 分钟网格让拖动、修改和自动安排有共同的时间尺度。一项 90 分钟的任务无法完整放进 30 分钟的空档；不足时可能拆分，或保留为未安排任务并说明原因。"],
      ["分清执行与截止", "安排时间回答什么时候做，截止日期回答最晚什么时候完成。两者分别保存，改到明天执行时可以保留原来的截止日期。"],
    ],
    sources: [["安排引擎", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/autoSchedule.ts"], ["共享时间几何", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/timelineGeometry.ts"]],
  },
  en: {
    title: "Scheduling starts with available time.", description: "Match the time a task needs to the time your day can actually offer.",
    steps: [["Subtract", "Existing busy time"], ["Find", "A slot that can hold the task"], ["Align", "A consistent 15-minute grid"]],
    sections: [
      ["Find room before placing a task", "The scheduler subtracts existing busy time and looks for a suitable free slot. Task duration, due dates, and historical project start times can influence placement."],
      ["Use one scale across operations", "The default 15-minute grid gives dragging, edits, and automatic scheduling a common scale. A 90-minute task cannot fit in full into a 30-minute gap. When space is limited, it may be split or remain unscheduled with a reason."],
      ["Separate execution from deadlines", "Scheduled time says when you will work; the due date says when the task must be finished. They are stored separately, so moving execution to tomorrow can preserve the original due date."],
    ],
    sources: [["Scheduling engine", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/autoSchedule.ts"], ["Shared timeline geometry", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/timelineGeometry.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
