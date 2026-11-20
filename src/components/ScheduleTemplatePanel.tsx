import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Language, ScheduleTemplate, Settings } from "../types";
import { clamp, minutesToTime, pointerToDateTime, SLOT_MINUTES, timeBlockTop, timeToMinutes } from "../timelineGeometry";
import { clockTimeSpanMinutes } from "../utils/timelineRecords";
import { uid } from "../utils/ids";
import { TaskDragLayer } from "../unifiedDrag";
import { usePointerReorder } from "../usePointerReorder";
import { readTemplatePeriods, saveTemplatePeriods, TEMPLATE_DAY_MINUTES, templatePeriodEnd, type TemplatePeriod, type templateApplication } from "../utils/scheduleTemplates";
import { DateQuickPicker } from "./DateQuickPicker";
import { CandidateBlock, CandidatePanelHeader, CandidatePanelShell, DailyTimelineGrid, ExecutionSplitLayout, TimelineCanvas, TimelineEventBlock } from "./ExecutionSharedLayout";
import { Button, IconButton, Input, Modal } from "./UiPrimitives";
import { UiChevronDownIcon, UiCopyIcon, UiPlusIcon, UiTrashIcon } from "./UiIcons";

type BuiltInScheduleTemplateId = "school" | "study";
const SCHEDULE_TEMPLATES: Record<BuiltInScheduleTemplateId, {
  labelZh: string;
  labelEn: string;
  slots: { id: string; labelZh: string; labelEn: string; start: string; end: string }[];
}> = {
  school: {
    labelZh: "\u9ed8\u8ba4 1",
    labelEn: "Default 1",
    slots: [
      { id: "morning-1", labelZh: "第一节", labelEn: "Period 1", start: "08:00", end: "08:45" },
      { id: "morning-2", labelZh: "第二节", labelEn: "Period 2", start: "08:55", end: "09:40" },
      { id: "morning-3", labelZh: "第三节", labelEn: "Period 3", start: "10:00", end: "10:45" },
      { id: "morning-4", labelZh: "第四节", labelEn: "Period 4", start: "10:55", end: "11:40" },
      { id: "afternoon-1", labelZh: "下午一", labelEn: "Afternoon 1", start: "13:30", end: "14:15" },
      { id: "afternoon-2", labelZh: "下午二", labelEn: "Afternoon 2", start: "14:25", end: "15:10" },
      { id: "afternoon-3", labelZh: "下午三", labelEn: "Afternoon 3", start: "15:30", end: "16:15" },
      { id: "evening-review", labelZh: "晚间整理", labelEn: "Evening review", start: "19:30", end: "20:15" },
    ],
  },
  study: {
    labelZh: "\u9ed8\u8ba4 2",
    labelEn: "Default 2",
    slots: [
      { id: "deep-1", labelZh: "上午深度", labelEn: "Morning focus", start: "09:00", end: "10:30" },
      { id: "deep-2", labelZh: "上午巩固", labelEn: "Morning review", start: "10:45", end: "12:00" },
      { id: "deep-3", labelZh: "下午推进", labelEn: "Afternoon progress", start: "14:00", end: "15:30" },
      { id: "deep-4", labelZh: "输出整理", labelEn: "Output block", start: "15:45", end: "17:00" },
      { id: "deep-5", labelZh: "晚间收束", labelEn: "Evening close", start: "19:30", end: "20:30" },
    ],
  },
};

type Selection = { key: string; title: string; periods: TemplatePeriod[] };
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

function builtInSelection(id: BuiltInScheduleTemplateId, lang: Language): Selection {
  const row = SCHEDULE_TEMPLATES[id];
  const zh = lang === "zh";
  return {
    key: "builtin:" + id,
    title: zh ? row.labelZh : row.labelEn,
    periods: readTemplatePeriods(row.slots.map((slot) => ({ ...slot, label: zh ? slot.labelZh : slot.labelEn }))),
  };
}

