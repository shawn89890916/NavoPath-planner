import type { Language } from "./types";

export type TermKey =
  | "planning"
  | "execute"
  | "todayCandidates"
  | "schedule"
  | "timeline"
  | "task"
  | "event"
  | "project"
  | "done"
  | "complete"
  | "incomplete"
  | "apply"
  | "unschedule"
  | "delete"
  | "navoAi"
  | "aiAgent";

export type ProductTerm = {
  zh: string;
  en: string;
  definition: string;
  avoid: string[];
  example: string;
};

export const TERM_CATALOG: Record<TermKey, ProductTerm> = {
  planning: { zh: "规划", en: "Planning", definition: "管理项目、任务和长期安排。", avoid: ["Plan", "计划"], example: "打开规划，整理长期项目。" },
  execute: { zh: "执行", en: "Execute", definition: "完成今天已经选定的工作。", avoid: ["工作台", "Focus"], example: "在执行中完成今日任务。" },
  todayCandidates: { zh: "今日候选", en: "Today's Candidates", definition: "已选中今天推进、尚未放入具体时间的任务。", avoid: ["Queue", "Inbox", "待办"], example: "从规划加入今日候选。" },
  schedule: { zh: "安排", en: "Schedule", definition: "将任务放入具体时间段。", avoid: ["Plan", "Adopt", "计划"], example: "安排任务到 10:00。" },
  timeline: { zh: "时间轴", en: "Timeline", definition: "展示时间安排的时间网格。", avoid: ["Calendar", "日历"], example: "在时间轴上查看安排。" },
  task: { zh: "任务", en: "Task", definition: "需要完成的可执行事项。", avoid: ["Event", "事项"], example: "创建任务并设置时长。" },
  event: { zh: "事件", en: "Event", definition: "日历中的时间事项，不包含任务完成流程。", avoid: ["Task", "任务"], example: "将会议保存为事件。" },
  project: { zh: "项目", en: "Project", definition: "承载一组长期任务的工作单元。", avoid: ["Category", "分类"], example: "将任务归入项目。" },
  done: { zh: "已完成", en: "Done", definition: "任务或时间块已经完成的状态。", avoid: ["Complete", "Completed"], example: "显示已完成任务。" },
  complete: { zh: "完成", en: "Complete", definition: "将任务或时间块标记为完成的动作。", avoid: ["Done", "Finish"], example: "点击完成。" },
  incomplete: { zh: "未完成", en: "Incomplete", definition: "任务或时间块尚未完成的状态。", avoid: ["Unfinished"], example: "处理未完成任务。" },
  apply: { zh: "应用", en: "Apply", definition: "接受 AI 生成的安排或操作。", avoid: ["Adopt", "Confirm all"], example: "应用这份安排。" },
  unschedule: { zh: "取消安排", en: "Unschedule", definition: "保留任务并移除时间轴安排。", avoid: ["Delete", "Remove"], example: "取消安排后任务仍保留。" },
  delete: { zh: "删除", en: "Delete", definition: "永久删除任务、项目或数据。", avoid: ["Remove", "Unschedule"], example: "删除项目及其数据。" },
  navoAi: { zh: "Navo AI", en: "Navo AI", definition: "普通 AI 对话入口。", avoid: ["Assistant", "Agent"], example: "向 Navo AI 提问。" },
  aiAgent: { zh: "AI 助理", en: "AI Agent", definition: "能读取工作区并执行操作的 AI。", avoid: ["Chat", "普通对话"], example: "AI 助理会先请求确认高风险操作。" },
};

export function term(lang: Language, key: TermKey): string {
  return TERM_CATALOG[key][lang];
}
