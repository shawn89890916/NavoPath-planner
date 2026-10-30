import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "任务代表目标本身，排程是一次执行尝试。", description: "将“要做什么”与“何时执行”解耦，让计划调整变得轻松自如。",
    steps: [["任务本体", "定义要做的事项内容与截止日期"], ["排程记录", "分配在今日时间轴中的一段执行时间"], ["再次安排", "任务本体保留，继续安排新的时段推进"]],
    sections: [
      ["单个任务支持多次执行记录", "任务负责保存标题、所属项目与最终截止日期；时间记录则保存每次投入的具体开始时间、时长与完成状态。"],
      ["改期无需重建任务本体", "改期或取消排程仅变更当次的时间分配，不会破坏任务本身的备注、子任务或历史累计投入。"],
      ["计划用时与实际用时分别留痕", "排程记录代表预期分配的时间段，执行条目则诚实记录真实耗时。对比两者有助于不断修正自己的时间感知。"],
    ],
    sources: [["任务与时间记录数据模型定义", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/types.ts"], ["时间轴多段记录管理机制", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/utils/timelineRecords.ts"]],
  },
  en: {
    title: "A task is the goal. A schedule is an attempt.", description: "Separating task definitions from calendar slots keeps your plans adaptable.",
    steps: [["Task", "Core task title, project association, and deadline"], ["Schedule Slot", "A planned block of time on today’s timeline"], ["Reschedule", "Retain task state and schedule another session"]],
    sections: [
      ["One task can have multiple execution blocks", "The task holds name, hierarchy, and deadline; schedule records store the actual dates, times, durations, and session status."],
      ["Reschedule without recreating the task", "Rescheduling or cancelling a slot affects only that specific session, keeping the task notes, subtasks, and progress intact."],
      ["Track planned allocations versus actual time", "Schedules indicate intended time blocks, while execution records capture reality. Comparing them sharpens future estimation."],
    ],
    sources: [["Task and timeline record schema", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/types.ts"], ["Timeline multi-record state management", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/utils/timelineRecords.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
