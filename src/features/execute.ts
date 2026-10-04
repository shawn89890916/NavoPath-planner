import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "把今天，安排明白。",
    "description": "任务在左，时间在右。",
    "benefits": [],
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
    "title": "Make room for today.",
    "description": "Your tasks and your time, together.",
    "benefits": [],
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
