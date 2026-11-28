import { useEffect, useState, type ReactNode } from "react";
import { TaskGroup } from "../components/TaskBlock";
import { UiChevronDownIcon, UiChevronRightIcon } from "../components/UiIcons";
import { Button } from "../components/UiPrimitives";
import type { Language, Task } from "../types";
import type { ExtensionTaskGroup } from "./types";
import type { V2TaskGroupAction, V2SelectOption } from "./sdkV2";
import { resolveTaskGroups, type TaskGroupSelection } from "./taskGroupPartition";

type Props = {
  groups: readonly ExtensionTaskGroup[];
  candidates: readonly Task[];
  revision: readonly Task[];
  lang: Language;
  dragging: boolean;
  renderOrdinary(tasks: readonly Task[]): ReactNode;
  renderTask(task: Task): ReactNode;
};
function GroupAction({ group, action, tick, busy, invoke }: { group: ExtensionTaskGroup; action: V2TaskGroupAction; tick: number; busy: boolean; invoke(value?: string): void }) {
  const [choices, setChoices] = useState<readonly V2SelectOption[]>([]);
  const [selected, setSelected] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (action.input !== "select") return;
    let active = true;
    setReady(false);
    const timeout = setTimeout(() => { if (active) { setChoices([]); active = false; } }, 1500);
    void Promise.resolve().then(() => group.choices?.(action.id) ?? []).then(items => {
      if (active) { setChoices(items); setReady(true); }
    }).catch(() => { if (active) setChoices([]); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); };
  }, [group, action.id, action.input, tick]);
  if (action.input !== "select") return <Button variant="secondary" disabled={busy} onClick={() => invoke()}>{action.label}</Button>;
  const value = choices.some(option => option.value === selected) ? selected : choices[0]?.value ?? "";
  return <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
    <select className="ui-input" aria-label={action.label} value={value} disabled={busy || !ready || !choices.length} onChange={event => setSelected(event.target.value)} style={{ flex: "1 1 120px", minWidth: 0 }}>
      {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <Button variant="secondary" disabled={busy || !ready || !value} onClick={() => invoke(value)}>{action.label}</Button>
  </div>;
}
export default function PluginTaskGroups({ groups, candidates, revision, lang, dragging, renderOrdinary, renderTask }: Props) {
  const key = JSON.stringify(candidates.map(task => task.id));
  const [selection, setSelection] = useState<TaskGroupSelection[]>([]);
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const off = groups.map(group => {
      try { return group.subscribe?.(() => { if (active) setTick(value => value + 1); }); }
      catch { return undefined; }
    });
    return () => { active = false; for (const dispose of off) if (dispose) void Promise.resolve().then(dispose).catch(console.warn); };
  }, [groups]);
  useEffect(() => {
    if (dragging) return;
    let active = true;
    void resolveTaskGroups(groups, JSON.parse(key)).then(result => { if (active) setSelection(result); });
    return () => { active = false; };
  }, [groups, key, revision, tick, dragging]);
  const current = new Map(candidates.map(task => [task.id, task]));
  const selections = selection.filter(item => groups.includes(item.group));
  const claimed = new Set(selections.flatMap(item => item.ids));
  const ordinary = candidates.filter(task => !claimed.has(task.id));
  return <>
    {renderOrdinary(ordinary)}
    {groups.map(group => {
      const ids = selections.find(item => item.group === group)?.ids ?? [];
      const rows = ids.flatMap(id => current.has(id) ? [current.get(id)!] : []);
      const open = !collapsed.has(group.id);
      return <TaskGroup key={group.id} title={<Button variant="ghost" aria-expanded={open} onClick={() => setCollapsed(value => {
        const next = new Set(value); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next;
      })}>{open ? <UiChevronDownIcon size={16} /> : <UiChevronRightIcon size={16} />}{group.name}</Button>} count={rows.length}>
        {open && <>
          {rows.map(renderTask)}
          {group.invoke && group.actions?.map(action => <GroupAction key={action.id} group={group} action={action} tick={tick} busy={pending.has(group.id)} invoke={selected => {
            setError(""); setPending(value => new Set(value).add(group.id));
            void Promise.resolve().then(() => group.invoke!(action.id, selected)).then(() => setTick(value => value + 1))
              .catch(() => setError(group.id)).finally(() => setPending(value => { const next = new Set(value); next.delete(group.id); return next; }));
          }}/>)}
          {error === group.id && <p role="alert">{lang === "zh" ? "操作失败，请重试。" : "Action failed. Try again."}</p>}
        </>}
      </TaskGroup>;
    })}
  </>;
}
