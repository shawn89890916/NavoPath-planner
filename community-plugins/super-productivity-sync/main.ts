import type { PluginContext, PluginModule } from "../../src/extensions/types";
import type { PlannerData, Project, Task, TimelineRecord } from "../../src/types";
import { mountIsolatedPluginSurface } from "../../src/extensions/pluginSurface";
import { createInitialPreviewView } from "./preview";
import { selectTimedSlot, durationMinutes, validSlot, hasRecordedTimedSlot, isReadOnlyHistoryNote } from "./schedule";

type LinkStore = { projects: Record<string, string>; tasks: Record<string, string>; tombstones: Record<string, { kind: "task" | "project"; item: Task | Project; deletedAt: string; taskIds?: string[]; parentSyncId?: string; restoring?: boolean; restoreId?: string }> };
type Entity = { id: string; syncId?: string; parentId?: string; projectId?: string; fields: Record<string, any> };
type RemoteAction = { syncId: string; kind: "project" | "task"; id?: string; fields: Record<string, any>; deleted?: boolean };
const STORAGE = "connection-state";

function projectFields(item: Project) { return { title: item.title, notes: item.notes || "", color: item.color || null, category: item.category || "" }; }
function taskFields(item: Task, projects: Project[]) {
  const block = selectTimedSlot(item)?.record;
  const scheduledMinutes = block ? durationMinutes(block) : 0;
  return {
    title: item.title, notes: item.notes || "", completed: item.completed, dueDate: item.dueDate || null,
    estimateMinutes: block ? scheduledMinutes : Math.round((item.estimatedHours || 0) * 60), projectTitle: projects.find(project => project.id === item.projectId)?.title || "",
    scheduledAt: block ? `${block.scheduledDate}T${block.scheduledStart}` : null,
    scheduledMinutes,
  };
}
function minutes(value: string) { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; }

