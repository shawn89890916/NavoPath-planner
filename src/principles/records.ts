import type { Language } from "../types";
import type { PrincipleCopy } from "../productSite";

export default {
  zh: {
    title: "任务是一件事，安排是一次尝试。", description: "把要做什么与什么时候做分开，计划才更容易调整。",
    steps: [["任务", "准备个人网站内容"], ["记录", "今天安排的一段时间"], ["再安排", "保留任务，继续推进"]],
    sections: [
      ["一项任务可以有多次安排", "任务保存标题、项目、截止日期等信息，时间记录保存每次安排的日期、开始与结束时间以及执行状态。同一任务可以关联多条记录。"],
      ["改期不用重新建任务", "取消、完成或返回未完成的安排都有各自状态。改变一次安排时，仍可保留任务本身，让后续推进继续关联到原来的工作。"],
      ["计划与实际分别记录", "安排反映准备投入的时间，时间条目记录实际投入。这些数据可以用于后续统计与估时参考，帮助区分计划时长和真实用时。"],
    ],
    sources: [["任务与时间记录类型", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/types.ts"], ["时间记录处理", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/utils/timelineRecords.ts"]],
  },
  en: {
    title: "A task is work. A schedule is one attempt.", description: "Separate what you want to do from when you plan to do it.",
    steps: [["Task", "Prepare personal website content"], ["Record", "A block of time planned for today"], ["Continue", "Keep the task and arrange another attempt"]],
    sections: [
      ["One task can have several arrangements", "The task holds its title, project and due date. Timeline records hold each arrangement’s date, start and end times, and execution state. A task can be associated with several records."],
      ["Reschedule without recreating the task", "Cancelled, completed and returned-unfinished arrangements have distinct states. Changing an arrangement can preserve the task itself, keeping later work linked to the original task."],
      ["Keep planned and actual time distinct", "Arrangements describe intended time; time entries record time actually spent. These records can inform statistics and duration references while keeping a plan separate from recorded effort."],
    ],
    sources: [["Task and time record types", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/types.ts"], ["Timeline record handling", "https://github.com/shawn89890916/NavoPath-planner/blob/main/src/utils/timelineRecords.ts"]],
  },
} satisfies Record<Language, PrincipleCopy>;
