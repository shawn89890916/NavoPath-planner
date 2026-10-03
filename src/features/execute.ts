import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "给今天要做的事，留出真正的时间。",
    "description": "将今日候选放进时间轴，根据一天的变化调整安排。",
    "steps": [
      [
        "挑选今日候选",
        "先看看今天值得推进的几件事。调整预计用时，为接下来的安排做好准备。"
      ],
      [
        "放进空闲时段",
        "将任务拖入时间轴，或点击安排查看建议位置。确认后，任务就有了具体的开始时间。"
      ],
      [
        "调整安排",
        "一天有变化时，拖动时间块改变位置，拖动边缘调整时长。安排始终以十五分钟为刻度。"
      ],
      [
        "完成或改期",
        "做完后勾选完成。还需要时间的任务可以安排到明天，落在首个合适的空闲时段。"
      ]
    ],
    "benefits": [
      [
        "看到时间",
        "用时间块看清每项工作占据多久，以及一天还留下多少空档。"
      ],
      [
        "随变化调整",
        "拖动安排和修改时长，让当天的时间轴跟上实际变化。"
      ],
      [
        "给未完成留下一步",
        "保留任务与安排信息，继续完成或改期，让工作有后续。"
      ]
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
        "使用任务与日程切换查看两边；长按任务可拖动安排，也可以使用安排按钮。演示中同样提供按钮操作。"
      ]
    ],
    "next": "ai"
  },
  "en": {
    "title": "Make real time for what you want to do today.",
    "description": "Place Today's Candidates on your timeline and adjust the schedule as your day changes.",
    "steps": [
      [
        "Choose today's candidates",
        "Start with the few things worth advancing today. Adjust their estimated duration before scheduling."
      ],
      [
        "Find an open time",
        "Drag a task onto the timeline or use Schedule to see a suggested position. Confirm it to give the task a start time."
      ],
      [
        "Adjust the schedule",
        "Move a time block when your day changes. Drag its edges to adjust the duration, using fifteen-minute increments."
      ],
      [
        "Complete or reschedule",
        "Check off finished work. Move a task that needs more time to tomorrow's first suitable free slot."
      ]
    ],
    "benefits": [
      [
        "See your time",
        "Time blocks show how much room each task needs and what is still available."
      ],
      [
        "Adjust as you go",
        "Move blocks and change durations to keep your schedule useful."
      ],
      [
        "Leave a next step",
        "Keep the task and its scheduling context when work needs to continue."
      ]
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
        "Switch between tasks and the timeline. Long-press a task to drag it, or use its Schedule button. The demo also includes button controls."
      ]
    ],
    "next": "ai"
  }
} satisfies Record<Language, FeatureCopy>;