const plugin: PluginModule = { onload(ctx: PluginContext) {
  // One sync runtime per loaded plugin, independent of the settings page.
  const container = document.createElement("div");
  {
    let links: LinkStore = { projects: {}, tasks: {}, tombstones: {} };
    let lastPersisted = "";
    let pairId = ""; let pairingCode = ""; let status = ""; let busy = false; let lastError = ""; let running = false; let lastSuccess = ""; let lastApplied = 0; let lastSnapshot = "";
    const api = ctx.integrations?.superProductivity as (NonNullable<NonNullable<PluginContext["integrations"]>["superProductivity"]> & { commitBatch?: (pairId: string, before: Pick<PlannerData, "tasks" | "projects">, after: Pick<PlannerData, "tasks" | "projects">) => Promise<void> }) | undefined;
    const zh = String(ctx.app.getSettings().language || ctx.language).startsWith("zh");
    const t = (cn: string, en: string) => zh ? cn : en;
    let previewView: ReturnType<typeof createInitialPreviewView> | undefined;
    let previewKey = "";
    let pauseReason = "";
    const surface = mountIsolatedPluginSurface(container, `
      .nvp-sp-sync { width: 100%; max-width: 920px; margin-inline: auto; padding: 16px clamp(12px, 3vw, 24px) 24px; display: grid; gap: 16px; }
      p, h2 { margin: 0; }
      p { color: var(--p-muted); }
      h2 { font-size: 17px; font-weight: 650; }
      .nvp-sp-sync-pairing { display: grid; justify-items: start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--p-rule); }
      .nvp-sp-sync-code-row, .nvp-sp-sync-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      code { flex: 1 1 260px; overflow-wrap: anywhere; padding: 8px 10px; border: 1px solid var(--p-rule); }
      .nvp-sp-sync-status { padding: 7px 10px; border-left: 2px solid var(--p-border); overflow-wrap: anywhere; }
      button[aria-pressed="true"] { color: var(--p-on-accent); background: var(--p-accent); border-color: var(--p-accent); }
      button:active:not(:disabled) { transform: translateY(1px); }
      .nvp-sp-sync-status[aria-busy="true"] { border-left-color: var(--p-accent); }
      .nvp-sp-sync-status.is-error { border-left-color: currentColor; color: var(--text-danger, #a13d32); }
      .nvp-sp-sync-details, .import-preview, .nvp-sp-sync-conflict { display: grid; gap: 12px; overflow-wrap: anywhere; }
      .import-summary { padding: 10px 0; border-block: 1px solid var(--p-rule); color: var(--p-text); font-variant-numeric: tabular-nums; }
      details { border-bottom: 1px solid var(--p-rule); padding: 7px 0; }
      details details { margin-inline-start: 12px; border: 0; }
      summary { cursor: pointer; font-weight: 600; padding: 8px 0; }
      .import-row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--p-rule); }
      .import-row label { flex: 1 1 180px; display: flex; align-items: center; gap: 8px; }
      input[type=checkbox] { flex: 0 0 auto; width: 18px; height: 18px; accent-color: var(--p-accent); }
      input[type=search] { width: 100%; }
      ul { margin: 0; padding-inline-start: 24px; max-height: 250px; overflow: auto; }
      li { padding-block: 4px; }
      @media (max-width: 560px) { .nvp-sp-sync-actions > button { flex: 1 1 140px; } }
    `);
    const panel = surface.content; panel.classList.add("nvp-sp-sync");
    const registerPage = (name: string, mount: (element: HTMLElement) => () => void) => {
      const legacy = (ctx.ui as typeof ctx.ui & { registerPage?: typeof ctx.settings.registerPage }).registerPage;
      return legacy ? legacy.call(ctx.ui, name, mount) : ctx.settings.registerPage(name, mount);
    };
    if (!api) {
      const notice = document.createElement("p");
      notice.textContent = t("当前版本缺少同步接口，请更新 NavoPath。", "This version lacks the sync API. Update NavoPath.");
      panel.append(notice);
      const off = registerPage("Super Productivity Sync", mount => { mount.append(container); return () => container.remove(); });
      return () => { off(); surface.dispose(); container.remove(); };
    }
    const description = document.createElement("p"); description.textContent = zh ? "连接后同步全部项目和任务。首次导入会先预览；冲突由你选择。" : "Sync all projects and tasks. Review the first import and choose how to resolve conflicts.";
    const connect = document.createElement("button"); connect.type = "button"; connect.dataset.variant = "primary"; connect.textContent = zh ? "生成配对码" : "Create pairing code";
    const code = document.createElement("code"); code.hidden = true;
    const copy = document.createElement("button"); copy.type = "button"; copy.textContent = zh ? "复制配对码" : "Copy pairing code"; copy.hidden = true;
    const pairing = document.createElement("div"); pairing.className = "nvp-sp-sync-pairing"; pairing.append(description, connect);
    const codeRow = document.createElement("div"); codeRow.className = "nvp-sp-sync-code-row"; codeRow.append(code, copy);
    const line = document.createElement("p"); line.className = "nvp-sp-sync-status"; line.setAttribute("role", "status"); line.setAttribute("aria-live", "polite");
    const details = document.createElement("div"); details.className = "nvp-sp-sync-details";
    const actions = document.createElement("div"); actions.className = "nvp-sp-sync-actions";
    const refresh = document.createElement("button"); refresh.type = "button";  refresh.textContent = zh ? "立即同步" : "Sync now";
    refresh.hidden = true;
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = zh ? "确认首次导入" : "Confirm initial import"; confirm.hidden = true;
    const disconnect = document.createElement("button"); disconnect.type = "button"; disconnect.textContent = zh ? "断开连接" : "Disconnect"; disconnect.hidden = true;
    actions.append(refresh, confirm, disconnect);
    confirm.dataset.variant = "primary";
    panel.append(line, pairing, codeRow, actions, details);
    const persist = async () => {
      const value = { links, pairId };
      const serialized = JSON.stringify(value);
      if (serialized !== lastPersisted) { await ctx.storage.set(STORAGE, value); lastPersisted = serialized; }
    };
    const getState = async () => api!.request(`/state${pairId ? `?pairId=${encodeURIComponent(pairId)}` : ""}`);
    const discoverConnection = async () => { try { displayState(await api.request("/state")); } catch { /* No connection exists until a pairing code is redeemed. */ } };
    const finishRestore = async (syncId: string, saved: LinkStore["tombstones"][string]) => {
      let id = saved.restoreId;
      if (!id) {
        if (saved.restoring) throw new Error(t("恢复中断，需要手动检查，避免重复创建。", "Interrupted restore needs manual review; no duplicate was created."));
        const original = saved.item as Task;
        const parentTaskId = saved.parentSyncId ? Object.keys(links.tasks).find(key => links.tasks[key] === saved.parentSyncId) : original.parentTaskId;
        if (saved.kind === "task" && original.parentTaskId && (!parentTaskId || !ctx.tasks.get(parentTaskId))) throw new Error(t("请先恢复父任务。", "Restore the parent task first."));
        saved.restoring = true; await persist();
        if (saved.kind === "project") {
          const project = await ctx.projects.create({ ...(saved.item as Project), id: undefined } as unknown as Omit<Project, "id">);
          id = project.id;
        } else {
          const task = await ctx.tasks.create({ ...original, id: undefined, parentTaskId, timelineRecords: [] } as unknown as Omit<Task, "id">);
          id = task.id;
        }
        saved.restoreId = id; await persist();
      }
      if (saved.kind === "project") {
        if (!ctx.projects.get(id)) throw new Error(t("恢复的项目已不存在。", "Restored project no longer exists."));
        for (const taskId of saved.taskIds || []) {
          const task = ctx.tasks.get(taskId);
          if (task && !task.projectId) await ctx.tasks.update(taskId, { projectId: id });
        }
        links.projects[id] = syncId;
      } else {
        if (!ctx.tasks.get(id)) throw new Error(t("恢复的任务已不存在。", "Restored task no longer exists."));
        const original = saved.item as Task;
        await ctx.tasks.update(id, { timelineRecords: (original.timelineRecords || []).map(record => ({ ...record, taskId: id })) });
        links.tasks[id] = syncId;
      }
      await persist();
      await api.request("/restore", "POST", { pairId, syncId, localId: id });
      delete links.tombstones[syncId]; await persist();
    };
    const displayState = (state: any) => {
      pairId = state.pairId || pairId; status = state.status || "waiting"; pauseReason = state.pauseReason || "";
      pairing.hidden = status === "preview"; codeRow.hidden = status === "preview" || !pairingCode;
      connect.textContent = pairId ? t("为另一设备生成配对码", "Pair another device") : t("生成配对码", "Create pairing code");
      disconnect.hidden = !pairId; refresh.hidden = !pairId || status === "preview" || status === "paused";
      confirm.hidden = status !== "preview";
      if (status === "preview" && state.preview) {
        const key = JSON.stringify(state.preview);
        if (previewView && key === previewKey) { renderStatus(); return; }
        const previous = previewView?.selections(), previousMode = previewView?.mode();
        previewView = createInitialPreviewView(state.preview, zh, previous, previousMode);
        previewKey = key;
        details.replaceChildren(previewView.root);
      } else { previewView = undefined; previewKey = ""; details.replaceChildren(); }
      const now = Date.now();
      for (const [syncId, item] of Object.entries(links.tombstones)) {
        const saved = item;
        if (!saved.restoring && now - Date.parse(saved.deletedAt) > 30 * 86400_000) { delete links.tombstones[syncId]; continue; }
        if (!saved.restoring && (saved.kind === "task" ? ctx.tasks.get(saved.item.id) : ctx.projects.get(saved.item.id))) continue;
        const row = document.createElement("div"); const text = document.createElement("span"); text.textContent = `${saved.item.title} · ${zh ? "可恢复" : "Restorable"}`;
        const restore = document.createElement("button"); restore.type = "button"; restore.textContent = zh ? "恢复" : "Restore";
        restore.onclick = () => {
          if (busy) return; busy = true; lastError = ""; renderStatus();
          void finishRestore(syncId, saved).catch(error => { lastError = String(error); }).finally(() => { busy = false; renderStatus(); if (!lastError) void sync(); });
        };
        row.append(text, restore); details.append(row);
      }
      for (const conflict of state.conflicts || []) {
        const row = document.createElement("div"); row.className = "nvp-sp-sync-conflict";
        const text = document.createElement("strong"); text.textContent = `${conflict.kind}: ${conflict.field}`;
        const navopathValue = document.createElement("p"); navopathValue.textContent = `NavoPath: ${JSON.stringify(conflict.navopath)}`;
        const spValue = document.createElement("p"); spValue.textContent = `Super Productivity: ${JSON.stringify(conflict.superproductivity)}`;
        row.append(text, navopathValue, spValue);
        for (const [side, label] of [["navopath", "Use NavoPath"], ["superproductivity", "Use Super Productivity"]] as const) {
          const button = document.createElement("button"); button.type = "button"; button.textContent = label;
          button.onclick = () => {
            if (busy) return;
            button.setAttribute("aria-pressed", "true");
            for (const control of row.querySelectorAll("button")) control.disabled = true;
            busy = true; lastError = ""; renderStatus();
            void api.request("/resolve", "POST", { pairId, conflictId: conflict.id, chosen: side })
              .then(displayState).catch(error => { lastError = String(error); renderStatus(); })
              .finally(() => { busy = false; renderStatus(); if (!lastError) void sync(); else { for (const control of row.querySelectorAll("button")) control.disabled = false; button.setAttribute("aria-pressed", "false"); } });
          };
          row.append(button);
        }
        details.append(row);
      }
      renderStatus();
    };
    const renderStatus = () => {
      const labels: Record<string, string> = { waiting: t("等待另一端上传数据", "Waiting for the other app"), preview: t("已连接 · 等待确认首次导入", "Connected · review first import"), active: t("已连接 · 自动同步", "Connected · automatic sync"), paused: pauseReason === "history-feedback" ? t("已暂停 · 检测到历史日历回流，请先修复异常数据", "Paused · read-only calendar feedback detected; repair affected records first") : t("已暂停 · 撤销后请断开并重新配对", "Paused after undo · disconnect and pair again") };
      line.textContent = lastError || (pairId ? (labels[status] || t("已连接", "Connected")) + (busy ? t(" · 同步中", " · syncing") : "") : t("尚未配对", "Not paired"));
      if (pairId && !busy && !lastError && lastSuccess && status === "active") line.textContent += t(` · 上次同步 ${lastSuccess} · 应用 ${lastApplied} 项更改`, ` · Last sync ${lastSuccess} · ${lastApplied} changes applied`);
      line.setAttribute("aria-busy", String(busy));
      line.classList.toggle("is-error", Boolean(lastError));
      refresh.textContent = busy ? t("同步中…", "Syncing…") : t("立即同步", "Sync now");
      confirm.textContent = busy ? t("处理中…", "Working…") : t("确认首次导入", "Confirm initial import");
      confirm.disabled = busy; refresh.disabled = busy; disconnect.disabled = busy;
    };
    const ensureMappings = (assignments: Array<{ kind: "project" | "task"; id: string; syncId: string }>) => {
      for (const item of assignments) (item.kind === "task" ? links.tasks : links.projects)[item.id] = item.syncId;
    };
    const snapshot = (): { projects: Entity[]; tasks: Entity[]; overwriteVersion: 1; hierarchyVersion: 1 } => {
      const projects = ctx.projects.list();
      return {
        overwriteVersion: 1,
        hierarchyVersion: 1,
        projects: projects.map(item => ({ id: item.id, syncId: links.projects[item.id], fields: projectFields(item) })),
        tasks: ctx.tasks.list().map(item => ({ id: item.id, syncId: links.tasks[item.id], parentId: item.parentTaskId, projectId: item.projectId, fields: taskFields(item, projects) })),
      };
    };
    const apply = async (actions: RemoteAction[]) => {
      if (!actions.length) { await persist(); return; }
      if (actions.some(action => action.kind === "task" && isReadOnlyHistoryNote(action.fields.notes))) {
        await api.request("/pause", "POST", { pairId });
        throw new Error(t("检测到只读历史日历回流，已暂停连接。", "Read-only calendar feedback detected; connection paused."));
      }
      const currentData = ctx.app.getData();
      const before = { tasks: currentData.tasks, projects: currentData.projects };
      const draft = { tasks: [...before.tasks], projects: [...before.projects] };
      const previousLinks = structuredClone(links);
      // Stage the whole incoming batch without mutating live task state.
      const collection = <T extends Task | Project>(key: "tasks" | "projects") => ({
        list: () => draft[key] as T[],
        get: (id: string) => (draft[key] as T[]).find(item => item.id === id),
        create: async (value: Partial<T>) => { const item = { ...value, id: crypto.randomUUID(), updatedAt: new Date().toISOString() } as T; (draft[key] as T[]).push(item); return item; },
        update: async (id: string, patch: Partial<T>) => { const values = draft[key] as T[]; const index = values.findIndex(item => item.id === id); if (index >= 0) values[index] = { ...values[index], ...patch, id, updatedAt: new Date().toISOString() }; },
        remove: async (id: string) => { const values = draft[key] as T[]; const index = values.findIndex(item => item.id === id); if (index >= 0) values.splice(index, 1); },
      });
      const taskStore = collection<Task>("tasks"), projectStore = collection<Project>("projects");
      const failures: string[] = [];
      try {
      const projectIds = new Map(projectStore.list().map(item => [item.title, item.id]));
      for (const action of actions) {
        const map = action.kind === "task" ? links.tasks : links.projects;
        const currentId = Object.keys(map).find(id => map[id] === action.syncId) || action.id;
        if (action.deleted) {
          if (action.kind === "task") {
            const current = taskStore.get(currentId || "");
            if (current) {
              if (taskStore.list().some(task => task.parentTaskId === current.id)) { failures.push(t("仍有子任务，无法删除父任务。", "Retained subtasks prevent parent deletion.")); continue; }
              links.tombstones[action.syncId] = { kind: "task", item: current, deletedAt: new Date().toISOString(), parentSyncId: current.parentTaskId ? links.tasks[current.parentTaskId] : undefined };
              await taskStore.remove(current.id);
            }
          }
          else { const current = projectStore.get(currentId || ""); if (current) { const taskIds = taskStore.list().filter(task => task.projectId === current.id).map(task => task.id); links.tombstones[action.syncId] = { kind: "project", item: current, deletedAt: new Date().toISOString(), taskIds }; for (const taskId of taskIds) await taskStore.update(taskId, { projectId: undefined }); await projectStore.remove(current.id); } }
          delete map[currentId || ""]; continue;
        }
        if (action.kind === "project") {
          const value = { id: currentId || "", title: action.fields.title || "Imported project", category: action.fields.category || "project", notes: action.fields.notes || "", color: action.fields.color || undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Project;
          if (currentId && projectStore.get(currentId)) {
            const current = projectStore.get(currentId)!;
            const patch: Partial<Project> = {};
            if (Object.hasOwn(action.fields, "title")) patch.title = action.fields.title || current.title;
            if (Object.hasOwn(action.fields, "color")) patch.color = action.fields.color || undefined;
            await projectStore.update(currentId, patch);
            if (patch.title) { projectIds.delete(current.title); projectIds.set(patch.title, currentId); }
          }
          else { const created = await projectStore.create(value); map[created.id] = action.syncId; projectIds.set(created.title, created.id); }
          continue;
        }
        const fields = action.fields;
        const projectId = projectIds.get(fields.projectTitle || "");
        const current = currentId ? taskStore.get(currentId) : undefined;
        const patch: Partial<Task> = current ? {} : { title: "Imported task", notes: "", completed: false, dueDate: "", estimatedHours: 0 };
        if (Object.hasOwn(fields, "parentSyncId")) {
          const parentId = fields.parentSyncId == null ? undefined : Object.keys(links.tasks).find(id => links.tasks[id] === fields.parentSyncId);
          const parent = parentId ? taskStore.get(parentId) : undefined;
          if (fields.parentSyncId != null && !parent) { failures.push(t("父任务尚未同步。", "Parent task is not available yet.")); continue; }
          const seen = new Set<string>(currentId ? [currentId] : []);
          let ancestor = parent;
          let invalid = false;
          while (ancestor) {
            if (seen.has(ancestor.id)) { invalid = true; break; }
            seen.add(ancestor.id);
            ancestor = ancestor.parentTaskId ? taskStore.get(ancestor.parentTaskId) : undefined;
          }
          if (invalid) { failures.push(t("检测到循环父子关系。", "Cyclic parent relationship.")); continue; }
          patch.parentTaskId = parentId;
          if (parent) patch.projectId = parent.projectId;
        }
        if (Object.hasOwn(fields, "title")) patch.title = fields.title || "Imported task";
        if (Object.hasOwn(fields, "notes")) patch.notes = fields.notes || "";
        if (Object.hasOwn(fields, "completed")) patch.completed = fields.completed === true;
        if (Object.hasOwn(fields, "dueDate")) patch.dueDate = fields.dueDate || "";
        if (Object.hasOwn(fields, "estimateMinutes")) patch.estimatedHours = Math.max(0, Number(fields.estimateMinutes || 0) / 60);
        if (Object.hasOwn(fields, "projectTitle") && !patch.parentTaskId && !(current?.parentTaskId && !Object.hasOwn(fields, "parentSyncId"))) patch.projectId = projectId;
        const scheduleChanged = Object.hasOwn(fields, "scheduledAt") || Object.hasOwn(fields, "scheduledMinutes");
        if (scheduleChanged) {
          const records = [...(current?.timelineRecords || [])];
          const nearest = current ? selectTimedSlot(current) : undefined;
          const nearestIndex = nearest?.index ?? -1;
          const previousBlock = nearest?.record;
          const scheduledAt = Object.hasOwn(fields, "scheduledAt") ? fields.scheduledAt : previousBlock ? `${previousBlock.scheduledDate}T${previousBlock.scheduledStart}` : null;
          if (!scheduledAt) {
            if (nearestIndex >= 0) records.splice(nearestIndex, 1);
          } else if (typeof scheduledAt === "string" && scheduledAt.length === 16 && validSlot(scheduledAt.slice(0, 10), scheduledAt.slice(11, 16))) {
            const date = scheduledAt.slice(0, 10); const start = scheduledAt.slice(11, 16);
            const previousDuration = current ? taskFields(current, []).scheduledMinutes : 0;
            const duration = Math.max(1, Math.round(Number(fields.scheduledMinutes || previousDuration || fields.estimateMinutes || 60)));
            const endMinutes = minutes(start) + duration;
            const end = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
            const old = nearestIndex >= 0 ? records[nearestIndex] : undefined;
            const endDate = new Date(Date.parse(`${date}T00:00:00Z`) + Math.floor(endMinutes / 1440) * 86400000).toISOString().slice(0, 10);
            const next: TimelineRecord = { id: old?.id || crypto.randomUUID(), taskId: current?.id || "", scheduledDate: date, scheduledStart: start, scheduledEndDate: endDate, scheduledEnd: end, executionStatus: "scheduled", createdAt: old?.createdAt || new Date().toISOString() };
            if (nearestIndex >= 0) records[nearestIndex] = next;
            else if (!current || !hasRecordedTimedSlot(current, date, start, duration)) records.push(next);
          } else {
            // Malformed legacy remote schedules must not abort unrelated tasks.
            // Leave the local schedule intact until the source sends a valid slot.
            if (current) await taskStore.update(current.id, patch);
            else { const created = await taskStore.create({ ...patch, category: "task", goalId: "", createdAt: new Date().toISOString(), order: taskStore.list().length } as Omit<Task, "id">); map[created.id] = action.syncId; }
            continue;
          }
          patch.timelineRecords = records;
          if (nearest?.index === -1) { patch.scheduledDate = undefined; patch.scheduledStart = undefined; patch.scheduledEnd = undefined; patch.executionStatus = undefined; }
        }
        if (current) await taskStore.update(current.id, patch);
        else {
          const { timelineRecords, ...initialPatch } = patch;
          const created = await taskStore.create({ ...initialPatch, category: "task", goalId: "", createdAt: new Date().toISOString(), order: taskStore.list().length } as Omit<Task, "id">);
          map[created.id] = action.syncId;
          if (timelineRecords?.length) await taskStore.update(created.id, { timelineRecords: timelineRecords.map(record => ({ ...record, taskId: created.id })) });
        }
      }
      // Normalize only descendants of relationships/projects touched by this batch.
      const beforeById = new Map(before.tasks.map(task => [task.id,task]));
      const changed = new Set(taskStore.list().filter(task => {
        const old = beforeById.get(task.id);
        return !old || old.parentTaskId !== task.parentTaskId || old.projectId !== task.projectId;
      }).map(task => task.id));
      for (const task of taskStore.list()) if (task.parentTaskId) {
        const seen = new Set([task.id]); let parent = taskStore.get(task.parentTaskId);
        let affected = changed.has(task.id);
        while (parent?.parentTaskId && !seen.has(parent.id)) { seen.add(parent.id); affected ||= changed.has(parent.id); parent = taskStore.get(parent.parentTaskId); }
        if (parent && !seen.has(parent.id) && (affected || changed.has(parent.id)) && task.projectId !== parent.projectId) await taskStore.update(task.id, { projectId: parent.projectId });
      }
      // Recheck cloud pause and local base before committing (including old host fallback).
      const connection = await getState();
      if (connection.status !== "active" || connection.pairId !== pairId) throw new Error(t("连接已暂停或改变，本轮未应用。", "Connection paused or changed; batch not applied."));
      if (api.commitBatch) await api.commitBatch(pairId, before, draft);
      else {
        const latest = ctx.app.getData();
        if (latest.tasks !== before.tasks || latest.projects !== before.projects) throw new Error(t("任务在同步期间有修改，请重试。", "Tasks changed during sync; retry."));
        await ctx.app.saveData({ ...latest, ...draft });
      }
      } catch (error) { links = previousLinks; throw error; }
      await persist();
      if (failures.length) throw new Error(failures.join("; "));
    };
    const sync = async () => {
      if (busy || !running) return; busy = true; lastError = ""; renderStatus();
      try {
        if (!pairId) { await discoverConnection(); if (!pairId) return; }
        const state = await getState(); displayState(state);
        if (state.status === "paused") return;
        if (ctx.tasks.list().some(task => isReadOnlyHistoryNote(task.notes))) {
          await api.request("/pause", "POST", { pairId });
          throw new Error(t("检测到历史日历回流任务，已暂停连接，请先修复异常数据。", "Read-only calendar history detected; connection paused for repair."));
        }
        for (const [id,saved] of Object.entries(links.tombstones)) {
          if (saved.restoreId) await finishRestore(id,saved);
          else if (saved.restoring) throw new Error(t("恢复中断，需要手动检查。", "Interrupted restore needs manual review."));
        }
        if (state.status === "preview") {
          const outgoing = snapshot();
          if (JSON.stringify(outgoing) !== lastSnapshot) { const result = await api.request("/snapshot", "POST", { pairId, platform: "navopath", snapshot: outgoing }); lastSnapshot = JSON.stringify(outgoing); displayState(result); }
          return;
        }
        if (state.status !== "active") {
          const initial = await api.request("/snapshot", "POST", { pairId, platform: "navopath", snapshot: snapshot() });
          ensureMappings(initial.assignments || []); displayState(initial); return;
        }
        const outgoing = snapshot(); lastSnapshot = JSON.stringify(outgoing);
        const result = await api.request("/snapshot", "POST", { pairId, platform: "navopath", snapshot: outgoing });
        ensureMappings(result.assignments || []); await apply(result.actions || []); lastSnapshot = JSON.stringify(snapshot()); lastApplied = (result.actions || []).length; lastSuccess = new Date().toLocaleTimeString(); displayState(result);
      } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
      finally { busy = false; renderStatus(); }
    };
    connect.onclick = () => void api.createPairingCode().then(({ code: value, expiresAt }) => { pairingCode = value; code.textContent = `${value} · ${new Date(expiresAt).toLocaleTimeString()}`; code.hidden = false; copy.hidden = false; codeRow.hidden = false; lastError = ""; renderStatus(); }).catch(error => { lastError = String(error); renderStatus(); });
    copy.onclick = () => { if (pairingCode) void navigator.clipboard?.writeText(pairingCode); };
    refresh.onclick = () => void sync();
    confirm.onclick = () => {
      if (busy || !previewView) return;
      const matches = previewView.matches();
      const mode = previewView.mode(), overwrite = mode !== "merge";
      if (!window.confirm(overwrite ? t("确认覆盖？目标端未匹配任务和项目将被删除（可在最近删除中恢复）。\n", "Confirm overwrite? Unmatched target records will be deleted (recoverable in Recently deleted).\n") + previewView.confirmationText() : t("确认双向合并？独有记录会复制到另一端。", "Confirm merge? Unique records will be copied to the other app."))) return;
      busy = true; lastError = ""; renderStatus();
      void getState().then(state => {
        if (state.status !== "preview" || JSON.stringify(state.preview) !== previewKey) { displayState(state); throw new Error(t("预览已改变，请重新检查后确认。", "Preview changed. Review it before confirming.")); }
        return api.request("/confirm", "POST", { pairId: state.pairId, matches, mode, confirmOverwrite: overwrite, expectedRevision: state.revision });
      }).then(displayState).catch(error => { lastError = String(error); renderStatus(); }).finally(() => { busy = false; renderStatus(); if (status === "active") void sync(); });
    };
    disconnect.onclick = () => void api.request("/revoke", "POST", { pairId }).then(() => { pairId = ""; pairingCode = ""; status = "waiting"; pairing.hidden = false; codeRow.hidden = true; connect.textContent = t("生成配对码", "Create pairing code"); code.hidden = copy.hidden = true; refresh.hidden = confirm.hidden = disconnect.hidden = true; previewView = undefined; previewKey = ""; details.replaceChildren(); links = { projects: {}, tasks: {}, tombstones: {} }; void persist(); renderStatus(); }).catch(error => { lastError = String(error); renderStatus(); });
    void ctx.storage.get<{ links?: LinkStore; pairId?: string } & Partial<LinkStore>>(STORAGE).then(saved => { if (saved) { const stored = saved.links || saved; if (stored.projects && stored.tasks && stored.tombstones) links = { projects: stored.projects, tasks: stored.tasks, tombstones: stored.tombstones }; pairId = saved.pairId || ""; } running = true; void sync(); }).catch(error => { lastError = String(error); renderStatus(); });
    const timer = window.setInterval(() => { void sync(); }, 15_000);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const offData = ctx.events.on("data:changed", () => {
      if (!running || !pairId || status !== "active") return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { if (!busy && JSON.stringify(snapshot()) !== lastSnapshot) void sync(); }, 500);
    });
    const offPage = registerPage("Super Productivity Sync", (mount) => {
      mount.append(container);
      renderStatus();
      return () => { container.remove(); };
    });
    return () => { running = false; clearInterval(timer); if (debounce) clearTimeout(debounce); offData(); offPage(); surface.dispose(); container.remove(); };
  }
} };

export default plugin;
