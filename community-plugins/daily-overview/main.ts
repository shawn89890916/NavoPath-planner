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
    ctx.ui.registerPage(title, container => {
      const root = document.createElement("section"); root.className = "navopath-daily-overview";
      const top = document.createElement("header"); top.className = "navopath-daily-overview-top";
      const heading = document.createElement("div"); heading.className = "navopath-daily-overview-heading";
      const title = document.createElement("h2"); title.textContent = zh ? "今天" : "Today";
      const date = document.createElement("p"); date.className = "navopath-daily-overview-date";
      const refresh = document.createElement("button"); refresh.type = "button"; refresh.className = "ui-button ui-button--ghost"; refresh.textContent = zh ? "刷新" : "Refresh";
      heading.append(title, date); top.append(heading, refresh);
      const summary = document.createElement("div"); summary.className = "navopath-daily-overview-summary"; summary.setAttribute("aria-live", "polite");
      const content = document.createElement("div"); content.className = "navopath-daily-overview-sections"; root.append(top, summary, content);
      const render = () => {
        const data = read(); content.replaceChildren(); summary.replaceChildren();
        date.textContent = new Date(`${data.date}T12:00:00`).toLocaleDateString(ctx.language, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        const projects = new Map(ctx.projects.list().map(project => [project.id, project.title]));
        for (const [label, value] of [[zh ? "今日任务" : "Tasks today", data.today.length], [zh ? "逾期" : "Overdue", data.overdue.length], [zh ? "日历" : "Calendar", data.calendar.length]] as [string, number][]) {
          const metric = document.createElement("div"); metric.className = "navopath-daily-overview-metric";
          const count = document.createElement("strong"); count.textContent = String(value);
          const caption = document.createElement("span"); caption.textContent = label;
          metric.append(count, caption); summary.append(metric);
        }
        const group = (groupTitle: string, rows: string[], emptyText: string) => {
          const section = document.createElement("section"); section.className = "navopath-daily-overview-group";
          const h = document.createElement("h3"); h.textContent = groupTitle; const count = document.createElement("span"); count.className = "navopath-daily-overview-count"; count.textContent = String(rows.length); h.append(count); section.append(h);
          if (!rows.length) { const empty = document.createElement("p"); empty.className = "navopath-daily-overview-empty"; empty.textContent = emptyText; section.append(empty); }
          else { const list = document.createElement("ul"); for (const row of rows) { const item = document.createElement("li"); item.textContent = row; list.append(item); } section.append(list); }
          content.append(section);
        };
        const taskLine = (task: Task) => `${task.title}${task.projectId && projects.has(task.projectId) ? ` · ${projects.get(task.projectId)}` : ""}${task.dueDate ? ` · ${task.dueDate.slice(0, 10)}` : ""}`;
        group(zh ? "今天的任务" : "Today's tasks", data.today.map(taskLine), zh ? "今天没有任务。" : "No tasks for today.");
        group(zh ? "逾期任务" : "Overdue tasks", data.overdue.map(taskLine), zh ? "没有逾期任务。" : "No overdue tasks.");
        group(zh ? "日历安排" : "Calendar", data.calendar.map(event => `${event.startTime || (zh ? "全天" : "All day")}${event.endTime ? `–${event.endTime}` : ""} · ${event.title}`), zh ? "今天没有日历安排。" : "No calendar entries today.");
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
