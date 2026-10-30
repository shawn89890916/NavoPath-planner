import type { Language } from "../types";
import type { FeatureCopy } from "../productSite";

export default {
  "zh": {
    "title": "理清节奏，排好今天的时间轴。",
    "description": "从今日候选中挑选核心任务，拖入时间轴的空闲时段。直观核对任务预估时长与当天可用时间。",
    "benefits": [
      ["为重要任务留出专属时间。", "将候选任务拖至时间轴，或点击安排按钮。系统会根据任务时长指引合适的空闲时段。"],
      ["随日程变化灵活调整。", "随时调整开始时间或拖拽边缘缩放时长。时间轴基于 15 分钟网格对齐，清晰易读。"],
      ["标记完成，未完随时改期。", "任务完成后直接勾选。未完成的任务可取消排程保留在待办中，或顺延至明天继续推进。"]
    ],
    "faq": [
      [
        "安排时间与截止日期有何本质区别？",
        "“安排时间”明确具体何时执行；“截止日期”界定最晚何时完成。两者独立，支持先排程后定截止期。"
      ],
      [
        "今天安排的任务没做完怎么办？",
        "可保持未完成、取消排程留作候选，或一键顺延至明天。移至次日时会自动寻找首个合适空档。"
      ],
      [
        "在移动端设备上如何进行排程？",
        "通过底部视图切换任务与日程；长按任务块可拖拽至时间轴，亦可使用卡片上的“安排”按钮。"
      ],
      [
        "除了拖拽，还有其他安排任务的方式吗？",
        "支持点击候选卡片的安排按钮，直接选择起始时间与预估时长并确认加入时间轴。"
      ],
      [
        "如果任务实际所需时间发生变化怎么办？",
        "可在面板中直接修改时长，或在时间轴中拖拽任务块底边微调，相邻安排始终保持清晰可视。"
      ],
      [
        "任务之间必须预留间隔空隙吗？",
        "不必预留。任务可以紧密衔接，亦可根据实际精力节奏留出用餐、小憩与机动缓冲时间。"
      ]
    ],
    "next": "ai"
  },
  "en": {
    "title": "Make room for today.",
    "description": "Select from Today's Candidates and place tasks into open slots, matching needed durations against actual free time.",
    "benefits": [
      ["Carve out dedicated focus time.", "Drag candidates directly onto the timeline or use the Schedule button to find fitting openings."],
      ["Adjust smoothly as the day unfolds.", "Edit start times or drag edges to adjust length. The 15-minute grid keeps intervals neat and structured."],
      ["Mark done, or reschedule when needed.", "Check off finished tasks. Uncompleted items can be unscheduled, kept pending, or moved to tomorrow."]
    ],
    "faq": [
      [
        "How do scheduled times differ from deadlines?",
        "A scheduled time defines when you sit down to do the work; a deadline specifies when it must be delivered."
      ],
      [
        "What happens if a scheduled task is not finished today?",
        "You can leave it pending, remove it from the timeline, or roll it over to tomorrow's next open slot."
      ],
      [
        "How does scheduling work on mobile devices?",
        "Switch between task list and timeline views. Long-press to drag tasks, or use the Schedule button."
      ],
      [
        "Can I schedule tasks without dragging?",
        "Yes. Tap the Schedule button on any candidate, select start time and duration, and confirm."
      ],
      [
        "What if a task takes more or less time than planned?",
        "Edit duration directly in the inspector or drag the task block edge on the timeline."
      ],
      [
        "Do I have to leave gaps between tasks?",
        "No. Tasks can run back-to-back, or you can intentionally leave buffer slots for breaks and meals."
      ]
    ],
    "next": "ai"
  }
} satisfies Record<Language, FeatureCopy>;