function customSelection(template: ScheduleTemplate): Selection {
  return { key: template.id, title: template.title, periods: readTemplatePeriods(template.slots) };
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

  return <Modal portalContainer={container} className="df-template-period-editor" label={label} onClose={onClose}>
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
  const [selection, setSelection] = useState(() => builtInSelection("school", lang));
  const [scrollStart, setScrollStart] = useState(() => selection.periods[0].startMinutes);
  const [selectedDate, setSelectedDate] = useState(today);
  const [pickerMonth, setPickerMonth] = useState(today.slice(0, 7));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState("");
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
  const focusName = useRef(false);
  const wasOpen = useRef(active);
  const builtIn = selection.key.startsWith("builtin:");
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
    if (focusName.current) {
      focusName.current = false;
      nameRef.current?.focus({ preventScroll: true });
      nameRef.current?.select();
    }
  }, [selection.key, scrollStart, pixelsPerMinute]);
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
    focusName.current = editName;
    setSelection(next);
    setEditing(null);
    setNotice("");
    setScrollStart(next.periods.length ? Math.min(...next.periods.map((period) => period.startMinutes)) : 9 * 60);
    if (editName && next.key === selection.key) {
      focusName.current = false;
      nameRef.current?.focus({ preventScroll: true });
      nameRef.current?.select();
    }
  }

  function createTemplate() {
    if (selection.key === "draft") {
      nameRef.current?.focus({ preventScroll: true });
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
      if (!title) nameRef.current?.focus();
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
    onSaveCustomTemplates((current) => insert ? [...current, next] : current.map((item) => item.id === id ? next : item));
    if (insert) activate(customSelection(next));
    else setSelection(customSelection(next));
    setNotice(zh ? "已保存模板。" : "Template saved.");
  }

  async function deleteTemplate() {
    const id = selection.key;
    if (!await confirmDelete(selection.title)) return;
    onSaveCustomTemplates((current) => current.filter((item) => item.id !== id));
    activate(builtInSelection("school", lang));
    setNotice(zh ? "已删除模板。" : "Template deleted.");
  }

  function updatePeriods(update: (current: TemplatePeriod[]) => TemplatePeriod[]) {
    setNotice("");
    setSelection((current) => ({ ...current, periods: update(current.periods) }));
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
  const positionBlock = (period: TemplatePeriod) => ({
    top: timeBlockTop(minutesToTime(period.startMinutes), 0, hourHeight),
    height: (Math.min(templatePeriodEnd(period), TEMPLATE_DAY_MINUTES) - period.startMinutes) * pixelsPerMinute,
    left: "var(--template-block-gutter)",
    right: "var(--template-block-gutter)",
  });

  return (
    <section ref={panelRef} tabIndex={-1} className="df-template-panel" onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      if (pickerOpen) closePicker();
      else if (gestureRef.current) endGesture();
      else if (editing) setEditing(null);
      else if (reorder.drag) reorder.cancelDrag();
      else return;
      event.stopPropagation();
    }}>
      <ExecutionSplitLayout className="df-template-shell">
        <CandidatePanelShell ariaLabel={zh ? "模板列表" : "Template list"}>
          <CandidatePanelHeader title={zh ? "模板" : "Templates"} actions={
            <Button variant="ghost" onClick={createTemplate}><UiPlusIcon size={14} />{zh ? "新建模板" : "New template"}</Button>
          } />
          <div className="df-candidate-list">
            {(Object.keys(SCHEDULE_TEMPLATES) as BuiltInScheduleTemplateId[]).map((id) => {
              const row = builtInSelection(id, lang);
              return <CandidateBlock key={row.key} title={row.title} meta={blockCount(row.periods.length)} selected={selection.key === row.key} onClick={() => activate(row)} />;
            })}
            {customTemplates.map((template) => {
              const position = reorder.insertion?.id === template.id ? reorder.insertion.position : null;
              return <React.Fragment key={template.id}>
                {position === "before" && <div className="df-list-insertion-line" aria-hidden="true" />}
                <CandidateBlock
                  selected={selection.key === template.id}
                  title={template.title}
                  meta={blockCount(template.slots.length)}
                  dataAttrs={{ "template-row-key": template.id }}
                  onClick={() => { if (!reorder.suppressedRef.current && selection.key !== template.id) activate(customSelection(template)); }}
                  onPointerDown={(event) => reorder.beginDrag(event, template)}
                />
                {position === "after" && <div className="df-list-insertion-line" aria-hidden="true" />}
              </React.Fragment>;
            })}
            {selection.key === "draft" && <CandidateBlock selected title={zh ? "新模板" : "New template"} meta={blockCount(selection.periods.length)} />}
          </div>
        </CandidatePanelShell>
        <section className="df-timeline-panel" aria-label={zh ? "模板时间轴" : "Template timeline"}>
          <div className="df-timeline-body">
            <div className="df-timeline-content">
              <div className="df-timeline-daily">
                <div className="df-template-name-bar">
                  {builtIn ? <>
                    <strong className="df-template-name-readonly">{selection.title} <small>{zh ? "只读" : "Read-only"}</small></strong>
                    <Button onClick={copyTemplate}>{zh ? "复制并编辑" : "Copy and edit"}</Button>
                  </> : <>
                    <Input ref={nameRef} className="df-template-name-inline" value={selection.title}
                      onChange={(event) => { const title = event.target.value; setSelection((current) => ({ ...current, title })); setNotice(""); }}
                      onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) persist(); }}
                      aria-label={zh ? "模板名称" : "Template name"} placeholder={zh ? "模板名称" : "Template name"} />
                    <Button variant="primary" onClick={persist}>{zh ? "保存模板" : "Save template"}</Button>
                    <div className="df-template-edit-actions">
                      <Button variant="ghost" onClick={addPeriod}><UiPlusIcon size={14} />{zh ? "添加时段" : "Add block"}</Button>
                      {selection.key !== "draft" && <>
                        <IconButton icon={<UiCopyIcon size={16} />} label={zh ? "复制模板" : "Duplicate template"} onClick={copyTemplate} />
                        <IconButton icon={<UiTrashIcon size={16} />} label={zh ? "删除模板" : "Delete template"} onClick={() => void deleteTemplate()} />
                      </>}
                    </div>
                  </>}
                </div>
                <TimelineCanvas
                  scrollRef={scrollRef}
                  canvasRef={canvasRef}
                  height={TEMPLATE_DAY_MINUTES * pixelsPerMinute}
                  canvasClassName={builtIn ? undefined : "df-template-canvas-editable"}
                  onCanvasPointerDown={builtIn ? undefined : startCreating}
                  onCanvasPointerMove={(event) => {
                    const gesture = gestureRef.current;
                    if (gesture?.pointerId === event.pointerId) setPreview(positionGesture(gesture, event));
                  }}
                  onCanvasPointerUp={finish}
                  onCanvasPointerCancel={(event) => { if (gestureRef.current?.pointerId === event.pointerId) endGesture(); }}
                  onCanvasClick={builtIn ? undefined : (event) => {
                    if ((event.nativeEvent as PointerEvent).pointerType !== "touch" || suppressTouchClick.current) return;
                    if (!(event.target instanceof Element) || event.target.closest("[data-template-period]")) return;
                    const period = newPeriod(minuteAt(event.clientX, event.clientY));
                    setEditing(period);
                  }}
                >
                  <DailyTimelineGrid slotCount={TEMPLATE_DAY_MINUTES / SLOT_MINUTES} dayStartHour={0} slotHeight={slotHeight} />
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
                      onPointerDown={builtIn ? undefined : (event) => begin(event, period, "move")}
                      onEdit={builtIn ? undefined : () => setEditing(period)}
                      onResizeStart={builtIn ? undefined : (edge, event) => begin(event, period, edge)}
                      lang={lang}
                    />;
                  })}
                  {gestureRef.current?.kind === "create" && preview && <TimelineEventBlock title={preview.title} style={positionBlock(preview)} preview lang={lang} />}
                </TimelineCanvas>
              </div>
            </div>
          </div>
        </section>
      </ExecutionSplitLayout>
      {reorder.drag && <TaskDragLayer pointer={reorder.drag.pointer} sourceRect={reorder.drag.sourceRect} offset={reorder.drag.offset}>
        <CandidateBlock title={reorder.drag.item.title} meta={blockCount(reorder.drag.item.slots.length)} />
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
            {dateLabel}<UiChevronDownIcon size={14} />
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
