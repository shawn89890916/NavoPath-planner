import type { Language, PlannerData, Task } from "./types";
import type { ProductFeature } from "./productSite";
import { getFreeSlots } from "./autoSchedule";
import {
  addDays,
  addMinutes,
  minutesToTime,
  timeToMinutes,
} from "./timelineGeometry";
import { scheduledTaskIntervalsOnDate } from "./utils/conflictLayout";
import { rescheduleTimelineRecord } from "./utils/timelineRecords";

export const DEMO_DATE = "2030-10-07";
export const DEMO_STAMP = `${DEMO_DATE}T08:00:00.000Z`;
export function createDemoData(
  lang: Language,
  feature: ProductFeature,
  stage: number,
): PlannerData {
  const zh = lang === "zh";
  const projects = [
    ["website", zh ? "推进个人网站" : "Build a personal website", "#7ea172"],
    ["learning", zh ? "学习数据分析" : "Learn data analysis", "#584d3d"],
    ["life", zh ? "运动" : "Exercise", "#d7816a"],
  ].map(([id, title, color], order) => ({
    id,
    title,
    color,
    order,
    category: "project" as const,
    notes: "",
    completed: false,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
  }));
  const task = (
    id: string,
    title: string,
    projectId: string,
    minutes: number,
    order: number,
  ): Task => ({
    id,
    title,
    projectId,
    estimatedHours: minutes / 60,
    dueDate: "",
    category: "project",
    priority: "medium",
    importance: "high",
    urgency: "low",
    notes: "",
    goalId: "",
    completed: false,
    workflowStatus: "backlog",
    order,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
  });
  const content = task(
    "content",
    zh ? "撰写个人介绍" : "Write your introduction",
    "website",
    45,
    0,
  );
  let data: PlannerData = {
    version: 1,
    importedSeedVersion: "product-demo",
    generatedAt: DEMO_STAMP,
    goals: [],
    projects,
    tasks: [
      content,
      task(
        "layout",
        zh ? "调整网站布局" : "Refine the website layout",
        "website",
        30,
        1,
      ),
      task(
        "lesson",
        zh ? "完成一节数据分析课程" : "Complete a data analysis lesson",
        "learning",
        30,
        2,
      ),
      task("walk", zh ? "散步与拉伸" : "Walk and stretch", "life", 30, 3),
      task("publish", zh ? "发布新版本" : "Publish the update", "website", 30, 4),
      task("notebook", zh ? "整理课程笔记" : "Review lesson notes", "learning", 30, 5),
      task("practice", zh ? "练习数据可视化" : "Practice data visualization", "learning", 45, 6),
      task("exercise", zh ? "完成力量训练" : "Strength training", "life", 30, 7),
    ],
    longTasks: [],
    events: [],
    notes: [],
    drafts: [],
    chat: [],
    aiMemories: [],
  };
  if (feature === "planning") {
    if (stage === 3)
      data.tasks[0] = {
        ...content,
        plannedForDate: DEMO_DATE,
        executionLane: "candidate",
      };
    return data;
  }
  if (feature === "execute") data.tasks.push(
    task("check", zh ? "完善网站页面" : "Polish the website pages", "website", 90, 8),
    task("lunch", zh ? "午餐与休息" : "Lunch and a break", "life", 60, 9),
  );
  data.tasks = data.tasks.map((item, index) => index >= 4 ? item : ({
    ...item,
    plannedForDate: DEMO_DATE,
    executionLane: "candidate",
  }));
  data = scheduleDemoTask(data, "notebook", DEMO_DATE, "09:00");
  if (feature === "execute" && stage === 2)
    data = scheduleDemoTask(data, "notebook", DEMO_DATE, "09:00", 60);
  if (feature === "execute" && stage >= 1)
    data = scheduleDemoTask(
      data,
      "content",
      DEMO_DATE,
      stage === 2 ? "10:00" : "09:30",
      90,
    );
  if (feature === "execute" && stage >= 1) {
    for (const [id, start] of [
      ["lunch", "12:00"], ["check", "13:00"], ["publish", "16:00"],
    ]) data = scheduleDemoTask(data, id, DEMO_DATE, start);
    data = scheduleDemoTask(data, "exercise", DEMO_DATE, "14:45", 60);
  }
  if (feature === "execute" && stage === 3)
    data.tasks = data.tasks.map((item) =>
      item.id === "content"
        ? {
            ...item,
            completed: true,
            executionStatus: "completed",
            timelineRecords: item.timelineRecords?.map((r) => ({
              ...r,
              executionStatus: "completed",
            })),
          }
        : item,
    );
  if (feature === "ai" && stage === 0)
    data.tasks[0] = {
      ...data.tasks[0],
      projectId: undefined,
      aiInference: {
        duration: {
          minutes: 45,
          source: "ai",
          confidence: 0.85,
          inferredAt: DEMO_STAMP,
          modelVersion: "demo",
        },
        project: {
          projectId: "website",
          source: "ai",
          confidence: 0.7,
          inferredAt: DEMO_STAMP,
          modelVersion: "demo",
        },
      },
    };
  return data;
}

