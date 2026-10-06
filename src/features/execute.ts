import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "把今天，安排明白。",
    "description": "从今日候选中挑选任务，放进一天的空闲时段。让任务需要的时间与实际可用的时间，一起看得见。",
    "benefits": [
      ["给任务留出时间。", "拖动候选任务到时间轴，或使用安排按钮。根据任务时长，找到容得下它的空闲时段。"],
      ["随一天的变化调整。", "修改开始时间或时长，让安排跟上当天的变化。时间轴按 15 分钟网格对齐，帮助看清已有安排。"],
      ["完成，也可以改期。", "做完就标记完成。还没做完的任务可以取消安排、保留待办，或移到明天继续推进。"]
    ],
    "faq": [
      [
        "安排时间和截止日期有什么区别？",
        "安排时间回答什么时候做，截止日期回答最晚什么时候完成。任务可以先安排到时间轴，再根据需要设置截止日期。"
      ],
      [
        "今天没有完成怎么办？",
        "可以保留未完成状态、取消安排或改期。移至明天时，会寻找能容纳任务的首个空闲时段。"
      ],
      [
        "手机上怎样安排？",
        "使用任务与日程切换查看两边；长按任务可拖动安排，也可以使用安排按钮。"
      ],
      [
        "不拖动，也能安排任务吗？",
        "可以。点击候选任务的安排按钮，选择开始时间与时长，再确认安排。"
      ],
      [
        "任务需要更长或更短的时间怎么办？",
        "可以修改安排的时长，也可以拖动时间轴中任务块的边缘调整。已有安排仍会显示在时间轴中，便于检查时间是否合适。"
      ],
      [
        "每个任务之间都要留空吗？",
        "不需要。下一项任务可以接着上一项的结束时间开始；也可以按实际需要留出吃饭、休息和缓冲时间。"
      ]
    ],
    "next": "ai"
  },
  "en": {
    "title": "Make room for today.",
    "description": "Pick from Today's Candidates and place tasks into free slots. See the time your work needs alongside the time you actually have.",
    "benefits": [
      ["Give each task time.", "Drag a candidate onto the timeline or use its Schedule button. Find a free slot that fits the task's duration."],
      ["Adjust as the day changes.", "Change a start time or duration as plans shift. A 15-minute grid keeps the timeline aligned and existing plans easy to read."],
      ["Finish or reschedule.", "Mark completed work as done. Unfinished tasks can be unscheduled, kept pending, or moved to tomorrow."]
    ],
    "faq": [
      [
        "How do schedules and deadlines differ?",
        "A schedule says when you will do the work. A deadline says when it must be finished. You can schedule a task without setting a deadline."
      ],
      [
        "What if I don't finish today?",
        "Keep the task incomplete, unschedule it, or reschedule it. Tomorrow finds the first free slot that fits its duration."
      ],
      [
        "How do I schedule on my phone?",
        "Switch between tasks and the timeline. Long-press a task to drag it, or use its Schedule button."
      ],
      [
        "Can I schedule without dragging?",
        "Yes. Use the Schedule button on a candidate, choose a start time and duration, then confirm."
      ],
      [
        "What if a task needs more or less time?",
        "Edit its scheduled duration or drag the edge of its timeline block. Existing plans stay visible so you can check whether the new timing fits."
      ],
      [
        "Do I need a gap between every task?",
        "No. A task can start when the previous one ends. Leave room for meals, rest, and a buffer when you need it."
      ]
    ],
    "next": "ai"
  }
} satisfies Record<Language, FeatureCopy>;
