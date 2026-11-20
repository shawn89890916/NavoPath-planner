import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { INITIAL_TEMPLATE_ID, isBuiltInScheduleTemplate, resolveScheduleTemplates, upsertScheduleTemplate } from "../../shared/scheduleTemplates";
import type { Language, ScheduleTemplate, Settings } from "../types";
import { clamp, minutesToTime, pointerToDateTime, SLOT_MINUTES, timeBlockTop, timeToMinutes } from "../timelineGeometry";
import { clockTimeSpanMinutes } from "../utils/timelineRecords";
import { uid } from "../utils/ids";
import { TaskDragLayer } from "../unifiedDrag";
import { usePointerReorder } from "../usePointerReorder";
import { readTemplatePeriods, saveTemplatePeriods, TEMPLATE_DAY_MINUTES, templatePeriodEnd, type TemplatePeriod, type templateApplication } from "../utils/scheduleTemplates";
import { DateQuickPicker } from "./DateQuickPicker";
import { DailyTimelineGrid, TimelineCanvas, TimelineEventBlock } from "./ExecutionSharedLayout";
import { ActionDisclosure, Button, Input, Modal } from "./UiPrimitives";
import { UiCheckIcon, UiChevronDownIcon, UiCopyIcon, UiGripIcon, UiPencilIcon, UiPlusIcon, UiTrashIcon } from "./UiIcons";

type Selection = { key: string; title: string; periods: TemplatePeriod[]; updatedAt?: string; dirty?: boolean };
type Gesture = {
  pointerId: number;
  originY: number;
  original: TemplatePeriod;
  kind: "create" | "move" | "start" | "end";
};
type Props = {
  active: boolean;
  lang: Language;
  today: string;
  weekStartsOn: Settings["weekStartsOn"];
  slotHeight: number;
  customTemplates: ScheduleTemplate[];
  onSaveCustomTemplates: (update: (current: ScheduleTemplate[]) => ScheduleTemplate[]) => void;
  getApplication: (date: string, periods: TemplatePeriod[]) => ReturnType<typeof templateApplication>;
  onApply: (date: string, periods: TemplatePeriod[]) => void;
  confirmDelete: (name: string) => Promise<boolean | null>;
};

function customSelection(template: ScheduleTemplate): Selection {
  return { key: template.id, title: template.title, periods: readTemplatePeriods(template.slots), updatedAt: template.updatedAt };
}

function TemplatePeriodEditor({ period, existing, lang, container, onClose, onSave, onDelete }: {
  period: TemplatePeriod;
  existing: boolean;
  lang: Language;
  container: Element | null;
  onClose: () => void;
  onSave: (period: TemplatePeriod) => void;
  onDelete: () => void;
}) {
  const zh = lang === "zh";
  const [title, setTitle] = useState(period.title);
  const [start, setStart] = useState(minutesToTime(period.startMinutes));
  const [end, setEnd] = useState(minutesToTime(templatePeriodEnd(period)));
  const nextDay = Boolean(start && end && end <= start);
  const label = existing ? (zh ? "编辑时段" : "Edit block") : (zh ? "添加时段" : "Add block");

  return <Modal portalContainer={container} className="df-dialog df-template-period-editor" label={label} onClose={onClose}>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!title.trim() || !start || !end) return;
      onSave({ id: period.id, title: title.trim(), startMinutes: timeToMinutes(start), durationMinutes: clockTimeSpanMinutes(start, end) });
    }}>
      <h2>{label}</h2>
      <label>
        <span>{zh ? "时段名称" : "Block name"}</span>
        <Input required autoFocus value={title} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="df-template-period-times">
        <label><span>{zh ? "开始时间" : "Start time"}</span><Input required type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label><span>{zh ? "结束时间" : "End time"}{nextDay && (zh ? "（次日）" : " (next day)")}</span><Input required type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      <div className="df-dialog-actions">
        {existing && <Button variant="danger" onClick={onDelete}>{zh ? "删除时段" : "Delete block"}</Button>}
        <Button onClick={onClose}>{zh ? "取消" : "Cancel"}</Button>
        <Button variant="primary" type="submit">{zh ? "确认" : "Done"}</Button>
      </div>
    </form>
  </Modal>;
}

