import type { PluginContext, PluginModule } from "../../src/extensions/types";
import type { Project, Task, TimelineRecord } from "../../src/types";

type LinkStore = { projects: Record<string, string>; tasks: Record<string, string>; tombstones: Record<string, { kind: "task" | "project"; item: Task | Project; deletedAt: string; taskIds?: string[] }> };
type Entity = { id: string; syncId?: string; fields: Record<string, any> };
type RemoteAction = { syncId: string; kind: "project" | "task"; id?: string; fields: Record<string, any>; deleted?: boolean };
const STORAGE = "connection-state";

function projectFields(item: Project) { return { title: item.title, notes: item.notes || "", color: item.color || null, category: item.category || "" }; }
function taskFields(item: Task, projects: Project[]) {
  const block = [...(item.timelineRecords || [])].filter(record => record.executionStatus === "scheduled").sort((a, b) => `${a.scheduledDate}T${a.scheduledStart}`.localeCompare(`${b.scheduledDate}T${b.scheduledStart}`))[0];
  const scheduledMinutes = block ? Math.max(15, Math.round((minutes(block.scheduledEnd) - minutes(block.scheduledStart)) / 15) * 15) : 0;
  return {
    title: item.title, notes: item.notes || "", completed: item.completed, dueDate: item.dueDate || null,
    estimateMinutes: block ? scheduledMinutes : Math.round((item.estimatedHours || 0) * 60), projectTitle: projects.find(project => project.id === item.projectId)?.title || "",
    scheduledAt: block ? `${block.scheduledDate}T${block.scheduledStart}` : null,
    scheduledMinutes,
  };
}
function minutes(value: string) { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; }