export function scheduleDemoTask(
  data: PlannerData,
  taskId: string,
  date: string,
  start: string,
  duration?: number,
): PlannerData {
  const task = data.tasks.find((item) => item.id === taskId);
  if (
    !task ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):(00|15|30|45)$/.test(start)
  )
    return data;
  const minutes =
    duration ??
    Math.max(15, Math.round(((task.estimatedHours || 0.5) * 60) / 15) * 15);
  if (
    !Number.isFinite(minutes) ||
    minutes < 15 ||
    minutes % 15 ||
    timeToMinutes(start) + minutes > 18 * 60 ||
    timeToMinutes(start) < 8 * 60
  )
    return data;
  const end = addMinutes(start, minutes);
  if (
    scheduledTaskIntervalsOnDate(data.tasks.filter(item => item.id !== taskId), date).some(interval => timeToMinutes(start) < interval.end && timeToMinutes(end) > interval.start)
  )
    return data;
  const existing = task.timelineRecords?.find(
    (r) => r.executionStatus === "scheduled",
  );
  const record = existing
    ? rescheduleTimelineRecord(existing, date, start, minutes)
    : {
        id: `demo-${taskId}`,
        taskId,
        scheduledDate: date,
        scheduledStart: start,
        scheduledEnd: end,
        executionStatus: "scheduled" as const,
        createdAt: DEMO_STAMP,
      };
  return {
    ...data,
    tasks: data.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            estimatedHours: minutes / 60,
            scheduledDate: date,
            scheduledStart: start,
            scheduledEnd: end,
            plannedForDate: date,
            completed: false,
            executionStatus: "scheduled",
            timelineRecords: [record],
          }
        : item,
    ),
  };
}
export function firstDemoSlot(
  data: PlannerData,
  taskId: string,
  date = DEMO_DATE,
): string | null {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) return null;
  const duration = Math.max(
    15,
    Math.round(((task.estimatedHours || 0.5) * 60) / 15) * 15,
  );
  const slots = getFreeSlots({
    now: new Date(`${DEMO_DATE}T08:00:00`),
    dateRange: [date],
    scheduledEvents: scheduledTaskIntervalsOnDate(data.tasks.filter(item => item.id !== taskId), date).map((interval, index) => ({ id: `busy-${index}`, title: "", date, start: minutesToTime(interval.start), end: minutesToTime(interval.end) })),
    settings: {
      dayStart: "09:00",
      dayEnd: "18:00",
      bufferMinutes: 0,
      snapMinutes: 15,
    },
  });
  const slot = slots.find(
    (item) => item.endMinutes - item.startMinutes >= duration,
  );
  return slot ? minutesToTime(slot.startMinutes) : null;
}
export function rescheduleDemoTomorrow(
  data: PlannerData,
  taskId: string,
): PlannerData {
  const date = addDays(DEMO_DATE, 1),
    start = firstDemoSlot(data, taskId, date);
  return start ? scheduleDemoTask(data, taskId, date, start) : data;
}