export default function ScheduleTemplatePanel({ active, lang, today, weekStartsOn, slotHeight, customTemplates, onSaveCustomTemplates, getApplication, onApply, confirmDelete }: Props) {
  const zh = lang === "zh";
  const templates = useMemo(() => resolveScheduleTemplates(customTemplates, lang), [customTemplates, lang]);
  const [selection, setSelection] = useState(() => customSelection(templates[0]));
  const [scrollStart, setScrollStart] = useState(() => selection.periods[0]?.startMinutes ?? 9 * 60);
  const [selectedDate, setSelectedDate] = useState(today);
  const [pickerMonth, setPickerMonth] = useState(today.slice(0, 7));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [nameEditing, setNameEditing] = useState(false);
  const [editing, setEditing] = useState<TemplatePeriod | null>(null);
  const [preview, setPreview] = useState<TemplatePeriod | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dateGroupRef = useRef<HTMLDivElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const suppressTouchClick = useRef(false);
  const wasOpen = useRef(active);
  const builtIn = isBuiltInScheduleTemplate(selection.key);
  const date = selectedDate < today ? today : selectedDate;
  const { available, skipped } = getApplication(date, selection.periods);
  const pixelsPerMinute = slotHeight / SLOT_MINUTES;
  const hourHeight = 60 * pixelsPerMinute;
  const dateLabel = date === today ? (zh ? "今天" : "Today") : new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  }).format(new Date(date + "T00:00:00"));

  const reorder = usePointerReorder<ScheduleTemplate>({
    getId: (template) => template.id,
    selector: "[data-template-row-key]",
    attrName: "templateRowKey",
    onReorder: (id, targetId, position) => onSaveCustomTemplates((current) => {
      const moving = current.find((item) => item.id === id);
      const remaining = current.filter((item) => item.id !== id);
      const target = remaining.findIndex((item) => item.id === targetId);
      if (!moving || target < 0) return current;
      remaining.splice(target + (position === "after" ? 1 : 0), 0, moving);
      return remaining;
    }),
  });

  useLayoutEffect(() => {
    if (active && !wasOpen.current) {
      setSelectedDate(today);
      setPickerOpen(false);
    }
    if (active) panelRef.current?.focus({ preventScroll: true });
    wasOpen.current = active;
  }, [active, today]);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (scrollStart - 30) * pixelsPerMinute);
  }, [selection.key, scrollStart, pixelsPerMinute]);
  useLayoutEffect(() => {
    if (nameEditing) {
      nameRef.current?.focus({ preventScroll: true });
      nameRef.current?.select();
    }
  }, [nameEditing, selection.key]);
  useEffect(() => {
    if (selection.key === "draft" || selection.dirty || editing || gestureRef.current) return;
    const current = templates.find((item) => item.id === selection.key) ?? templates[0];
    if (current.updatedAt !== selection.updatedAt || current.id !== selection.key || current.title !== selection.title) {
      setSelection(customSelection(current));
    }
  }, [templates, selection, editing]);

  useEffect(() => {
    if (!pickerOpen) return;
    const frame = requestAnimationFrame(() => {
      dateGroupRef.current?.querySelector<HTMLButtonElement>("[data-date][aria-pressed=true]")?.focus({ preventScroll: true });
    });
    const closeOutside = (event: PointerEvent) => {
      if (!dateGroupRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [pickerOpen]);

  function activate(next: Selection, editName = false) {
    setNameEditing(editName);
    setSelection(next);
    setEditing(null);
    setNotice("");
    setScrollStart(next.periods.length ? Math.min(...next.periods.map((period) => period.startMinutes)) : 9 * 60);
  }

  function editTemplateName() {
    setNameEditing(true);
    nameRef.current?.focus({ preventScroll: true });
    nameRef.current?.select();
  }

  function createTemplate() {
    if (selection.key === "draft") {
      editTemplateName();
      return;
    }
    activate({ key: "draft", title: "", periods: [] }, true);
  }

  function copyTemplate() {
    activate({
      key: "draft",
      title: selection.title.trim() + (zh ? " 副本" : " copy"),
      periods: selection.periods.map((period) => ({ ...period, id: uid("period") })),
    }, true);
  }

  function persist() {
    const title = selection.title.trim();
    if (!title || !selection.periods.length) {
      setNotice(!title ? (zh ? "请填写模板名称。" : "Enter a template name.") : (zh ? "请添加至少一个时间段。" : "Add at least one time block."));
      if (!title) editTemplateName();
      return;
    }
    const insert = selection.key === "draft";
    const id = insert ? uid("template") : selection.key;
    const now = new Date().toISOString();
    const slots = saveTemplatePeriods(selection.periods, (position) => zh ? "第 " + position + " 段" : "Period " + position);
    const next: ScheduleTemplate = {
      id,
      title,
      slots,
      createdAt: customTemplates.find((template) => template.id === id)?.createdAt || now,
      updatedAt: now,
    };
    let saved = false;
    onSaveCustomTemplates((current) => {
      const latest = current.find((item) => item.id === id);
      if (!insert && (latest?.updatedAt ?? (builtIn ? "" : undefined)) !== selection.updatedAt) return current;
      saved = true;
      return upsertScheduleTemplate(current, next);
    });
    if (!saved) {
      setNotice(zh ? "模板已在另一处更新。重新选择模板即可加载最新版本。" : "This template changed elsewhere. Select it again to load the latest version.");
      return;
    }
    if (insert) activate(customSelection(next));
    else {
      setSelection(customSelection(next));
      setNameEditing(false);
    }
    setNotice(zh ? "已保存模板。" : "Template saved.");
  }

  async function deleteTemplate() {
    const id = selection.key;
    if (!await confirmDelete(selection.title)) return;
    onSaveCustomTemplates((current) => current.filter((item) => item.id !== id));
    activate(customSelection(templates.find((item) => item.id === INITIAL_TEMPLATE_ID) ?? templates[0]));
    setNotice(zh ? "已删除模板。" : "Template deleted.");
  }

  function updatePeriods(update: (current: TemplatePeriod[]) => TemplatePeriod[]) {
    setNotice("");
    setSelection((current) => ({ ...current, dirty: true, periods: update(current.periods) }));
  }

  function savePeriod(period: TemplatePeriod) {
    updatePeriods((periods) => periods.some((item) => item.id === period.id)
      ? periods.map((item) => item.id === period.id ? period : item)
      : [...periods, period]);
    const scroll = scrollRef.current;
    if (scroll && (period.startMinutes * pixelsPerMinute < scroll.scrollTop
      || period.startMinutes * pixelsPerMinute >= scroll.scrollTop + scroll.clientHeight)) {
      scroll.scrollTop = Math.max(0, (period.startMinutes - 30) * pixelsPerMinute);
    }
    setEditing(null);
  }

  function addPeriod() {
    const visibleMinutes = (scrollRef.current?.scrollTop || 0) / pixelsPerMinute;
    const start = clamp(Math.ceil(visibleMinutes / SLOT_MINUTES) * SLOT_MINUTES + 2 * SLOT_MINUTES, 0, TEMPLATE_DAY_MINUTES - SLOT_MINUTES);
    setEditing(newPeriod(start));
  }

  function minuteAt(clientX: number, clientY: number) {
    return pointerToDateTime({
      clientX, clientY, gridElement: canvasRef.current!, scrollElement: scrollRef.current!,
      visibleDays: [date], startHour: 0, hourHeight,
    }).minutes;
  }

  function newPeriod(startMinutes: number): TemplatePeriod {
    return {
      id: uid("period"),
      title: zh ? "新时间段" : "New block",
      startMinutes,
      durationMinutes: Math.min(2 * SLOT_MINUTES, TEMPLATE_DAY_MINUTES - startMinutes),
    };
  }

  function begin(event: React.PointerEvent<HTMLElement>, original: TemplatePeriod, kind: Gesture["kind"]) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    suppressTouchClick.current = true;
    gestureRef.current = { pointerId: event.pointerId, originY: event.clientY, original, kind };
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  function startCreating(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("[data-template-period]")) return;
    if (event.clientX < event.currentTarget.getBoundingClientRect().left) return;
    suppressTouchClick.current = false;
    if (event.pointerType === "touch") return;
    begin(event, newPeriod(minuteAt(event.clientX, event.clientY)), "create");
  }

  function positionGesture(gesture: Gesture, event: React.PointerEvent) {
    const { original, kind, originY } = gesture;
    if (Math.abs(event.clientY - originY) < 5) return original;
    const delta = Math.round((event.clientY - originY) / slotHeight) * SLOT_MINUTES;
    const end = templatePeriodEnd(original);
    if (kind === "create") {
      const bottom = canvasRef.current!.getBoundingClientRect().bottom;
      const position = event.clientY >= bottom - slotHeight / 2 ? TEMPLATE_DAY_MINUTES : minuteAt(event.clientX, event.clientY);
      const startMinutes = Math.min(position, original.startMinutes);
      return { ...original, startMinutes, durationMinutes: Math.max(SLOT_MINUTES, Math.abs(position - original.startMinutes)) };
    }
    if (kind === "move") {
      const limit = end > TEMPLATE_DAY_MINUTES ? TEMPLATE_DAY_MINUTES - 1 : TEMPLATE_DAY_MINUTES - original.durationMinutes;
      return { ...original, startMinutes: clamp(original.startMinutes + delta, 0, limit) };
    }
    const minimum = Math.min(SLOT_MINUTES, original.durationMinutes);
    if (kind === "start") {
      const startMinutes = clamp(original.startMinutes + delta, Math.max(0, end - TEMPLATE_DAY_MINUTES), Math.min(end - minimum, TEMPLATE_DAY_MINUTES - 1));
      return { ...original, startMinutes, durationMinutes: end - startMinutes };
    }
    const maximum = end > TEMPLATE_DAY_MINUTES ? TEMPLATE_DAY_MINUTES : TEMPLATE_DAY_MINUTES - original.startMinutes;
    return { ...original, durationMinutes: clamp(original.durationMinutes + delta, minimum, maximum) };
  }

  function endGesture() {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setPreview(null);
    if (gesture && canvasRef.current?.hasPointerCapture(gesture.pointerId)) {
      canvasRef.current.releasePointerCapture(gesture.pointerId);
    }
  }

  function finish(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const period = positionGesture(gesture, event);
    endGesture();
    if (gesture.kind === "create") {
      setEditing(period);
    } else if (period !== gesture.original) {
      updatePeriods((current) => current.map((item) => item.id === period.id ? period : item));
    } else {
      setEditing(period);
    }
  }

  function closePicker() {
    setPickerOpen(false);
    dateButtonRef.current?.focus({ preventScroll: true });
  }

  const blockCount = (count: number) => zh ? count + " 个时间段" : count + (count === 1 ? " block" : " blocks");
  const selectedTitle = selection.title || (zh ? "新模板" : "New template");
  const positionBlock = (period: TemplatePeriod) => {
    const height = (Math.min(templatePeriodEnd(period), TEMPLATE_DAY_MINUTES) - period.startMinutes) * pixelsPerMinute;
    const inset = Math.min(2, height / 8);
    return {
      top: timeBlockTop(minutesToTime(period.startMinutes), 0, hourHeight) + inset,
      height: height - 2 * inset,
      left: "var(--template-block-gutter)",
      right: "var(--template-block-gutter)",
    };
  };

  return (
    <section ref={panelRef} tabIndex={-1} className="df-template-panel df-template-shell" onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      if (pickerOpen) closePicker();
      else if (gestureRef.current) endGesture();
      else if (editing) setEditing(null);
      else if (reorder.drag) reorder.cancelDrag();
      else if (nameEditing) setNameEditing(false);
      else return;
      event.stopPropagation();
    }}>
      <div className="df-template-toolbar">
        <ActionDisclosure className="df-template-selector" label={(zh ? "选择模板，" : "Choose template, ") + selectedTitle}
          summary={<><span>{selectedTitle}</span><UiChevronDownIcon size={16} /></>}>
          <div className="df-template-menu-list ui-divided-list">
            {templates.map((template) => {
              const selected = selection.key === template.id;
              const draggable = !isBuiltInScheduleTemplate(template.id);
              const insertion = reorder.insertion?.id === template.id ? reorder.insertion.position : null;
              return <Button key={template.id} variant="ghost" className="df-template-menu-row"
                aria-current={selected || undefined} data-insertion={insertion || undefined}
                data-template-row-key={draggable ? template.id : undefined}
                onPointerDown={draggable ? (event) => {
                  if (event.pointerType !== "touch" || (event.target as Element).closest("[data-template-grip]")) reorder.beginDrag(event, template);
                } : undefined}
                onClick={(event) => {
                  if (reorder.suppressedRef.current) { event.preventDefault(); return; }
                  if (!selected || selection.updatedAt !== template.updatedAt) activate(customSelection(template));
                }}>
                <span className="df-template-menu-name">{template.title}</span>
                <span className="df-template-menu-meta">
                  {selected ? <UiCheckIcon size={16} /> : <small>{blockCount(template.slots.length)}</small>}
                  {draggable && <UiGripIcon size={16} data-template-grip />}
                </span>
              </Button>;
            })}
          </div>
          <div className="df-template-menu-actions ui-divided-list">
            <Button variant="ghost" className="df-template-menu-row" onClick={createTemplate}><UiPlusIcon size={16} /><span>{zh ? "新建模板" : "New template"}</span></Button>
            {selection.key !== "draft" && <>
              <Button variant="ghost" className="df-template-menu-row" onClick={editTemplateName}><UiPencilIcon size={16} /><span>{zh ? "编辑名称" : "Edit name"}</span></Button>
              <Button variant="ghost" className="df-template-menu-row" onClick={copyTemplate}><UiCopyIcon size={16} /><span>{zh ? "复制模板" : "Duplicate template"}</span></Button>
              {!builtIn && <Button variant="danger" className="df-template-menu-row" onClick={() => void deleteTemplate()}><UiTrashIcon size={16} /><span>{zh ? "删除模板" : "Delete template"}</span></Button>}
            </>}
          </div>
        </ActionDisclosure>
        <div className="df-template-toolbar-actions">
          <Button variant="ghost" onClick={addPeriod}><UiPlusIcon size={16} /><span>{zh ? "添加时段" : "Add block"}</span></Button>
          <Button variant="primary" onClick={persist}>{zh ? "保存模板" : "Save template"}</Button>
        </div>
        {nameEditing && <Input ref={nameRef} className="df-template-name-inline" value={selection.title}
          onChange={(event) => { const title = event.target.value; setSelection((current) => ({ ...current, dirty: true, title })); setNotice(""); }}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) persist(); }}
          aria-label={zh ? "模板名称" : "Template name"} placeholder={zh ? "模板名称" : "Template name"} />}
      </div>
      <section className="df-timeline-panel" aria-label={zh ? "模板时间轴" : "Template timeline"}>
        <div className="df-timeline-body">
          <div className="df-timeline-content">
            <div className="df-timeline-daily">
              <TimelineCanvas
                scrollRef={scrollRef}
                canvasRef={canvasRef}
                height={TEMPLATE_DAY_MINUTES * pixelsPerMinute}
                canvasClassName="df-template-canvas-editable"
                onCanvasPointerDown={startCreating}
                onCanvasPointerMove={(event) => {
                  const gesture = gestureRef.current;
                  if (gesture?.pointerId === event.pointerId) setPreview(positionGesture(gesture, event));
                }}
                onCanvasPointerUp={finish}
                onCanvasPointerCancel={(event) => { if (gestureRef.current?.pointerId === event.pointerId) endGesture(); }}
                onCanvasClick={(event) => {
                  if ((event.nativeEvent as PointerEvent).pointerType !== "touch" || suppressTouchClick.current) return;
                  if (!(event.target instanceof Element) || event.target.closest("[data-template-period]")) return;
                  const period = newPeriod(minuteAt(event.clientX, event.clientY));
                  setEditing(period);
                }}
              >
                <DailyTimelineGrid anchorDate={date} slotCount={TEMPLATE_DAY_MINUTES / SLOT_MINUTES} dayStartHour={0} slotHeight={slotHeight} />
                {selection.periods.map((saved) => {
                  const period = preview?.id === saved.id ? preview : saved;
                  const end = templatePeriodEnd(period);
                  const label = minutesToTime(period.startMinutes) + "–"
                    + (end > TEMPLATE_DAY_MINUTES ? (zh ? "次日 " : "next day ") : "")
                    + (end === TEMPLATE_DAY_MINUTES ? "24:00" : minutesToTime(end));
                  return <TimelineEventBlock key={period.id}
                    title={period.title}
                    timeRange={label}
                    style={positionBlock(period)}
                    conflicting={skipped.has(period.id)}
                    onPointerDown={(event) => begin(event, period, "move")}
                    onEdit={() => setEditing(period)}
                    onResizeStart={(edge, event) => begin(event, period, edge)}
                    lang={lang}
                  />;
                })}
                {gestureRef.current?.kind === "create" && preview && <TimelineEventBlock title={preview.title} style={positionBlock(preview)} preview lang={lang} />}
              </TimelineCanvas>
            </div>
          </div>
        </div>
      </section>
      {reorder.drag && <TaskDragLayer pointer={reorder.drag.pointer} sourceRect={reorder.drag.sourceRect} offset={reorder.drag.offset}>
        <div className="df-template-drag-row">{reorder.drag.item.title}</div>
      </TaskDragLayer>}
      <footer className="df-template-modal-actions">
        {(notice || skipped.size > 0) && <div className="df-template-status" role="status">
          {notice && <span>{notice}</span>}
          {skipped.size > 0 && <span>{zh ? skipped.size + " 个时间段与现有日程重叠，将跳过。" : skipped.size + (skipped.size === 1 ? " block overlaps" : " blocks overlap") + " the schedule and will be skipped."}</span>}
        </div>}
        <div className="df-template-apply-date" ref={dateGroupRef}>
          <span>{zh ? "应用到" : "Apply to"}</span>
          <Button ref={dateButtonRef} variant="ghost" className="df-template-date-field"
            aria-expanded={pickerOpen} aria-haspopup="dialog" aria-label={(zh ? "应用日期，" : "Apply date, ") + dateLabel}
            title={date}
            onClick={() => { setPickerMonth(date.slice(0, 7)); setPickerOpen(!pickerOpen); }}>
            <span>{dateLabel}</span><UiChevronDownIcon size={16} />
          </Button>
          <DateQuickPicker open={pickerOpen} month={pickerMonth} selectedDate={date} today={today} minDate={today}
            weekStartsOn={weekStartsOn} lang={lang} onMonthChange={setPickerMonth}
            onSelect={(nextDate) => { setSelectedDate(nextDate); closePicker(); }} />
        </div>
        <Button variant="primary" disabled={!available.length} onClick={() => onApply(date, selection.periods)}>
          {zh ? "应用" : "Apply"}{available.length > 0 && " (" + available.length + ")"}
        </Button>
      </footer>
      {active && editing && <TemplatePeriodEditor key={editing.id} period={editing} lang={lang}
        container={panelRef.current?.closest(".df-app") || null}
        existing={selection.periods.some((period) => period.id === editing.id)}
        onClose={() => setEditing(null)} onSave={savePeriod} onDelete={() => {
          updatePeriods((current) => current.filter((item) => item.id !== editing.id));
          setEditing(null);
        }} />}
    </section>
  );
}
