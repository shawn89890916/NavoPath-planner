import { dailyContinuousCanvasHeight, getContinuousTimelineDateForOffset } from "../utils/continuousTimeline";
import { addDays, minutesToTime, SLOT_MINUTES, timelineHourSlots } from "../timelineGeometry";
import { shortDateStr, t, weekdayName } from "../i18n";
import React, { memo, type CSSProperties } from "react";
import { TaskBlock, TaskBlockContent } from "./TaskBlock";
import { CloseButton, Input } from "./UiPrimitives";
import type { Language } from "../types";

/**
 * ExecutionSplitLayout — the real execution-page 2-column grid
 * (`<main className="df-execute">`). The grid template, column widths, gap,
 * padding and height all come from the single `.df-execute` CSS rule.
 *
 * Used by BOTH the execution page and the template modal so the outer layout
 * is identical by construction.
 */
export function ExecutionSplitLayout({
  left,
  right,
  className,
  style,
  children,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <main
      className={`df-execute${className ? ` ${className}` : ""}`}
      style={style}
      data-reuse="execution-split-layout"
    >
      {children ?? (
        <>
          {left}
          {right}
        </>
      )}
    </main>
  );
}

/**
 * CandidatePanelShell — the shared left-panel section wrapper.
 * Renders `<section className="df-candidate-panel">` — the SAME CSS class the
 * execution page uses for Today's Candidates. Both callers wrap their panel
 * content in this shell so the panel border, radius, surface, padding, and
 * width are identical by construction.
 */
export function CandidatePanelShell({
  panelRef,
  role,
  ariaModal,
  className,
  style,
  ariaHidden,
  inert,
  ariaLabel,
  onDragOver,
  onDrop,
  onPointerDown,
  children,
}: {
  panelRef?: React.Ref<HTMLElement>;
  role?: "dialog";
  ariaModal?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaHidden?: boolean;
  inert?: boolean;
  ariaLabel?: string;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  children: React.ReactNode;
}) {
  return (
    <section
      ref={panelRef}
      role={role}
      aria-modal={ariaModal}
      className={`df-candidate-panel${className ? ` ${className}` : ""}`}
      style={style}
      aria-hidden={ariaHidden}
      inert={inert}
      aria-label={ariaLabel}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      data-reuse="candidate-panel-shell"
    >
      {children}
    </section>
  );
}

/**
 * CandidatePanelHeader — the shared panel title strip.
 * Renders `<div className="df-panel-title"><h2>{title}</h2><div>{actions}</div></div>`
 * — the SAME structure the execution page uses for its candidate panel header.
 */
