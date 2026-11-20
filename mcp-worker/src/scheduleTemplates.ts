import { z } from "zod";
import { isBuiltInScheduleTemplate, resolveScheduleTemplates, upsertScheduleTemplate } from "../../shared/scheduleTemplates.ts";
import type { ScheduleTemplate } from "../../src/types";
import { tombstoneTime } from "../../shared/workspaceMerge.ts";
import { hasScheduleTemplateAccess } from "./pluginMcp.ts";

export const templateTitle = z.string().trim().min(1).max(10_000);
export const templateId = z.string().min(1).max(200);
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const templateSlots = z.array(z.strictObject({
  id: templateId.optional(),
  label: templateTitle,
  start: clock,
  end: clock,
})).min(1).max(500);

type Slots = z.infer<typeof templateSlots>;
type Workspace = Record<string, any>;
type State = { data: Workspace; settings: Record<string, unknown> };

function readTemplates({ data, settings }: State) {
  if (!hasScheduleTemplateAccess(settings)) throw new Error("Schedule Templates MCP access is disabled in NavoPath.");
  const saved = Array.isArray(data.scheduleTemplates) ? data.scheduleTemplates as ScheduleTemplate[] : [];
  return { saved, templates: resolveScheduleTemplates(saved, settings.language) };
}

export function listScheduleTemplates(profile: State, id: string | undefined, offset: number, limit: number) {
  const { templates } = readTemplates(profile);
  if (id !== undefined) return { template: findTemplate(templates, id) };
  return {
    total: templates.length,
    templates: templates.slice(offset, offset + limit).map(({ id, title, slots, updatedAt }) => ({
      id, title, blockCount: slots.length, updatedAt, builtIn: isBuiltInScheduleTemplate(id),
    })),
  };
}

function findTemplate(templates: ScheduleTemplate[], id: string) {
  const template = templates.find((item) => item.id === id);
  if (!template) throw new Error("Schedule template not found");
  return template;
}

function prepareSlots(slots: Slots, makeSlotId: () => string): ScheduleTemplate["slots"] {
  const next = slots.map((slot) => ({ ...slot, id: slot.id ?? makeSlotId() }));
  if (new Set(next.map(({ id }) => id)).size !== next.length) throw new Error("Schedule template block IDs must be unique");
  return next;
}

export function createScheduleTemplate(profile: State, input: { id: string; title: string; slots: Slots }, stamp: string, makeSlotId: () => string) {
  const { saved } = readTemplates(profile);
  const existing = saved.find((item) => item.id === input.id);
  if (existing) return { template: existing, data: undefined };
  if (tombstoneTime(profile.data.sync?.deleted?.["scheduleTemplates:" + input.id], Date.parse(stamp)) !== null) {
    throw new Error("This idempotency key was already used for a template that was deleted. Use a new key.");
  }
  const template = { id: input.id, title: input.title, slots: prepareSlots(input.slots, makeSlotId), createdAt: stamp, updatedAt: stamp };
  return { template, data: { ...profile.data, scheduleTemplates: upsertScheduleTemplate(saved, template) } };
}

export function updateScheduleTemplate(profile: State, input: { id: string; title?: string; slots?: Slots; expectedUpdatedAt?: string }, stamp: string, makeSlotId: () => string) {
  const { saved, templates } = readTemplates(profile);
  const current = findTemplate(templates, input.id);
  if (input.expectedUpdatedAt !== undefined && current.updatedAt !== input.expectedUpdatedAt) {
    throw new Error("Schedule template changed. Reload it before editing.");
  }
  if (input.title === undefined && input.slots === undefined) throw new Error("Provide a title or blocks to update");
  const template = {
    ...current,
    title: input.title ?? current.title,
    slots: input.slots ? prepareSlots(input.slots, makeSlotId) : current.slots,
    createdAt: current.createdAt || stamp,
    updatedAt: stamp,
  };
  return { template, data: { ...profile.data, scheduleTemplates: upsertScheduleTemplate(saved, template) } };
}
