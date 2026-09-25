import type { Subtask } from "../types";
import type { AiAction } from "../aiAssistantApi";

export type AiSubtaskSuggestion = { title?: string; estimateMinutes?: number };

export function getAiSubtaskSuggestions(actions: AiAction[] | undefined, taskId: string): AiSubtaskSuggestion[] {
  const action = actions?.find((item) => item.type === "create_subtasks" && item.taskId === taskId);
  if (!action || action.type !== "create_subtasks" || !Array.isArray(action.subtasks)) return [];
  return action.subtasks.filter((subtask) => typeof subtask.title === "string" && Boolean(subtask.title.trim()));
}

export function appendAiSubtasks(
  existing: Subtask[] | undefined,
  suggestions: AiSubtaskSuggestion[] | undefined,
  createId: () => string,
  createdAt: string,
): Subtask[] {
  const current = existing || [];
  const seen = new Set(current.map((subtask) => subtask.title.trim().toLocaleLowerCase()));
  const additions: Subtask[] = [];

  for (const suggestion of suggestions || []) {
    const title = suggestion.title?.trim();
    const key = title?.toLocaleLowerCase();
    if (!title || !key || seen.has(key)) continue;
    seen.add(key);
    additions.push({
      id: createId(),
      title,
      completed: false,
      done: false,
      order: current.length + additions.length,
      subtasks: [],
      createdAt,
    });
  }

  return [...current, ...additions];
}