const plugin: PluginModule = { onload(ctx: PluginContext) {
  ctx.ui.registerPage("Super Productivity Sync", (container) => {
    let links: LinkStore = { projects: {}, tasks: {}, tombstones: {} };
    let pairId = ""; let pairingCode = ""; let status = ""; let busy = false; let lastError = ""; let running = false;
    const api = ctx.integrations.superProductivity;
    const panel = document.createElement("section"); panel.className = "nvp-sp-sync";
    const heading = document.createElement("h2"); heading.textContent = ctx.language === "zh" ? "Super Productivity 同步" : "Super Productivity Sync";
    const description = document.createElement("p"); description.textContent = ctx.language === "zh" ? "连接后同步全部项目和任务。首次导入会先预览；冲突由你选择。" : "Sync all projects and tasks. Review the first import and choose how to resolve conflicts.";
    const connect = document.createElement("button"); connect.type = "button"; connect.textContent = ctx.language === "zh" ? "生成配对码" : "Create pairing code";
    const code = document.createElement("code"); code.hidden = true;
    const copy = document.createElement("button"); copy.type = "button"; copy.textContent = ctx.language === "zh" ? "复制配对码" : "Copy pairing code"; copy.hidden = true;
    const line = document.createElement("p"); line.setAttribute("role", "status");
    const details = document.createElement("div"); details.className = "nvp-sp-sync-details";
    const refresh = document.createElement("button"); refresh.type = "button"; refresh.textContent = ctx.language === "zh" ? "立即同步" : "Sync now";
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = ctx.language === "zh" ? "确认首次导入" : "Confirm initial import"; confirm.hidden = true;
    const disconnect = document.createElement("button"); disconnect.type = "button"; disconnect.textContent = ctx.language === "zh" ? "断开连接" : "Disconnect"; disconnect.hidden = true;
    panel.append(heading, description, connect, code, copy, refresh, confirm, disconnect, line, details); container.append(panel);
    const persist = async () => ctx.storage.set(STORAGE, { links, pairId });
    const getState = async () => api.request(`/state${pairId ? `?pairId=${encodeURIComponent(pairId)}` : ""}`);
    const discoverConnection = async () => { try { displayState(await api.request("/state")); } catch { /* No connection exists until a pairing code is redeemed. */ } };
    const displayState = (state: any) => {
      pairId = state.pairId || pairId; status = state.status || "waiting"; disconnect.hidden = !pairId;
      confirm.hidden = status !== "preview"; details.replaceChildren();
      if (status === "preview" && state.preview) {
        const label = document.createElement("p"); label.textContent = ctx.language === "zh" ? `项目：NavoPath ${state.preview.projects.navopath.length} / Super Productivity ${state.preview.projects.superproductivity.length}；任务：NavoPath ${state.preview.tasks.navopath.length} / Super Productivity ${state.preview.tasks.superproductivity.length}。勾选相同项目或任务以沿用 NavoPath 字段。` : `Projects: NavoPath ${state.preview.projects.navopath.length} / Super Productivity ${state.preview.projects.superproductivity.length}; tasks: NavoPath ${state.preview.tasks.navopath.length} / Super Productivity ${state.preview.tasks.superproductivity.length}. Select matching items to keep NavoPath values.`;
        details.append(label);
        const matches = document.createElement("div");
        for (const kind of ["project", "task"] as const) {
          const group = kind === "project" ? state.preview.projects : state.preview.tasks;
          const suggested = new Map(group.suggestions.map((item: any) => [item.navopathId, item.superproductivityId]));
          for (const item of group.navopath) {
            const row = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.dataset.kind = kind; input.dataset.left = item.id; input.dataset.right = String(suggested.get(item.id) || ""); input.checked = suggested.has(item.id);
            const text = document.createElement("span"); text.textContent = `${kind}: ${item.fields.title || "(untitled)"} ↔ ${suggested.has(item.id) ? group.superproductivity.find((other: any) => other.id === suggested.get(item.id))?.fields.title : "separate"}`;
            row.append(input, text); matches.append(row);
          }
        }
        details.append(matches);
      }
      const now = Date.now();
      for (const [syncId, item] of Object.entries(links.tombstones)) {
        const saved = item;
        if (now - Date.parse(saved.deletedAt) > 30 * 86400_000) { delete links.tombstones[syncId]; continue; }
        const row = document.createElement("div"); const text = document.createElement("span"); text.textContent = `${saved.item.title} · ${ctx.language === "zh" ? "可恢复" : "Restorable"}`;
        const restore = document.createElement("button"); restore.type = "button"; restore.textContent = ctx.language === "zh" ? "恢复" : "Restore";
        restore.onclick = () => void (async () => {
          if (saved.kind === "project") {
            const project = await ctx.projects.create({ ...(saved.item as Project), id: undefined } as unknown as Omit<Project, "id">);
            for (const taskId of saved.taskIds || []) if (ctx.tasks.get(taskId)) await ctx.tasks.update(taskId, { projectId: project.id });
            links.projects[project.id] = syncId; await api.request("/restore", "POST", { pairId, syncId, localId: project.id });
          } else {
            const original = saved.item as Task;
            const task = await ctx.tasks.create({ ...original, id: undefined, timelineRecords: (original.timelineRecords || []).map(record => ({ ...record, taskId: "" })) } as unknown as Omit<Task, "id">);
            task.timelineRecords = (task.timelineRecords || []).map(record => ({ ...record, taskId: task.id })); await ctx.tasks.update(task.id, { timelineRecords: task.timelineRecords });
            links.tasks[task.id] = syncId; await api.request("/restore", "POST", { pairId, syncId, localId: task.id });
          }
          delete links.tombstones[syncId]; await persist(); void sync();
        })().catch(error => { lastError = String(error); renderStatus(); });
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
          button.onclick = () => void api.request("/resolve", "POST", { pairId, conflictId: conflict.id, chosen: side }).then(displayState).catch(error => { lastError = String(error); renderStatus(); });
          row.append(button);
        }
        details.append(row);
      }
      renderStatus();
    };
    const renderStatus = () => { line.textContent = lastError || (pairId ? `${status}${busy ? " · syncing" : ""}` : (ctx.language === "zh" ? "尚未配对" : "Not paired")); };
    const ensureMappings = (assignments: Array<{ kind: "project" | "task"; id: string; syncId: string }>) => {
      for (const item of assignments) (item.kind === "task" ? links.tasks : links.projects)[item.id] = item.syncId;
    };
    const snapshot = (): { projects: Entity[]; tasks: Entity[] } => {
      const projects = ctx.projects.list();
      return {
        projects: projects.map(item => ({ id: item.id, syncId: links.projects[item.id], fields: projectFields(item) })),
        tasks: ctx.tasks.list().map(item => ({ id: item.id, syncId: links.tasks[item.id], fields: taskFields(item, projects) })),
      };
    };
    const apply = async (actions: RemoteAction[]) => {
      const projectIds = new Map(ctx.projects.list().map(item => [item.title, item.id]));
      for (const action of actions) {
        const map = action.kind === "task" ? links.tasks : links.projects;
        const currentId = action.id || Object.keys(map).find(id => map[id] === action.syncId);
        if (action.deleted) {
          if (action.kind === "task") { const current = ctx.tasks.get(currentId || ""); if (current) { links.tombstones[action.syncId] = { kind: "task", item: current, deletedAt: new Date().toISOString() }; await ctx.tasks.remove(current.id); } }
          else { const current = ctx.projects.get(currentId || ""); if (current) { const taskIds = ctx.tasks.list().filter(task => task.projectId === current.id).map(task => task.id); links.tombstones[action.syncId] = { kind: "project", item: current, deletedAt: new Date().toISOString(), taskIds }; for (const taskId of taskIds) await ctx.tasks.update(taskId, { projectId: undefined }); await ctx.projects.remove(current.id); } }
          delete map[currentId || ""]; continue;
        }
        if (action.kind === "project") {
          const value = { id: currentId || "", title: action.fields.title || "Imported project", category: action.fields.category || "project", notes: action.fields.notes || "", color: action.fields.color || undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Project;
          if (currentId && ctx.projects.get(currentId)) await ctx.projects.update(currentId, value);
          else { const created = await ctx.projects.create(value); map[created.id] = action.syncId; projectIds.set(created.title, created.id); }
          continue;
        }
        const fields = action.fields;
        const projectId = projectIds.get(fields.projectTitle || "");
        const current = currentId ? ctx.tasks.get(currentId) : undefined;
        const patch: Partial<Task> = {
          title: fields.title || "Imported task", notes: fields.notes || "", completed: fields.completed === true,
          dueDate: fields.dueDate || "", estimatedHours: Math.max(0, Number(fields.estimateMinutes || 0) / 60),
          projectId,
        };
        if (current && Object.hasOwn(fields, "scheduledAt")) {
          const records = [...(current.timelineRecords || [])];
          const nearest = records.map((record, index) => ({ record, index })).filter(item => item.record.executionStatus === "scheduled").sort((a, b) => `${a.record.scheduledDate}T${a.record.scheduledStart}`.localeCompare(`${b.record.scheduledDate}T${b.record.scheduledStart}`))[0];
          const nearestIndex = nearest?.index ?? -1;
          if (!fields.scheduledAt) {
            if (nearestIndex >= 0) records.splice(nearestIndex, 1);
          } else {
            const date = String(fields.scheduledAt).slice(0, 10); const start = String(fields.scheduledAt).slice(11, 16);
            const duration = Math.max(15, Number(fields.scheduledMinutes || fields.estimateMinutes || 60));
            const endMinutes = minutes(start) + duration;
            const end = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
            const old = nearestIndex >= 0 ? records[nearestIndex] : undefined;
            const endDate = endMinutes >= 1440 ? new Date(new Date(`${date}T00:00:00`).getTime() + 86400000).toISOString().slice(0, 10) : date;
            const next: TimelineRecord = { id: old?.id || crypto.randomUUID(), taskId: current.id, scheduledDate: date, scheduledStart: start, scheduledEndDate: endDate, scheduledEnd: end, executionStatus: "scheduled", createdAt: old?.createdAt || new Date().toISOString() };
            if (nearestIndex >= 0) records[nearestIndex] = next; else records.push(next);
          }
          patch.timelineRecords = records;
        }
        if (current) await ctx.tasks.update(current.id, patch);
        else {
          const created = await ctx.tasks.create({ ...patch, category: "task", goalId: "", createdAt: new Date().toISOString(), order: ctx.tasks.list().length } as Omit<Task, "id">);
          map[created.id] = action.syncId;
        }
      }
      await persist();
    };
    const sync = async () => {
      if (busy || !running) return; busy = true; lastError = ""; renderStatus();
      try {
        if (!pairId) { await discoverConnection(); if (!pairId) return; }
        const state = await getState(); displayState(state);
        if (state.status === "preview") { displayState(state); return; }
        if (state.status !== "active") {
          const initial = await api.request("/snapshot", "POST", { pairId, platform: "navopath", snapshot: snapshot() });
          ensureMappings(initial.assignments || []); displayState(initial); return;
        }
        const result = await api.request("/snapshot", "POST", { pairId, platform: "navopath", snapshot: snapshot() });
        ensureMappings(result.assignments || []); await apply(result.actions || []); displayState(result);
      } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
      finally { busy = false; renderStatus(); }
    };
    connect.onclick = () => void api.createPairingCode().then(({ code: value, expiresAt }) => { pairingCode = value; code.textContent = `${value} · ${new Date(expiresAt).toLocaleTimeString()}`; code.hidden = false; copy.hidden = false; lastError = ""; renderStatus(); }).catch(error => { lastError = String(error); renderStatus(); });
    copy.onclick = () => { if (pairingCode) void navigator.clipboard?.writeText(pairingCode); };
    refresh.onclick = () => void sync();
    confirm.onclick = () => {
      const matches = [...details.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map(input => ({ kind: input.dataset.kind, navopathId: input.dataset.left, superproductivityId: input.dataset.right }));
      void getState().then(state => api.request("/confirm", "POST", { pairId: state.pairId, matches })).then(displayState).then(sync).catch(error => { lastError = String(error); renderStatus(); });
    };
    disconnect.onclick = () => void api.request("/revoke", "POST", { pairId }).then(() => { pairId = ""; status = "waiting"; links = { projects: {}, tasks: {}, tombstones: {} }; void persist(); renderStatus(); }).catch(error => { lastError = String(error); renderStatus(); });
    void ctx.storage.get<LinkStore & { pairId?: string }>(STORAGE).then(saved => { if (saved) { links = saved; pairId = (saved as any).pairId || ""; } running = true; void sync(); });
    const timer = window.setInterval(() => { void sync(); }, 30_000);
    return () => { running = false; clearInterval(timer); panel.remove(); };
  });
} };

export default plugin;
