import type { Language } from "../types";
import { EmptyState } from "./EmptyState";
import { Button, CloseButton } from "./UiPrimitives";

export function OnboardingGuide({ lang, step, taskTitle, touch, onDraft, onSchedule, onSkip }: {
  lang: Language;
  step: "add" | "schedule";
  taskTitle?: string;
  touch: boolean;
  onDraft: (title: string) => void;
  onSchedule: () => void;
  onSkip: () => void;
}) {
  const zh = lang === "zh";
  if (step === "schedule") {
    return (
      <EmptyState announce title={zh ? "给这件事安排时间" : "Make time for this task"} description={touch
        ? (zh ? "选择开始时间，你也可以长按任务拖到时间轴。" : "Choose a time, or press and hold to drag it onto the timeline.")
        : (zh ? "选择开始时间，或把任务拖到时间轴。" : "Choose a time or drag the task onto the timeline.")}>
        <Button variant="primary" onClick={onSchedule} aria-label={taskTitle ? (zh ? `安排「${taskTitle}」` : `Schedule “${taskTitle}”`) : undefined}>{zh ? "安排时间" : "Schedule time"}</Button>
        <Button variant="ghost" onClick={onSkip}>{zh ? "跳过教程" : "Skip guide"}</Button>
      </EmptyState>
    );
  }
  const starters = zh ? ["整理桌面", "回复一条消息", "读两页书"] : ["Tidy my desk", "Reply to a message", "Read two pages"];
  return (
    <EmptyState title={zh ? "先写下一件小事" : "Start with one small task"} description={zh ? "选一个例子带入编辑框，改成你今天想做的事。" : "Pick an example and make it something you want to do today."}>
      {starters.map((title) => <Button key={title} onClick={() => onDraft(title)}>{title}</Button>)}
      <Button variant="primary" onClick={() => onDraft("")}>{zh ? "自己写一条" : "Write my own"}</Button>
      <Button variant="ghost" onClick={onSkip}>{zh ? "跳过教程" : "Skip guide"}</Button>
    </EmptyState>
  );
}

export function OnboardingComplete({ lang, onViews, onPlugins, onMcp, onApi, onClose }: {
  lang: Language;
  onViews: () => void;
  onPlugins: () => void;
  onMcp: () => void;
  onApi: () => void;
  onClose: () => void;
}) {
  const zh = lang === "zh";
  return (
    <EmptyState announce title={zh ? "第一件事已排进时间轴" : "Your first task is on the timeline"} description={zh
      ? "在「任务 ▾」切换视图。你也可以在设置里添加插件、连接 MCP 或配置 AI API。"
      : "Switch views from Tasks ▾. In Settings, you can add plugins, connect MCP, or configure an AI API."}>
      <Button onClick={onViews}>{zh ? "查看任务视图" : "Explore task views"}</Button>
      <Button variant="text" onClick={onPlugins}>{zh ? "插件" : "Plugins"}</Button>
      <Button variant="text" onClick={onMcp}>MCP</Button>
      <Button variant="text" onClick={onApi}>AI API</Button>
      <CloseButton label={zh ? "关闭教程提示" : "Dismiss guide"} onClick={onClose} />
    </EmptyState>
  );
}
