import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { t } from "../i18n";
import type { Language } from "../types";
import { isIsoDate } from "../utils/localDate";
import { DateQuickPicker } from "./DateQuickPicker";
import { UiCalendarDaysIcon, UiPencilIcon, UiTrashIcon } from "./UiIcons";
import { Button, IconButton, Modal } from "./UiPrimitives";

export function EditorTitle({ label, value, ...props }: ComponentProps<"textarea"> & { label: string; value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || typeof ResizeObserver === "undefined") return;
    const fit = () => { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; };
    fit();
    let width = input.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === width) return;
      width = input.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(input);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <textarea {...props} ref={ref} className="df-detail-title-trevor" aria-label={label} value={value} rows={1} placeholder={label} spellCheck={false} />;
}

export function EditorActionRow({ children }: { children: ReactNode }) {
  return <section className="df-detail-status-row">{children}</section>;
}

export function EditorRemove({ children, ...props }: ComponentProps<typeof Button>) {
  return <Button {...props} variant="danger" className="df-detail-remove"><UiTrashIcon size={14} />{children}</Button>;
}

type EntityType = "task" | "project" | "habit";
export function EditorConversion<T extends EntityType>({ targets, lang, onConvert }: {
  targets: readonly T[];
  lang: Language;
  onConvert: (target: T) => void;
}) {
  return <>{targets.map((target) => {
    const name = target === "habit" ? (lang === "zh" ? "习惯" : "Habit") : t(lang, `form.${target}`);
    return <Button key={target} onClick={() => onConvert(target)}>{lang === "zh" ? `转换为${name}` : `Convert to ${name}`}</Button>;
  })}</>;
}

export function EditorNotes({ lang, value, onChange, onCommit }: {
  lang: Language; value: string; onChange: (value: string) => void; onCommit?: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const notes = t(lang, "drawer.notes");
  return <section className="df-detail-notes-new">
    <div className="df-detail-section-head">
      <h3>{notes}</h3>
      {editing && onCommit && draft !== value ? <div className="df-notes-editor-actions">
        <Button variant="text" onClick={() => { onChange(draft); onCommit(draft); setDraft(null); }}>{t(lang, "drawer.save")}</Button>
        <Button variant="text" onClick={() => setDraft(null)}>{t(lang, "drawer.cancel")}</Button>
      </div> : <IconButton icon={<UiPencilIcon size={14} />} label={editing ? t(lang, "form.close") : t(lang, "taskCard.editNotes")}
        className="ui-icon-button--borderless" aria-expanded={editing} onClick={() => setDraft(editing ? null : value)} />}
    </div>
    {editing ? <div className="df-notes-editor">
      <textarea autoFocus rows={4} aria-label={notes} placeholder={t(lang, "drawer.addNotePlaceholder")} value={draft} onChange={(event) => {
        setDraft(event.target.value);
        if (!onCommit) onChange(event.target.value);
      }} />
    </div> : value && <div className="df-notes-preview df-notes-preview--readonly"><p>{value}</p></div>}
  </section>;
}

export function EditorInlineButton(props: ComponentProps<typeof Button>) {
  return <Button {...props} variant="ghost" className="df-editor-inline" aria-haspopup="dialog" />;
}

export function EditorDateDialog({ open, label, lang, onClose, onSave, children }: {
  open: boolean; label: string; lang: Language; onClose: () => void; onSave: () => void; children: ReactNode;
}) {
  return <Modal open={open} portalContainer={typeof document === "undefined" ? undefined : document.querySelector?.(".df-app")}
    className="df-dialog df-task-schedule-editor" label={label} onClose={onClose} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    }}>
    <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <h2>{label}</h2>
      {children}
      <div className="df-task-schedule-footer">
        <Button variant="text" onClick={onClose}>{t(lang, "drawer.cancel")}</Button>
        <Button variant="primary" type="submit">{lang === "zh" ? "确认" : "Confirm"}</Button>
      </div>
    </form>
  </Modal>;
}

export function EditorDate({ label, value, today, weekStartsOn, minDate, lang, onChange, clearable, outlined }: {
  label: string; value: string; today: string; weekStartsOn: 0 | 1; minDate?: string;
  lang: Language; onChange: (value: string) => void; clearable?: boolean; outlined?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [month, setMonth] = useState(today.slice(0, 7));
  const localizedDate = isIsoDate(value) ? new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`)) : "";
  const Trigger = outlined ? Button : EditorInlineButton;
  return <>
    <Trigger className={outlined ? "df-editor-date" : undefined} aria-haspopup="dialog" onClick={() => {
      const selected = localizedDate ? value : "";
      setDraft(selected);
      setMonth((selected || (minDate && minDate > today ? minDate : today)).slice(0, 7));
      setOpen(true);
    }}>{outlined && <UiCalendarDaysIcon size={14} />}<span>{label}{localizedDate && ` · ${localizedDate}`}</span></Trigger>
    <EditorDateDialog open={open} label={label} lang={lang} onClose={() => setOpen(false)} onSave={() => {
      if (draft !== value) onChange(draft);
      setOpen(false);
    }}>
      <DateQuickPicker month={month} selectedDate={draft} today={today} minDate={minDate} weekStartsOn={weekStartsOn} lang={lang}
        onMonthChange={setMonth} onSelect={(date) => { setDraft(date); setMonth(date.slice(0, 7)); }} />
      {clearable && draft && <Button variant="text" onClick={() => setDraft("")}>{lang === "zh" ? "清除日期" : "Clear date"}</Button>}
    </EditorDateDialog>
  </>;
}
