type Side = "navopath" | "superproductivity";
type Kind = "project" | "task";
type Entity = { id: string; fields: Record<string, unknown> };
type Group = { navopath: Entity[]; superproductivity: Entity[]; suggestions: { navopathId: string; superproductivityId: string }[] };
export type InitialSyncMode = "merge" | "overwrite-navopath" | "overwrite-superproductivity";
export type InitialPreview = { projects: Group; tasks: Group; overwriteSupported?: boolean };
export type InitialMatch = { kind: Kind; navopathId: string; superproductivityId: string; preferredSide: Side };

export function createInitialPreviewView(preview: InitialPreview, zh: boolean, previous: Map<string, { selected: boolean; preferredSide: Side }> = new Map(), initialMode: InitialSyncMode = "merge") {
  const t = (cn: string, en: string) => zh ? cn : en;
  const root = document.createElement("section"); root.className = "import-preview";
  let mode: InitialSyncMode = preview.overwriteSupported ? initialMode : "merge";
  const authority = (): Side | undefined => mode === "overwrite-navopath" ? "navopath" : mode === "overwrite-superproductivity" ? "superproductivity" : undefined;
  const records: { match: InitialMatch; key: string; selected: boolean; left: Entity; right: Entity }[] = [];
  const groups = [["project", preview.projects], ["task", preview.tasks]] as const;
  for (const [kind, group] of groups) {
    const left = new Map(group.navopath.map(item => [item.id, item]));
    const right = new Map(group.superproductivity.map(item => [item.id, item]));
    const counts = new Map<string, number>();
    for (const item of group.suggestions) counts.set(item.superproductivityId, (counts.get(item.superproductivityId) || 0) + 1);
    for (const item of group.suggestions) {
      const a = left.get(item.navopathId), b = right.get(item.superproductivityId);
      if (!a || !b || counts.get(b.id) !== 1) continue;
      const key = JSON.stringify([kind, a.id, b.id]);
      const prior = previous.get(key);
      records.push({ key, selected: prior?.selected ?? true, match: { kind, navopathId: a.id, superproductivityId: b.id, preferredSide: prior?.preferredSide ?? "navopath" }, left: a, right: b });
    }
  }
  const title = document.createElement("h2"); title.textContent = t("首次导入预览", "First import preview");
  const note = document.createElement("p"); note.textContent = t("匹配的记录将关联，共有字段以选定来源为准。双向合并会保留独有记录；覆盖模式会删除目标端未匹配的记录。", "Matched records are linked using the selected source for shared fields. Merge keeps unique records; overwrite removes unmatched target records.");
  const summary = document.createElement("p"); summary.className = "import-summary"; summary.setAttribute("aria-live", "polite");
  const toolbar = document.createElement("div"); toolbar.className = "nvp-sp-sync-actions";
  const search = document.createElement("input"); search.type = "search"; search.placeholder = t("搜索项目、任务或所属项目", "Search projects, tasks or project names"); search.setAttribute("aria-label", search.placeholder);
  const list = document.createElement("div");
  const controls: { el: HTMLButtonElement; selected: () => boolean }[] = [];
  const button = (label: string, callback: () => void, selected: () => boolean) => {
    const el = document.createElement("button"); el.type = "button"; el.textContent = label; el.onclick = callback;
    el.setAttribute("aria-pressed", "false"); controls.push({ el, selected }); toolbar.append(el);
  };
  function updateSummary() {
    const selectedProjects = records.filter(r => r.selected && r.match.kind === "project").length;
    const selectedTasks = records.filter(r => r.selected && r.match.kind === "task").length;
    const np = preview.projects.superproductivity.length - selectedProjects, sp = preview.projects.navopath.length - selectedProjects;
    const nt = preview.tasks.superproductivity.length - selectedTasks, st = preview.tasks.navopath.length - selectedTasks;
    const left = records.filter(r => r.selected && r.match.preferredSide === "navopath").length;
    const right = records.filter(r => r.selected && r.match.preferredSide === "superproductivity").length;
    const source = authority();
    if (source) {
      summary.textContent = source === "navopath" ? t(`NavoPath 保持不变；SP 新增 ${sp} 个项目、${st} 条任务，移入最近删除 ${np} 个项目、${nt} 条任务。`, `NavoPath unchanged; SP adds ${sp} projects / ${st} tasks, removes ${np} projects / ${nt} tasks.`) : t(`SP 保持不变；NavoPath 新增 ${np} 个项目、${nt} 条任务，移入最近删除 ${sp} 个项目、${st} 条任务。`, `SP unchanged; NavoPath adds ${np} projects / ${nt} tasks, removes ${sp} projects / ${st} tasks.`);
    } else summary.textContent = t(`合并 ${selectedProjects} 个项目、${selectedTasks} 条任务；NavoPath 新增 ${np} 个项目、${nt} 条任务；SP 新增 ${sp} 个项目、${st} 条任务。以 NavoPath 为准 ${left} 条，以 SP 为准 ${right} 条。`, `Link ${selectedProjects} projects and ${selectedTasks} tasks; add ${np} projects / ${nt} tasks to NavoPath and ${sp} projects / ${st} tasks to SP. NavoPath wins: ${left}; SP wins: ${right}.`);
    for (const {el, selected} of controls) el.setAttribute("aria-pressed", String(selected()));
  }
  const disclosure = new Map<string, boolean>();
  function render(focusKey?: string) {
    const q = search.value.trim().toLocaleLowerCase();
    for (const el of list.querySelectorAll<HTMLDetailsElement>("details[data-import-section]")) disclosure.set(el.dataset.importSection!, el.open);
    list.replaceChildren();
    const visible = (item: Entity) => !q || [item.fields.title, item.fields.projectTitle].some(v => String(v || "").toLocaleLowerCase().includes(q));
    for (const [kind, group] of groups) {
      const kindTitle = kind === "project" ? t("项目", "Projects") : t("任务", "Tasks");
      const groupRecords = records.filter(r => r.match.kind === kind);
      const section = document.createElement("details"); section.dataset.importSection = kind; section.open = Boolean(q) || (disclosure.get(kind) ?? kind === "project");
      const heading = document.createElement("summary"); heading.textContent = `${kindTitle} · ${groupRecords.length} ${t("个建议匹配", "suggested matches")}`; section.append(heading);
      for (const r of groupRecords.filter(r => visible(r.left) || visible(r.right))) {
        const row = document.createElement("div"); row.className = "import-row";
        const label = document.createElement("label");
        const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = r.selected; checkbox.disabled = Boolean(authority()); checkbox.dataset.matchKey = r.key;
        const name = document.createElement("span"); name.textContent = `${String(r.left.fields.title || t("未命名", "Untitled"))} ↔ ${String(r.right.fields.title || t("未命名", "Untitled"))}`;
        const side = document.createElement("select"); side.setAttribute("aria-label", t("共有字段来源", "Shared field source"));
        for (const [value, label] of [["navopath", "NavoPath"], ["superproductivity", "Super Productivity"]]) { const option = document.createElement("option"); option.value = value; option.textContent = label; side.append(option); }
        side.value = r.match.preferredSide; side.disabled = !r.selected || Boolean(authority());
        checkbox.onchange = () => { r.selected = checkbox.checked; render(r.key); };
        side.onchange = () => { r.match.preferredSide = side.value as Side; updateSummary(); };
        label.append(checkbox, name); row.append(label, side); section.append(row);
      }
      for (const [side, items] of [["navopath", group.navopath], ["superproductivity", group.superproductivity]] as const) {
        const unmatched = items.filter(item => !groupRecords.some(r => r.selected && (side === "navopath" ? r.left.id : r.right.id) === item.id));
        const other = document.createElement("details"); other.dataset.importSection = kind + ":" + side; other.open = Boolean(q) || (disclosure.get(other.dataset.importSection) ?? false);
        const label = document.createElement("summary"); label.textContent = `${side === "navopath" ? "NavoPath" : "Super Productivity"} · ${unmatched.length} ${t("条未匹配记录", "unmatched records")}`; other.append(label);
        const ul = document.createElement("ul");
        for (const item of unmatched.filter(visible)) { const li = document.createElement("li"); li.textContent = String(item.fields.title || t("未命名", "Untitled")); ul.append(li); }
        other.append(ul); section.append(other);
      }
      list.append(section);
    }
    updateSummary();
    if (focusKey) Array.from(list.querySelectorAll<HTMLInputElement>("input[data-match-key]")).find(el => el.dataset.matchKey === focusKey)?.focus();
  }
  function setAll(selected: boolean, preferredSide?: Side) { mode = "merge"; for (const r of records) { r.selected = selected; if (preferredSide) r.match.preferredSide = preferredSide; } render(); }
  button(t("双向合并", "Merge both"), () => { mode = "merge"; render(); }, () => mode === "merge");
  button(t("全选匹配", "Select all matches"), () => setAll(true), () => records.length > 0 && records.every(r => r.selected));
  button(t("取消全选", "Clear all matches"), () => setAll(false), () => records.length > 0 && records.every(r => !r.selected));
  const overwrite = (source: Side) => { if (!preview.overwriteSupported) return; setAll(true, source); mode = source === "navopath" ? "overwrite-navopath" : "overwrite-superproductivity"; render(); };
  if (preview.overwriteSupported) {
    button(t("全部以 NavoPath 为准（覆盖 SP）", "Overwrite SP from NavoPath"), () => overwrite("navopath"), () => mode === "overwrite-navopath");
    button(t("全部以 SP 为准（覆盖 NavoPath）", "Overwrite NavoPath from SP"), () => overwrite("superproductivity"), () => mode === "overwrite-superproductivity");
  } else {
    const warning = document.createElement("p"); warning.textContent = t("覆盖模式需要两端插件及云端更新。", "Update both plugins and the cloud service to enable overwrite."); toolbar.append(warning);
  }
  if (authority()) for (const r of records) { r.selected = true; r.match.preferredSide = authority()!; }
  search.oninput = () => render();
  root.append(title, note, summary, toolbar, search, list); render();
  return { root, mode: () => mode, confirmationText: () => summary.textContent || "", matches: () => records.filter(r => r.selected).map(r => ({ ...r.match })), selections: () => new Map(records.map(r => [r.key, { selected: r.selected, preferredSide: r.match.preferredSide }])) };
}
