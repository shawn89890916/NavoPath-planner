import type { CalendarEvent, PluginContext, Task } from "../../integrations/navopath-plugin-api";

export function dailyOverview(tasks: Task[], events: CalendarEvent[], now = new Date()) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const pending = tasks.filter(task => !task.completed);
  const overdue = pending.filter(task => task.dueDate && task.dueDate.slice(0, 10) < date).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const today = pending.filter(task => task.plannedForDate === date || task.dueDate?.slice(0, 10) === date || task.scheduledDate === date || task.timelineRecords?.some(record => record.scheduledDate === date && record.executionStatus === "scheduled"));
  const calendar = events.filter(event => (event.startDate || event.date) <= date && (event.endDate || event.startDate || event.date) >= date).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  return { date, overdue, today, calendar };
}

export default {
  onload(ctx: PluginContext) {
    const zh = ctx.language === "zh";
    const title = zh ? "每日概览" : "Daily Overview";
    const read = () => dailyOverview(ctx.tasks.list(), ctx.calendar.list());
    ctx.commands.register("summary", zh ? "刷新今日概览摘要" : "Refresh daily summary", () => {
      const data = read(); ctx.events.emit("daily-overview:refresh");
      ctx.ui.toast(zh ? `今日 ${data.today.length} 项 · 逾期 ${data.overdue.length} 项 · 日历 ${data.calendar.length} 项` : `${data.today.length} today · ${data.overdue.length} overdue · ${data.calendar.length} calendar`);
    });
    ctx.ui.registerView(title, container => {
      const root = document.createElement("section"); root.className = "navopath-daily-overview";
      const refresh = document.createElement("button"); refresh.type = "button"; refresh.className = "ui-button ui-button--ghost"; refresh.textContent = zh ? "刷新" : "Refresh";
      const content = document.createElement("div"); content.setAttribute("aria-live", "polite"); root.append(refresh, content);
      const render = () => {
        const data = read(); content.replaceChildren();
        const date = document.createElement("p"); date.textContent = data.date; content.append(date);
        const projects = new Map(ctx.projects.list().map(project => [project.id, project.title]));
        const group = (heading: string, rows: string[]) => {
          const section = document.createElement("section"); const h = document.createElement("h3"); h.textContent = `${heading} · ${rows.length}`; section.append(h);
          if (!rows.length) { const empty = document.createElement("p"); empty.textContent = zh ? "暂无" : "None"; section.append(empty); }
          else { const list = document.createElement("ul"); for (const row of rows) { const item = document.createElement("li"); item.textContent = row; list.append(item); } section.append(list); }
          content.append(section);
        };
        const taskLine = (task: Task) => `${task.title}${task.projectId && projects.has(task.projectId) ? ` · ${projects.get(task.projectId)}` : ""}${task.dueDate ? ` · ${task.dueDate.slice(0, 10)}` : ""}`;
        group(zh ? "今天待办" : "Today", data.today.map(taskLine));
        group(zh ? "逾期待办" : "Overdue", data.overdue.map(taskLine));
        group(zh ? "日历事项" : "Calendar events", data.calendar.map(event => `${event.startTime || (zh ? "全天" : "All day")}${event.endTime ? `–${event.endTime}` : ""} · ${event.title}`));
        const note = document.createElement("p"); note.textContent = zh ? "只读概览；今日包含计划、截止或已排程的未完成任务。日历显示已保存的事项，重复事项按保存日期显示。" : "Read-only. Today includes unfinished planned, due, or scheduled tasks. Calendar shows saved events; recurring entries use their saved dates."; content.append(note);
      };
      const offClick = ctx.on(refresh, "click", render);
      const offData = ctx.events.on("data:changed", render);
      const offRefresh = ctx.events.on("daily-overview:refresh", render);
      const offDay = ctx.interval(render, 60_000);
      container.append(root); render();
      return () => { offClick(); offData(); offRefresh(); offDay(); root.remove(); };
    });
  },
};
