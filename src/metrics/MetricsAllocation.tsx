import React,{useEffect,useMemo,useRef,useState} from "react";
import type { Language } from "../types";
import type { TimeAllocationGroup,TimeAllocationMetrics,MetricDisplayMetric } from "./timeAllocation";
import { projectColorInk } from "../utils/presentationColor";
function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function donutSegmentPath(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) {
  const safeEndAngle = Math.min(endAngle, startAngle + 359.99);
  const outerStart = polarPoint(cx, cy, outerRadius, safeEndAngle);
  const outerEnd = polarPoint(cx, cy, outerRadius, startAngle);
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
  const innerEnd = polarPoint(cx, cy, innerRadius, safeEndAngle);
  const largeArc = safeEndAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

/* ============================================================
 * Donut annotation system — compact 2-segment leader + side label
 *
 * Every annotation is a short 2-segment polyline:
 *   anchor (circle edge + 4) → elbow (radial tick at outer+34) → lineEnd
 *   (elbow + ±horizontalLength on the segment's side)
 *
 * The label sits BESIDE the line end (not on top of a rail):
 *   right side: labelX = lineEnd.x + 8, textAnchor "start"
 *   left side:  labelX = lineEnd.x - 8, textAnchor "end"
 *
 * EVERY segment gets a permanent external label — project names are
 * standing annotations, not hover tooltips. No percentage/top-N
 * filtering, no hide-on-overflow. A single sort-and-push pass per
 * side resolves Y overlaps; if the lane overflows its safe band the
 * whole lane shifts up so all labels stay visible and within bounds.
 * Hover only re-anchors the active segment's anchor point so the
 * leader still touches the expanded arc; elbow, lineEnd and label
 * positions stay put — hover never hides or reshuffles other labels.
 * ============================================================ */

interface DonutAnnotationResult {
  id: string;
  label: string;
  color: string;
  side: "left" | "right";
  arcMidAngle: number;
  /** Label text x. */
  labelX: number;
  /** Label text y. */
  labelY: number;
  textAnchor: "start" | "end";
  /** Elbow + lineEnd kept for hover re-anchoring (computed at non-hover radius). */
  elbowX: number;
  elbowY: number;
  lineEndX: number;
  lineEndY: number;
}

const DONUT_HORIZONTAL_LENGTH = 42;
const DONUT_LABEL_PAD_X = 8;
const DONUT_LABEL_BIAS_Y = 4;
const DONUT_MIN_LABEL_GAP = 20;

/**
 * Build annotation results for ALL donut segments. Every segment gets
 * a permanent external label — no top-N / percentage filtering, no
 * hide-on-overflow. anchor/elbow/lineEnd come from the segment's
 * mid-angle; label sits beside the line end. A single sort-and-push
 * pass per side resolves Y overlaps; if the lane overflows its safe
 * band the whole lane shifts up so all labels stay visible and within
 * the chart area.
 */
function layoutDonutAnnotations(
  cx: number,
  cy: number,
  visualOuter: number,
  segments: Array<{ group: { id: string; label: string; color: string }; startAngle: number; endAngle: number }>,
): DonutAnnotationResult[] {
  const anchorOffset = 4;
  const elbowRadius = visualOuter + 34;
  const labelMinY = cy - visualOuter - 64;
  const labelMaxY = cy + visualOuter + 64;

  // Phase 1: per-segment geometry — anchor, elbow, lineEnd, label.
  const raw = segments.map(({ group, startAngle, endAngle }) => {
    const mid = (startAngle + endAngle) / 2;
    const radians = (mid - 90) * Math.PI / 180;
    const side: "left" | "right" = Math.cos(radians) >= 0 ? "right" : "left";
    const anchor = polarPoint(cx, cy, visualOuter + anchorOffset, mid);
    const elbow = polarPoint(cx, cy, elbowRadius, mid);
    const lineEndX = elbow.x + (side === "right" ? DONUT_HORIZONTAL_LENGTH : -DONUT_HORIZONTAL_LENGTH);
    const lineEndY = elbow.y;
    const labelX = side === "right" ? lineEndX + DONUT_LABEL_PAD_X : lineEndX - DONUT_LABEL_PAD_X;
    const labelY = lineEndY + DONUT_LABEL_BIAS_Y;
    return {
      id: group.id,
      label: group.label,
      color: group.color,
      side,
      arcMidAngle: mid,
      anchorX: anchor.x,
      anchorY: anchor.y,
      elbowX: elbow.x,
      elbowY: elbow.y,
      lineEndX,
      lineEndY,
      labelX,
      labelY,
      idealY: labelY,
    };
  });

  // Phase 2: per-side Y collision resolution (sort + push down, then
  // shift the whole lane up if it overflowed, then clamp). No hiding —
  // every segment keeps its label.
  (["left", "right"] as const).forEach((side) => {
    const lane = raw.filter((n) => n.side === side).sort((a, b) => a.idealY - b.idealY);
    if (lane.length === 0) return;
    for (let i = 1; i < lane.length; i++) {
      if (lane[i].labelY - lane[i - 1].labelY < DONUT_MIN_LABEL_GAP) {
        lane[i].labelY = lane[i - 1].labelY + DONUT_MIN_LABEL_GAP;
        lane[i].lineEndY = lane[i].labelY - DONUT_LABEL_BIAS_Y;
      }
    }
    // If the lane overflowed downward, shift the whole lane back up so
    // the last label stays within labelMaxY; then clamp each label to
    // the safe band as a final guard.
    const overflow = lane[lane.length - 1].labelY - labelMaxY;
    if (overflow > 0) {
      for (const n of lane) {
        n.labelY -= overflow;
        n.lineEndY -= overflow;
      }
    }
    for (const n of lane) {
      if (n.labelY < labelMinY) {
        const dy = labelMinY - n.labelY;
        n.labelY = labelMinY;
        n.lineEndY += dy;
      } else if (n.labelY > labelMaxY) {
        const dy = n.labelY - labelMaxY;
        n.labelY = labelMaxY;
        n.lineEndY -= dy;
      }
    }
  });

  // Phase 3: build result. The render layer rebuilds the path so the
  // active segment's anchor can follow the hover-expanded outer radius
  // while elbow/lineEnd/label stay stable.
  return raw.map((n) => ({
    id: n.id,
    label: n.label,
    color: n.color,
    side: n.side,
    arcMidAngle: n.arcMidAngle,
    labelX: n.labelX,
    labelY: n.labelY,
    textAnchor: (n.side === "right" ? "start" : "end") as "start" | "end",
    elbowX: n.elbowX,
    elbowY: n.elbowY,
    lineEndX: n.lineEndX,
    lineEndY: n.lineEndY,
  }));
}

function formatMinutesZh(minutes: number) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
function alphaColor(color:string,alpha:number){return "color-mix(in srgb, "+color+" "+alpha*100+"%, transparent)";}
export default function MetricsAllocation(props:{lang:Language;engagementEnabled?:boolean;metricsResult:TimeAllocationMetrics;display:MetricDisplayMetric;onAdjustRange:()=>void}){
  const {metricsResult}=props;
  const donutSvgRef=useRef<SVGSVGElement>(null);
  const [hoveredMetricGroupId,setHoveredMetricGroupId]=useState<string|null>(null);
  const [selectedMetricGroupId,setSelectedMetricGroupId]=useState<string|null>(null);
  useEffect(() => {
    setSelectedMetricGroupId((id) => id && metricsResult.groups.some((group) => group.id === id) ? id : null);
  }, [metricsResult.groups]);
  const selectedMetricGroup = metricsResult.groups.find((group) => group.id === selectedMetricGroupId) || null;
  const hoveredMetricGroup = metricsResult.groups.find((group) => group.id === hoveredMetricGroupId) || null;
  const activeDonutGroup = hoveredMetricGroup || selectedMetricGroup;
  const donutSegments = metricsResult.groups.reduce<Array<{ group: TimeAllocationGroup; startAngle: number; endAngle: number }>>((segments, group) => {
    const startAngle = segments.length > 0 ? segments[segments.length - 1].endAngle : 0;
    const endAngle = startAngle + (group.percentage / 100) * 360;
    segments.push({ group, startAngle, endAngle });
    return segments;
  }, []);

  /**
   * Compact 2-segment leader layout for donut outside labels. EVERY
   * segment gets a permanent external label — no top-N / percentage
   * filtering, no hide-on-overflow. Layout uses the NON-hovered outer
   * radius so labels don't jump when a segment expands; the active
   * segment's anchor re-anchors to its hovered radius while
   * elbow/lineEnd/label positions stay stable.
   */
  const donutAnnotations = useMemo(() => {
    if (donutSegments.length === 0) return [];
    return layoutDonutAnnotations(120, 120, 88, donutSegments);
  }, [donutSegments]);

  /**
   * Convert a pointer position to a donut segment by angle. The SVG viewBox
   * is mapped to the rendered element via getBoundingClientRect, so this
   * works regardless of CSS size. Distance from center must be within
   * hitRadius (hoveredOuterRadius + 4) or the hover is cleared. Inside that
   * radius, the angle determines which segment is hovered — including the
   * center hole area, so hovering near the center still picks the correct
   * project by angle.
   */
  const computeHoveredSegment = (clientX: number, clientY: number): string | null => {
    const svg = donutSvgRef.current;
    if (!svg || donutSegments.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const vb = svg.viewBox.baseVal;
    if (!vb || vb.width === 0) return null;
    const x = (clientX - rect.left) * (vb.width / rect.width) + vb.x;
    const y = (clientY - rect.top) * (vb.height / rect.height) + vb.y;
    const dx = x - 120;
    const dy = y - 120;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = 98;
    if (distance > hitRadius) return null;
    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const segment = donutSegments.find((s) => angle >= s.startAngle && angle < s.endAngle);
    return segment?.group.id ?? null;
  };
  const metricValue=(g:TimeAllocationGroup)=>props.display==="taskCount"?g.taskCount:props.display==="completionRate"?g.completionRate*100:g.durationMinutes;
  const groups=[...metricsResult.groups].sort((a,b)=>metricValue(b)-metricValue(a));
  const selected=selectedMetricGroup;
  const max=Math.max(1,...groups.map(metricValue));
  return <>
              {metricsResult.taskEntries.length === 0 ? (
                <div className="df-metrics-empty">
                  <h3>{props.lang === "zh" ? "暂无时间安排" : "No scheduled time"}</h3>
                  <p>{props.lang === "zh" ? "这个时间范围内还没有安排任务。把任务拖入时间轴后，这里会显示时间占比。" : "Schedule tasks on the timeline and this report will show allocation."}</p>
                  <button type="button" className="df-metrics-text-action" onClick={() => props.onAdjustRange()}>{props.lang === "zh" ? "调整筛选" : "Adjust filters"}</button>
                </div>
              ) : (
                <>
                  {props.display==="percentage"?<div className="df-metrics-main-grid">
                    <section className="df-metrics-panel df-metrics-donut-panel">
                      <div className="df-metrics-panel-head">
                        <h3>{props.lang === "zh" ? "项目时间占比图" : "Allocation chart"}</h3>
                        <span>{metricsResult.range.label}</span>
                      </div>
                      <div className="df-metrics-donut-focus" aria-live="polite">
                        <span>{selectedMetricGroup?.label || (props.lang === "zh" ? "项目总时长" : "Total project time")}</span>
                        <strong>{formatMinutesZh(selectedMetricGroup?.durationMinutes ?? metricsResult.summary.plannedMinutes)}</strong>
                      </div>
                      <div className="df-metrics-donut-wrap">
                        <svg ref={donutSvgRef} className="df-metrics-donut" viewBox="-70 0 380 240" role="img" aria-label={props.lang === "zh" ? "项目时间占比图" : "Project time allocation chart"}>
                          <circle className="df-metrics-donut-rule" cx="120" cy="120" r="82" />
                          {/* Visual layer: actual donut arcs. pointer-events none —
                              all pointer events are handled by the hit disk on top. */}
                          <g className="df-metrics-donut-visual-layer">
                            {donutSegments.map(({ group, startAngle, endAngle }) => {
                              const isActive = activeDonutGroup?.id === group.id;
                              return (
                                <path
                                  key={`arc-${group.id}`}
                                  className={`df-metrics-donut-segment${isActive ? " active" : ""}`}
                                  d={donutSegmentPath(120, 120, isActive ? 94 : 88, 50, startAngle, endAngle)}
                                  fill={alphaColor(projectColorInk(group.color), 0.58)}
                                  aria-hidden="true"
                                />
                              );
                            })}
                          </g>
                          {/* Label layer: short 2-segment leader + side label.
                              pointer-events none so they never interfere with
                              the hit disk. EVERY segment renders a permanent
                              label — project names are standing annotations,
                              not hover tooltips. The active segment's anchor
                              re-anchors to the hovered outer radius so the
                              leader still touches the expanded arc; elbow/
                              lineEnd/label stay put (no jump, no reshuffle). */}
                          <g className="df-metrics-donut-label-layer">
                            {donutAnnotations.map((ann) => {
                              const isActive = activeDonutGroup?.id === ann.id;
                              // Anchor follows the (possibly expanded) outer radius;
                              // elbow + lineEnd are precomputed at the resting radius
                              // so the label position never moves on hover.
                              const anchor = polarPoint(120, 120, (isActive ? 94 : 88) + 4, ann.arcMidAngle);
                              const path = `M ${anchor.x} ${anchor.y} L ${ann.elbowX} ${ann.elbowY} L ${ann.lineEndX} ${ann.lineEndY}`;
                              return (
                                <g key={`label-${ann.id}`} className={isActive ? "is-active" : ""} data-active={isActive || undefined}>
                                  <path className="df-metrics-donut-leader" d={path} />
                                  <text
                                    className="df-metrics-donut-label"
                                    x={ann.labelX}
                                    y={ann.labelY}
                                    textAnchor={ann.textAnchor}
                                    dominantBaseline="alphabetic"
                                  >{ann.label}</text>
                                </g>
                              );
                            })}
                          </g>
                          {/* Single hit disk on top: transparent circle that handles
                              ALL pointer events. Hover is computed by angle from the
                              pointer position relative to center, so the cursor never
                              flickers between SVG elements. The disk radius (98) covers
                              the donut band and center hole but not the label area. */}
                          <circle
                            className="df-metrics-donut-hit-disk"
                            cx={120}
                            cy={120}
                            r={98}
                            tabIndex={0}
                            role="application"
                            aria-label={props.lang === "zh" ? "项目时间占比圆环图，点击扇区查看项目时长" : "Project time allocation donut, select a segment to view its duration"}
                            onPointerMove={(e) => setHoveredMetricGroupId(computeHoveredSegment(e.clientX, e.clientY))}
                            onPointerLeave={() => setHoveredMetricGroupId(null)}
                            onClick={(e) => {
                              const groupId = computeHoveredSegment(e.clientX, e.clientY);
                              setSelectedMetricGroupId((current) => current === groupId ? null : groupId);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                const groupId = hoveredMetricGroupId || donutSegments[0]?.group.id || null;
                                setSelectedMetricGroupId((current) => current === groupId ? null : groupId);
                              }
                            }}
                            onFocus={() => {
                              if (donutSegments.length > 0 && !hoveredMetricGroupId) {
                                setHoveredMetricGroupId(donutSegments[0].group.id);
                              }
                            }}
                            onBlur={() => setHoveredMetricGroupId(null)}
                          />
                        </svg>
                        <div className="df-metrics-donut-center">
                          <div className="df-metrics-donut-center-desktop">
                            {activeDonutGroup ? (
                              <>
                                <div className="df-metrics-donut-center-label"><span>{activeDonutGroup.label}</span></div>
                                <strong>{formatMinutesZh(activeDonutGroup.durationMinutes)}</strong>
                                <span>{Math.round(activeDonutGroup.percentage)}%</span>
                              </>
                            ) : (
                              <>
                                <strong>{formatMinutesZh(metricsResult.summary.plannedMinutes)}</strong>
                                <span>{metricsResult.range.label}</span>
                              </>
                            )}
                          </div>
                          <strong className="df-metrics-donut-center-portrait">{formatMinutesZh(metricsResult.summary.plannedMinutes)}</strong>
                        </div>
                      </div>
                      <div className="df-metrics-donut-legend" role="group" aria-label={props.lang === "zh" ? "项目图例" : "Allocation legend"}>
                        {metricsResult.groups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            className={selectedMetricGroupId === group.id ? "is-active" : ""}
                            aria-pressed={selectedMetricGroupId === group.id}
                            aria-label={`${group.label}${props.lang === "zh" ? "，" : ", "}${formatMinutesZh(group.durationMinutes)}`}
                            title={`${group.label} · ${formatMinutesZh(group.durationMinutes)}`}
                            onClick={() => setSelectedMetricGroupId((current) => current === group.id ? null : group.id)}
                          >
                            <span className="df-metrics-donut-legend-dot" style={{ backgroundColor: projectColorInk(group.color) }} aria-hidden="true" />
                            <span>{group.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                    <aside className="df-metrics-summary" aria-label={props.lang === "zh" ? "指标摘要" : "Metrics summary"}>
                      <div><span>{props.engagementEnabled ? (props.lang === "zh" ? "加权时长" : "Weighted time") : (props.lang === "zh" ? "已安排时间" : "Planned")}</span><strong>{formatMinutesZh(metricsResult.summary.plannedMinutes)}</strong></div>
                      <div><span>{props.lang === "zh" ? "未安排时间" : "Unplanned"}</span><strong>{formatMinutesZh(metricsResult.summary.unplannedMinutes)}</strong></div>
                      <div><span>{props.lang === "zh" ? "任务数量" : "Tasks"}</span><strong>{metricsResult.summary.taskCount}</strong></div>
                      <div><span>{props.lang === "zh" ? "完成率" : "Done"}</span><strong>{Math.round(metricsResult.summary.completionRate * 100)}%</strong></div>
                    </aside>
                  </div>:<div className="df-metric-insight-content">{groups.map(g=><button key={g.id} type="button" className="df-metric-group-row" aria-pressed={selectedMetricGroupId===g.id} onClick={()=>setSelectedMetricGroupId(id=>id===g.id?null:g.id)}><span>{g.label}</span><progress max={max} value={metricValue(g)}/><strong>{props.display==="duration"?formatMinutesZh(g.durationMinutes):props.display==="completionRate"?Math.round(metricValue(g))+"%":g.taskCount}</strong></button>)}</div>}
                </>
              )}
    {selected&&<div className="df-metric-insight-table"><h3>{selected.label}</h3><table><thead><tr><th>{props.lang==="zh"?"任务":"Task"}</th><th>{props.lang==="zh"?"日期":"Date"}</th><th>{props.lang==="zh"?"时长":"Duration"}</th></tr></thead><tbody>{selected.tasks.slice(0,200).map((e,i)=><tr key={e.recordId+":"+i}><td>{e.title}</td><td>{e.scheduledStart.toLocaleDateString()}</td><td>{formatMinutesZh(e.durationMinutes)}</td></tr>)}</tbody></table>{selected.tasks.length>200&&<p>{props.lang==="zh"?"仅显示前 200 条时间片段。":"Showing first 200 interval slices."}</p>}</div>}
  </>;
}
