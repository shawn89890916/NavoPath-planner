import type { PluginContext, Task } from "../../integrations/navopath-plugin-api";

export function captureTask(title: string, projectId: string, ctx: Pick<PluginContext, "projects">, now = new Date()): Omit<Task, "id"> {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 500) throw new Error("title");
  const project = projectId ? ctx.projects.get(projectId) : undefined;
  if (projectId && (!project || project.completed)) throw new Error("project");
  const timestamp = now.toISOString();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { title: trimmed, dueDate: "", category: project?.category || "personal", priority: null, notes: "", goalId: "", completed: false, ...(project ? { projectId: project.id } : {}), plannedForDate: date, executionLane: "candidate", workflowStatus: "backlog", createdAt: timestamp, updatedAt: timestamp };
}

export default {
  onload(ctx: PluginContext) {
    const zh = ctx.language === "zh";
    const title = zh ? "快速收集" : "Quick Capture";
    const projectSelect = (selected: string) => {
      const select = document.createElement("select"); select.className = "ui-input";
      const empty = document.createElement("option"); empty.value = ""; empty.textContent = zh ? "不关联项目" : "No project"; select.append(empty);
      for (const project of ctx.projects.list().filter(item => !item.completed)) { const option = document.createElement("option"); option.value = project.id; option.textContent = project.title; select.append(option); }
      select.value = selected; return select;
    };
    ctx.ui.registerView(title, container => {
      const form = document.createElement("form"); form.className = "navopath-quick-capture";
      const help = document.createElement("p"); help.textContent = zh ? "将想法直接保存为今天的候选任务，稍后再安排。" : "Save an idea as a candidate task for today, then schedule it when ready.";
      const label = document.createElement("label"); label.textContent = zh ? "任务名称" : "Task title";
      const input = document.createElement("input"); input.className = "ui-input"; input.required = true; input.maxLength = 500; input.autocomplete = "off"; label.append(input);
      const projectLabel = document.createElement("label"); projectLabel.textContent = zh ? "项目" : "Project";
      const select = projectSelect(String(ctx.settings.get().defaultProjectId || "")); projectLabel.append(select);
      const submit = document.createElement("button"); submit.type = "submit"; submit.className = "ui-button ui-button--primary"; submit.textContent = zh ? "加入今天的候选任务" : "Add to today's candidates";
      const status = document.createElement("p"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
      let disposed = false;
      const offSubmit = ctx.on(form, "submit", async event => {
        event.preventDefault(); if (submit.disabled) return;
        submit.disabled = true; status.textContent = "";
        try {
          const value = captureTask(input.value, select.value, ctx); await ctx.tasks.create(value);
          if (!disposed) { input.value = ""; status.textContent = zh ? "已加入今天的候选任务" : "Added to today's candidates"; input.focus(); }
        } catch (error) {
          if (!disposed) status.textContent = error instanceof Error && error.message === "title" ? (zh ? "请输入 1–500 个字符的任务名称。" : "Enter a task title of 1–500 characters.") : error instanceof Error && error.message === "project" ? (zh ? "项目已归档或删除，请重新选择。" : "This project was archived or removed. Choose another project.") : (zh ? "保存失败，请重试。" : "Could not save. Please try again.");
        } finally { if (!disposed) submit.disabled = false; }
      });
      const offData = ctx.events.on("data:changed", () => {
        const updated = projectSelect(select.value); select.replaceChildren(...Array.from(updated.childNodes)); select.value = updated.value;
      });
      form.append(help, label, projectLabel, submit, status); container.append(form); input.focus();
      return () => { disposed = true; offSubmit(); offData(); form.remove(); };
    });
    ctx.settings.registerPage(title, container => {
      const label = document.createElement("label"); label.className = "navopath-quick-capture"; label.textContent = zh ? "默认项目" : "Default project";
      const select = projectSelect(String(ctx.settings.get().defaultProjectId || "")); label.append(select); container.append(label);
      const off = ctx.on(select, "change", () => { void ctx.settings.save({ defaultProjectId: select.value }).catch(() => ctx.ui.toast(zh ? "默认项目保存失败" : "Could not save default project")); });
      return () => { off(); label.remove(); };
    });
  },
};
