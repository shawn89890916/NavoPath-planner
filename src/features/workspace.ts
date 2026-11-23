import type { FeatureCopy } from "../productSite";
import type { Language } from "../types";

export default {
  zh: {
    title: "从左侧待办，到右侧时间轴。",
    description: "左边选今天要做的事，右边直接安排时间。临时有变，也在这一页调整。",
    benefits: [
      ["挑出今天要做的事", "从左侧今日候选中选一项，比如「调整网站布局」。"],
      ["安排实际的时间", "把任务拖进右侧空档。如果需要多一点时间，直接拉长任务块。"],
      ["计划有变时就地调整", "拖动任务块即可改时间。还没想好几点做，可以把它放回候选。"],
    ],
    faq: [
      ["一个任务可以分几次做吗？", "可以。同一个任务可以安排多条执行记录。"],
      ["浏览器里试玩会修改我的工作区吗？", "试玩使用独立的示例数据，重新打开即可恢复。"],
    ],
    next: "plugins",
  },
  en: {
    title: "From your task list to today’s timeline.",
    description: "Pick what you want to work on from the left, block time on the right, and adjust it all in one place.",
    benefits: [
      ["Pick a task for today", "Choose a task in the list on the left, such as Refine the website layout."],
      ["Give it a time", "Drag it into an open slot on the right. Stretch the block if you need more time."],
      ["Adjust when plans change", "Move a block to a new time, or drag it back to the list if you’ll schedule it later."],
    ],
    faq: [
      ["Can I split a task across several sessions?", "Yes. You can schedule multiple sessions for the same task."],
      ["Will the demo change my workspace?", "The demo uses its own sample data. Reopen it to reset the example."],
    ],
    next: "plugins",
  },
} satisfies Record<Language, FeatureCopy>;
