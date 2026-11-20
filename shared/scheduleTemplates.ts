import type { ScheduleTemplate } from "../src/types";

type BuiltInScheduleTemplateId = "school" | "study";
const SCHEDULE_TEMPLATES: Record<BuiltInScheduleTemplateId, {
  labelZh: string;
  labelEn: string;
  slots: { id: string; labelZh: string; labelEn: string; start: string; end: string }[];
}> = {
  school: {
    labelZh: "\u9ed8\u8ba4 1",
    labelEn: "Default 1",
    slots: [
      { id: "morning-1", labelZh: "第一节", labelEn: "Period 1", start: "08:00", end: "08:45" },
      { id: "morning-2", labelZh: "第二节", labelEn: "Period 2", start: "08:55", end: "09:40" },
      { id: "morning-3", labelZh: "第三节", labelEn: "Period 3", start: "10:00", end: "10:45" },
      { id: "morning-4", labelZh: "第四节", labelEn: "Period 4", start: "10:55", end: "11:40" },
      { id: "afternoon-1", labelZh: "下午一", labelEn: "Afternoon 1", start: "13:30", end: "14:15" },
      { id: "afternoon-2", labelZh: "下午二", labelEn: "Afternoon 2", start: "14:25", end: "15:10" },
      { id: "afternoon-3", labelZh: "下午三", labelEn: "Afternoon 3", start: "15:30", end: "16:15" },
      { id: "evening-review", labelZh: "晚间整理", labelEn: "Evening review", start: "19:30", end: "20:15" },
    ],
  },
  study: {
    labelZh: "\u9ed8\u8ba4 2",
    labelEn: "Default 2",
    slots: [
      { id: "deep-1", labelZh: "上午深度", labelEn: "Morning focus", start: "09:00", end: "10:30" },
      { id: "deep-2", labelZh: "上午巩固", labelEn: "Morning review", start: "10:45", end: "12:00" },
      { id: "deep-3", labelZh: "下午推进", labelEn: "Afternoon progress", start: "14:00", end: "15:30" },
      { id: "deep-4", labelZh: "输出整理", labelEn: "Output block", start: "15:45", end: "17:00" },
      { id: "deep-5", labelZh: "晚间收束", labelEn: "Evening close", start: "19:30", end: "20:30" },
    ],
  },
};

export const INITIAL_TEMPLATE_ID = "builtin:school";

export function isBuiltInScheduleTemplate(id: string): boolean {
  return id === INITIAL_TEMPLATE_ID || id === "builtin:study";
}

export function resolveScheduleTemplates(saved: ScheduleTemplate[], language: unknown): ScheduleTemplate[] {
  const zh = language === "zh";
  const defaults = (Object.keys(SCHEDULE_TEMPLATES) as BuiltInScheduleTemplateId[]).map((id) => {
    const key = "builtin:" + id;
    const row = SCHEDULE_TEMPLATES[id];
    const override = saved.find((template) => template.id === key);
    return override ?? {
      id: key,
      title: zh ? row.labelZh : row.labelEn,
      slots: row.slots.map(({ id, labelZh, labelEn, start, end }) => ({ id, label: zh ? labelZh : labelEn, start, end })),
      createdAt: "",
      updatedAt: "",
    };
  });
  return [...defaults, ...saved.filter((template) => !isBuiltInScheduleTemplate(template.id))];
}

export function upsertScheduleTemplate(saved: ScheduleTemplate[], next: ScheduleTemplate): ScheduleTemplate[] {
  return saved.some((template) => template.id === next.id)
    ? saved.map((template) => template.id === next.id ? next : template)
    : [...saved, next];
}