export function CandidatePanelHeader({
  title,
  actions,
  ...headerProps
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "title">) {
  return (
    <div {...headerProps} className="df-panel-title" data-reuse="candidate-panel-header">
      <h2>{title}</h2>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

/** Template choices share the candidate block treatment and have a native button for selection. */
export function CandidateBlock({ title, meta, selected, dataAttrs, onClick, onPointerDown }: {
  title: string;
  meta: string;
  selected?: boolean;
  dataAttrs?: Record<string, string | undefined>;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
}) {
  return (
    <TaskBlock
      as={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      variant="candidate"
      className="df-candidate-block"
      selected={selected}
      ariaPressed={onClick ? selected : undefined}
      onClick={onClick}
      onPointerDown={onPointerDown}
      dataAttrs={dataAttrs}
      main={<TaskBlockContent className="df-template-choice" title={title}><small className="df-template-row-count">{meta}</small></TaskBlockContent>}
    />
  );
}

/**
 * TimelineCanvas — the shared timeline scroll container + positioned canvas.
 * Renders `df-timeline-scroll` (scroll container) wrapping `df-timeline-canvas`
 * (the absolutely-positioned canvas whose height sets the total scrollable
 * range). The hour grid, event blocks, now-line, etc. are passed as `children`
 * so each caller keeps its own grid logic.
 *
 * Used by BOTH the execution page daily timeline and the template modal
 * timeline.
 */
export function TimelineCanvas({
  scrollRef,
  canvasRef,
  height,
  canvasClassName,
  onScrollPointerDown,
  onScrollPointerMove,
  onScrollPointerUp,
  onScrollDragOver,
  onScrollDrop,
  onScrollDragLeave,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasPointerCancel,
  onCanvasMouseDown,
  onCanvasClick,
  children,
}: {
  scrollRef?: React.Ref<HTMLDivElement>;
  canvasRef?: React.Ref<HTMLDivElement>;
  height: number;
  canvasClassName?: string;
  onScrollPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onScrollPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onScrollPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onScrollDragOver?: React.DragEventHandler<HTMLDivElement>;
  onScrollDrop?: React.DragEventHandler<HTMLDivElement>;
  onScrollDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onCanvasPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onCanvasPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onCanvasPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onCanvasPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  onCanvasMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onCanvasClick?: React.MouseEventHandler<HTMLDivElement>;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="df-timeline-scroll"
      ref={scrollRef}
      onPointerDown={onScrollPointerDown}
      onPointerMove={onScrollPointerMove}
      onPointerUp={onScrollPointerUp}
      onDragOver={onScrollDragOver}
      onDrop={onScrollDrop}
      onDragLeave={onScrollDragLeave}
      data-reuse="timeline-canvas"
    >
      <div
        ref={canvasRef}
        className={`df-timeline-canvas${canvasClassName ? ` ${canvasClassName}` : ""}`}
        style={{ height: `${height}px` }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerCancel}
        onMouseDown={onCanvasMouseDown}
        onClick={onCanvasClick}
      >
        {children}
      </div>
    </div>
  );
}

/** Scheduled task styling with controls that edit template periods. */
export function TimelineEventBlock({
  title, timeRange, style, conflicting, preview, onPointerDown, onEdit, onResizeStart, onDelete,
  editingTitle, onTitleChange, onTitleCommit, lang,
}: {
  title: string;
  timeRange?: string;
  style: CSSProperties & { height: number };
  conflicting?: boolean;
  preview?: boolean;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onEdit?: () => void;
  onResizeStart?: (edge: "start" | "end", event: React.PointerEvent<HTMLElement>) => void;
  onDelete?: () => void;
  editingTitle?: string;
  onTitleChange?: (value: string) => void;
  onTitleCommit?: (value: string) => void;
  lang: Language;
}) {
  const size = style.height < 56 ? "short" : style.height >= 120 ? "tall" : "normal";
  const label = timeRange ? title + " · " + timeRange : title;
  return (
    <TaskBlock as="div" variant="scheduled" appearance="calm"
      className="df-time-block df-template-period-block"
      density={size === "short" ? "compact" : "normal"}
      selected={editingTitle !== undefined}
      title={label}
      ariaLabel={onEdit ? label : undefined}
      style={style}
      tabIndex={onEdit ? 0 : undefined}
      dataAttrs={{ "template-period": "true", "schedule-size": size, "view-mode": "daily",
        "template-conflict": conflicting ? "true" : undefined, "template-preview": preview ? "true" : undefined }}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ") && onEdit) {
          event.preventDefault();
          onEdit();
        }
      }}
    >
      {onResizeStart && <button type="button" tabIndex={-1} className="df-resize-dot top" aria-label={t(lang, "timeBlock.adjustStart")}
        onPointerDown={(event) => onResizeStart("start", event)} />}
      <div className="df-time-card-shell">
        <TaskBlockContent className="df-time-card-main" title={editingTitle === undefined ? title : undefined}>
          {editingTitle !== undefined && <Input
            className="df-template-period-title-input"
            autoFocus
            aria-label={lang === "zh" ? "时间段名称" : "Block name"}
            value={editingTitle}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => onTitleChange?.(event.target.value)}
            onBlur={(event) => onTitleCommit?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />}
          {timeRange && <time className="df-template-period-time">{timeRange}</time>}
        </TaskBlockContent>
      </div>
      {onResizeStart && <button type="button" tabIndex={-1} className="df-resize-dot bottom" aria-label={t(lang, "timeBlock.adjustEnd")}
        onPointerDown={(event) => onResizeStart("end", event)} />}
      {onDelete && <CloseButton className="df-template-period-delete" label={lang === "zh" ? "删除时间段" : "Delete block"}
        onPointerDown={(event) => event.stopPropagation()} onClick={onDelete} />}
    </TaskBlock>
  );
}

export const DailyTimelineGrid = memo(function DailyTimelineGrid({ slotCount, dayStartHour, slotHeight }: { slotCount: number; dayStartHour: number; slotHeight: number }) {
  return <>{timelineHourSlots(slotCount, dayStartHour).map(({ index, minutes }) => {
    const isMajor = minutes % (6 * 60) === 0;
    return <div className={`df-slot hour ${isMajor ? "major" : ""}`} style={{ top: `${index * slotHeight}px` }} key={index}><span>{`${minutes / 60}:00`}</span></div>;
  })}</>;
});

export const TimelineDayBoundaries = memo(function TimelineDayBoundaries({
  anchorDate,
  bandCount,
  columnCount,
  dayStartHour,
  slotHeight,
  lang,
}: {
  anchorDate: string;
  bandCount: number;
  columnCount: number;
  dayStartHour: number;
  slotHeight: number;
  lang: Language;
}) {
  const format = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
  const startMinutes = Math.round(dayStartHour * 60);
  const startTime = minutesToTime(startMinutes);
  const minutesPastHour = startMinutes % 60;
  return <>{Array.from({ length: bandCount - 1 }, (_, index) => {
    const band = index + 1;
    const date = getContinuousTimelineDateForOffset(anchorDate, band, columnCount);
    const first = new Date(`${date}T00:00:00`);
    const weekday = weekdayName(lang, first.getDay());
    const endDate = addDays(date, columnCount - 1);
    let label: string;
    if (columnCount === 1) {
      label = lang === "zh" ? `${format.format(first)} · ${weekday}` : `${weekday}, ${format.format(first)}`;
    } else {
      const last = new Date(`${endDate}T00:00:00`);
      if (lang === "zh") {
        label = first.getMonth() === last.getMonth()
          ? `${first.getMonth() + 1}月${first.getDate()}–${last.getDate()}日`
          : `${format.format(first)}–${format.format(last)}`;
      } else {
        label = format.formatRange(first, last);
      }
    }
    const caption = columnCount > 1 ? `–${shortDateStr(lang, endDate)}` : minutesPastHour ? startTime : weekday;
    return (
      <div
        className="df-timeline-day-boundary"
        style={{
          top: dailyContinuousCanvasHeight(band, slotHeight),
          "--df-boundary-hour-offset": `${minutesPastHour / SLOT_MINUTES * slotHeight}px`,
        } as CSSProperties}
        data-date={date}
        key={date}
        role="separator"
        aria-label={`${label} · ${startTime}`}
      >
        <span aria-hidden="true">{shortDateStr(lang, date)}<br />{caption}</span>
      </div>
    );
  })}</>;
});
