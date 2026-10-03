import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  lazy,
} from "react";
import {
  TaskCard,
  TimeBlock,
  PreviewBlock,
  AiPanel,
  themeVars,
  type PlacementPreview,
  type AiSessionMessage,
  type ResizePreview,
  COMPACT_LAYOUT_MEDIA_QUERY,
  minutesToTime,
} from "./WorkspacePresentation";
import {
  ExecutionSplitLayout,
  CandidatePanelShell,
  CandidatePanelHeader,
  TimelineCanvas,
  DailyTimelineGrid,
} from "./components/ExecutionSharedLayout";
import { Button } from "./components/UiPrimitives";
import { getDefaultSettings } from "./defaultSettings";
import { useUnifiedDrag } from "./unifiedDrag";
import {
  pointerToDateTime,
  HOUR_HEIGHT,
  addDays,
  timeToMinutes,
} from "./timelineGeometry";
import {
  toggleTodayCandidate,
  promoteSubtaskToToday,
} from "./utils/todayCandidates";
import { toggleSubtaskInTree } from "./utils/treeOrder";
import {
  createDemoData,
  DEMO_DATE,
  DEMO_STAMP,
  firstDemoSlot,
  rescheduleDemoTomorrow,
  scheduleDemoTask,
} from "./productDemoData";
import {
  isDemoCommand,
  siteLanguage,
  type ProductFeature,
} from "./productSite";
import type { Language, PlannerData, Task } from "./types";
import { undoAiImportData } from "./utils/aiImportUndo";
import type { AiAction } from "./aiAssistantApi";
import "./app.css";
import "./ui-primitives.css";
import "./ai-history-actions.css";
import "./product-demo.css";

const PlanningView = lazy(() => import("./PlanningView"));
const noop = () => {};
export default function ProductDemo({ feature }: { feature: ProductFeature }) {
  const [lang, setLang] = useState<Language>(() =>
    siteLanguage(location.search, navigator.language),
  );
  const [stage, setStage] = useState(0);
  const [data, setData] = useState(() => createDemoData(lang, feature, 0));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    learning: true,
    life: true,
  });
  const [pane, setPane] = useState<"tasks" | "timeline">("tasks");
  const [preview, setPreview] = useState<PlacementPreview>(null);
  const [displayDate, setDisplayDate] = useState(DEMO_DATE);
  const [resizePreview, setResizePreview] = useState<ResizePreview>(null);
  const [hovered, setHovered] = useState("");
  const [selected, setSelected] = useState("content");
  const [notice, setNotice] = useState("");
  const [messages, setMessages] = useState<AiSessionMessage[]>([]);
  const [patches, setPatches] = useState<
    Record<string, Record<number, Record<string, unknown>>>
  >({});
  const [visible, setVisible] = useState(true);
  const [compact, setCompact] = useState(
    () => matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches,
  );
  const scroll = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const current = useRef(data);
  current.current = data;
  const sentInteraction = useRef(false);
  const lastStage = useRef("");
  const id = useRef(0);
  const resizeCleanup = useRef(noop);
  useEffect(() => () => resizeCleanup.current(), []);
  const zh = lang === "zh";
  const settings = { ...getDefaultSettings(), theme: "light" as const };
  const notify = useCallback((type: "ready" | "interacting") => {
    if (parent !== window)
      parent.postMessage(
        { channel: "navopath-product-demo", type },
        location.origin,
      );
  }, []);
  const interact = () => {
    if (!sentInteraction.current) {
      sentInteraction.current = true;
      notify("interacting");
    }
  };
  const update = (taskId: string, patch: Partial<Task>) =>
    setData((state) => ({
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      ),
    }));
  const schedule = (
    taskId: string,
    date: string,
    start: string,
    minutes?: number,
  ) => {
    const next = scheduleDemoTask(
      current.current,
      taskId,
      date,
      start,
      minutes,
    );
    if (next === current.current) {
      setNotice(
        zh
          ? "这个时段无法容纳任务，请换一个空档。"
          : "This slot does not fit. Choose another open time.",
      );
      return;
    }
    setData(next);
    setDisplayDate(date);
    setPreview(null);
    setSelected(taskId);
    setPane("timeline");
    setNotice(
      zh
        ? `已安排到 ${date.slice(5)} ${start}`
        : `Scheduled for ${date.slice(5)} at ${start}`,
    );
  };
  const showPreview = (task: Task) => {
    const start = firstDemoSlot(current.current, task.id);
    if (!start) {
      setNotice(
        zh
          ? "示例一天没有合适的空档。"
          : "No suitable slot in this example day.",
      );
      return;
    }
    const duration = Math.round((task.estimatedHours || 0.5) * 60);
    setPreview({
      taskId: task.id,
      date: DEMO_DATE,
      startTime: start,
      endTime: "",
      durationMinutes: duration,
      source: "candidate-calendar",
    });
  };
  const generate = (
    state = current.current,
    language = lang,
  ): AiSessionMessage => {
    let working = state;
    const actions: AiAction[] = state.tasks
      .filter(
        (task) =>
          !task.id.startsWith("event_occ_") &&
          !task.completed &&
          !task.scheduledStart,
      )
      .slice(0, 3)
      .flatMap((task) => {
        const start = firstDemoSlot(working, task.id);
        if (!start) return [];
        working = scheduleDemoTask(working, task.id, DEMO_DATE, start);
        const planned = working.tasks.find((item) => item.id === task.id)!;
        return [
          {
            type: "import_schedule_item" as const,
            title: task.title,
            notes: task.id,
            date: DEMO_DATE,
            startTime: start,
            endTime: planned.scheduledEnd,
            durationMinutes: Math.round((task.estimatedHours || 0.5) * 60),
            projectId: task.projectId,
            reason:
              language === "zh"
                ? "避开已有安排，留出完整时间。"
                : "A complete block around existing commitments.",
          },
        ];
      });
    return {
      id: `suggestion-${++id.current}`,
      role: "assistant",
      content:
        language === "zh"
          ? "这是示例安排。你可以修改时间和时长，再应用选中的建议。"
          : "Here is an example schedule. Edit the times and durations, then apply selected suggestions.",
      createdAt: DEMO_STAMP,
      actions,
      actionState: "pending",
      status: "done",
    };
  };
  const undo = (messageId?: string) => {
    const message = messageId ? messages.find((item) => item.id === messageId) : [...messages].reverse().find((item) => item.importCommit && item.actionState !== "undone");
    if (!message?.importCommit || message.actionState === "undone") {
      setNotice(zh ? "还没有应用的操作。" : "There are no applied changes yet.");
      return;
    }
    setData((state) => undoAiImportData(state, message.importCommit!));
    setMessages((items) => items.map((item) => item.id === message.id ? { ...item, actionState: "undone", actions: [], importCommit: undefined } : item));
    setNotice(zh ? "已撤回本轮操作。" : "The changes were undone.");
  };
  const apply = (messageId: string, onlyIndex?: number) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message?.actions || message.actionState !== "pending") return;
    let next = current.current;
    const accepted: number[] = [];
    message.actions.forEach((action, index) => {
      if (
        (onlyIndex !== undefined && onlyIndex !== index) ||
        message.selectedActions?.[index] === false ||
        action.type === "none"
      )
        return;
      const a = { ...action, ...patches[messageId]?.[index] } as Extract<
        AiAction,
        { type: "import_schedule_item" }
      >;
      const task = next.tasks.find((item) => item.id === a.notes);
      if (!task || !a.startTime || !a.date) return;
      const result = scheduleDemoTask(
        next,
        task.id,
        a.date,
        a.startTime,
        a.durationMinutes,
      );
      if (result === next) return;
      next = {
        ...result,
        tasks: result.tasks.map((item) =>
          item.id === task.id
            ? { ...item, projectId: a.projectId || undefined }
            : item,
        ),
      };
      accepted.push(index);
    });
    if (!accepted.length) {
      setNotice(
        zh
          ? "建议时间有冲突，请调整后再应用。"
          : "The suggested times conflict. Adjust them before applying.",
      );
      return;
    }
    const previousById = new Map((message.importCommit?.previousTasks || []).map((task) => [task.id, task]));
    accepted.forEach((index) => {
      const action = message.actions![index];
      if (action.type !== "import_schedule_item") return;
      const previous = current.current.tasks.find((task) => task.id === action.notes);
      if (previous && !previousById.has(previous.id)) previousById.set(previous.id, previous);
    });
    setData(next);
    setMessages((items) =>
      items.map((item) => {
        if (item.id !== messageId) return item;
        const remaining = item.actions?.filter((_, i) => !accepted.includes(i));
        return {
          ...item,
          actions: remaining,
          selectedActions: Object.fromEntries(
            (item.actions || []).flatMap((_, index) =>
              accepted.includes(index)
                ? []
                : [
                    [
                      index - accepted.filter((i) => i < index).length,
                      item.selectedActions?.[index] !== false,
                    ],
                  ],
            ),
          ),
          actionState: remaining?.length ? "pending" : "adopted",
          importCommit: {
            focus: { date: DEMO_DATE, source: "autoschedule" },
            addedCount:
              (message.importCommit?.addedCount || 0) + accepted.length,
            addedTaskIds: [],
            addedEventIds: [],
            previousTasks: [...previousById.values()],
          },
        };
      }),
    );
    setPatches((state) => ({
      ...state,
      [messageId]: Object.fromEntries(
        (message.actions || []).flatMap((_, index) =>
          accepted.includes(index)
            ? []
            : [
                [
                  index - accepted.filter((i) => i < index).length,
                  state[messageId]?.[index] || {},
                ],
              ],
        ),
      ),
    }));
    setNotice(
      zh
        ? `已应用 ${accepted.length} 项示例安排。`
        : `Applied ${accepted.length} example schedules.`,
    );
  };
  useEffect(() => {
    document.documentElement.classList.add("product-demo-document");
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== parent ||
        !isDemoCommand(event.data)
      )
        return;
      const command = event.data;
      if (command.type === "visibility") {
        setVisible(Boolean(command.visible));
        return;
      }
      const key = `${command.stage}:${command.lang}`;
      if (
        command.type !== "reset" &&
        key === lastStage.current &&
        !sentInteraction.current
      )
        return;
      resizeCleanup.current();
      lastStage.current = key;
      sentInteraction.current = false;
      const initial = createDemoData(command.lang, feature, command.stage);
      setLang(command.lang);
      setStage(command.stage);
      setDisplayDate(DEMO_DATE);
      setResizePreview(null);
      setData(initial);
      setCollapsed(
        command.stage === 0
          ? { website: true, learning: true, life: true }
          : { learning: true, life: true },
      );
      setPreview(null);
      setNotice("");
      setSelected("content");
      setPane(feature === "ai" || command.stage === 0 ? "tasks" : "timeline");
      setPatches({});
      if (feature === "ai" && command.stage >= 1) {
        const message = generate(initial, command.lang);
        if (command.stage >= 2 && message.actions) message.actions = message.actions.map((action, index) => index === 0 && action.type === "import_schedule_item" ? { ...action, startTime: "13:30", endTime: "14:30", durationMinutes: 60 } : action);
        if (command.stage === 3) {
          let applied = initial;
          message.actions?.forEach((action) => {
            if (
              action.type === "import_schedule_item" &&
              action.notes &&
              action.startTime
            )
              applied = scheduleDemoTask(
                applied,
                action.notes,
                DEMO_DATE,
                action.startTime,
                action.durationMinutes,
              );
          });
          setData(applied);
          setMessages([
            {
              ...message,
              actions: [],
              actionState: "adopted",
              importCommit: {
                focus: { date: DEMO_DATE, source: "autoschedule" },
                addedCount: 3,
                addedTaskIds: [],
                addedEventIds: [],
                previousTasks: initial.tasks.filter((task) => message.actions?.some((action) => action.type === "import_schedule_item" && action.notes === task.id)),
              },
            },
          ]);
        } else setMessages([message]);
      } else setMessages([]);
    };
    addEventListener("message", receive);
    notify("ready");
    const resize = () =>
      setCompact(matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches);
    addEventListener("resize", resize);
    return () => {
      removeEventListener("message", receive);
      removeEventListener("resize", resize);
      document.documentElement.classList.remove("product-demo-document");
    };
  }, [feature, notify]);
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = HOUR_HEIGHT;
  }, [stage, pane]);
  const drag = useUnifiedDrag();
  const target = (pointer: { x: number; y: number }) => {
    if (!canvas.current || !scroll.current) return null;
    const rect = scroll.current.getBoundingClientRect();
    if (
      pointer.x < rect.left ||
      pointer.x > rect.right ||
      pointer.y < rect.top ||
      pointer.y > rect.bottom
    )
      return null;
    return pointerToDateTime({
      clientX: pointer.x,
      clientY: pointer.y,
      gridElement: canvas.current,
      scrollElement: scroll.current,
      visibleDays: [displayDate],
      startHour: 8,
      endHour: 18,
      hourHeight: HOUR_HEIGHT,
      snapMinutes: 15,
    });
  };
  const beginDrag = (event: React.PointerEvent, task: Task) => {
    if (
      task.id.startsWith("event_occ_") ||
      (event.target as HTMLElement).closest("button,input,select,textarea")
    )
      return;
    drag.beginDrag(event as React.PointerEvent<HTMLElement>, {
      taskId: task.id,
      requireHoldMs: compact ? 350 : 0,
      onActivate: () => {
        interact();
        setPane("timeline");
      },
      onMove: (pointer) => {
        const slot = target(pointer);
        if (slot)
          setPreview({
            taskId: task.id,
            date: slot.date,
            startTime: slot.startTime,
            endTime: "",
            durationMinutes: Math.round((task.estimatedHours || 0.5) * 60),
            source: "candidate-calendar",
          });
      },
      onDrop: (pointer) => {
        const slot = target(pointer);
        if (slot) schedule(task.id, slot.date, slot.startTime);
        else setPreview(null);
      },
      onCancel: () => setPreview(null),
    });
  };
  const resizeBlock = (
    event: React.PointerEvent,
    task: Task,
    edge: "start" | "end",
  ) => {
    event.stopPropagation();
    event.preventDefault();
    interact();
    resizeCleanup.current();
    const initialY = event.clientY,
      initialStart = timeToMinutes(task.scheduledStart!),
      initialEnd = timeToMinutes(task.scheduledEnd!);
    const times = (clientY: number) => {
      const difference =
        Math.round((((clientY - initialY) / HOUR_HEIGHT) * 60) / 15) * 15;
      const start =
        edge === "start"
          ? Math.min(
              initialEnd - 15,
              Math.max(8 * 60, initialStart + difference),
            )
          : initialStart;
      const end =
        edge === "end"
          ? Math.max(
              initialStart + 15,
              Math.min(18 * 60, initialEnd + difference),
            )
          : initialEnd;
      const format = (minutes: number) =>
        `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      return { start: format(start), end: format(end), duration: end - start };
    };
    const move = (pointer: PointerEvent) => {
      const next = times(pointer.clientY);
      setResizePreview({
        taskId: task.id,
        start: next.start,
        end: next.end,
        startDate: task.scheduledDate!,
      });
    };
    const cancel = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", finish);
      removeEventListener("pointercancel", cancel);
      setResizePreview(null);
      resizeCleanup.current = noop;
    };
    resizeCleanup.current = cancel;
    const finish = (endEvent: PointerEvent) => {
      const next = times(endEvent.clientY);
      cancel();
      schedule(task.id, task.scheduledDate!, next.start, next.duration);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", finish, { once: true });
    addEventListener("pointercancel", cancel, { once: true });
  };
  const toggleDone = (task: Task) =>
    update(task.id, {
      completed: !task.completed,
      executionStatus: task.completed ? "scheduled" : "completed",
      timelineRecords: task.timelineRecords?.map((r) => ({
        ...r,
        executionStatus: task.completed ? "scheduled" : "completed",
      })),
    });
  const candidates = data.tasks.filter(
    (task) =>
      !task.id.startsWith("event_occ_") &&
      task.plannedForDate === DEMO_DATE &&
      !task.scheduledStart &&
      !task.completed,
  );
  const taskCards = (list: Task[]) =>
    list.map((task) => (
      <div
        key={task.id}
        className="df-candidate-task-row"
        data-candidate-task-id={task.id}
      >
        <TaskCard
          demo
          task={task}
          projects={data.projects}
          focusDate={DEMO_DATE}
          placementPreview={preview}
          placementChoices={preview?.taskId === task.id ? [preview] : []}
          lang={lang}
          onQuickDuration={(minutes) =>
            update(task.id, { estimatedHours: minutes / 60 })
          }
          onProjectChange={(projectId) => update(task.id, { projectId })}
          onDelete={noop}
          onToggleDone={() => toggleDone(task)}
          onClick={() => {
            setSelected(task.id);
            showPreview(task);
          }}
          onPointerDragStart={(event) => beginDrag(event, task)}
          onStartPlacementPreview={() => showPreview(task)}
          onCancelPlacementPreview={() => setPreview(null)}
          onConfirmPlacementPreview={() => {
            if (preview) schedule(task.id, preview.date, preview.startTime);
          }}
          onConfirmPlacementChoice={(choice) =>
            schedule(task.id, choice.date, choice.startTime)
          }
          onScheduleDate={(date) => {
            const start = firstDemoSlot(current.current, task.id, date);
            if (start) schedule(task.id, date, start);
          }}
          onSaveDueDate={(dueDate) => update(task.id, { dueDate })}
          onSaveRecurrence={noop}
          onMarkUnfinished={() => update(task.id, { completed: false })}
          onUnschedule={() =>
            update(task.id, {
              scheduledDate: undefined,
              scheduledStart: undefined,
              scheduledEnd: undefined,
              timelineRecords: [],
            })
          }
          onToggleSubtask={(subtaskId) =>
            update(task.id, {
              subtasks: toggleSubtaskInTree(task.subtasks || [], subtaskId),
            })
          }
        />
      </div>
    ));
  const selectedTask = data.tasks.find(
    (task) => task.id === selected && !task.id.startsWith("event_occ_"),
  );
  const timeline = (
    <section
      className={`df-timeline-panel demo-timeline ${compact ? (pane === "timeline" ? "compact-active" : "compact-inactive") : ""}`}
    >
      <div className="demo-date">
        {displayDate.slice(5).replace("-", " / ")} ·{" "}
        {zh ? "示例一天" : "Example day"}
      </div>
      <TimelineCanvas
        scrollRef={scroll}
        canvasRef={canvas}
        height={10 * HOUR_HEIGHT}
        canvasClassName="df-day-timeline"
      >
        <DailyTimelineGrid
          slotCount={41}
          dayStartHour={8}
          slotHeight={HOUR_HEIGHT / 4}
          anchorDate={displayDate}
        />
        {data.tasks
          .filter(
            (task) => task.scheduledDate === displayDate && task.scheduledStart,
          )
          .map((task) => (
            <TimeBlock
              key={task.id}
              task={task}
              preview={resizePreview?.taskId === task.id ? resizePreview : null}
              projectName={
                data.projects.find((p) => p.id === task.projectId)?.title || ""
              }
              projects={data.projects}
              hovered={hovered === task.id}
              onHover={setHovered}
              onSelect={() => setSelected(task.id)}
              onEdit={() => setSelected(task.id)}
              onToggleDone={() => toggleDone(task)}
              onTaskUpdate={(patch) => update(task.id, patch)}
              projectInteractive={false}
              onProjectChange={noop}
              onProjectColorChange={noop}
              onCreateProject={noop}
              onDragStart={(event) => beginDrag(event, task)}
              onResizeStart={(event, edge) => resizeBlock(event, task, edge)}
              extraStyle={{ left: 8, width: "calc(100% - 16px)" }}
              viewMode="daily"
              lang={lang}
              dayStartHour={8}
            />
          ))}
        {preview && (
          <PreviewBlock
            task={data.tasks.find((task) => task.id === preview.taskId)}
            date={preview.date}
            startTime={preview.startTime}
            duration={preview.durationMinutes}
            onConfirm={() =>
              schedule(preview.taskId, preview.date, preview.startTime)
            }
            lang={lang}
            dayStartHour={8}
            extraStyle={{ "--df-preview": "1" } as React.CSSProperties}
          />
        )}
      </TimelineCanvas>
    </section>
  );
  const aiControls = (
    <div className="demo-ai-controls">
      <span>
        {zh ? "示例体验 · 固定回复" : "Example experience · Preset responses"}
      </span>
      <div>
        {[
          zh ? "安排今天" : "Schedule today",
          zh ? "调整一项安排" : "Adjust a task",
          zh ? "撤回本轮操作" : "Undo this run",
        ].map((label, index) => (
          <Button
            key={label}
            variant="ghost"
            onClick={() => {
              if (index === 2) {
                undo();
                return;
              }
              if (index === 0) {
                setMessages((items) => [...items, generate()]);
                return;
              }
              const task = current.current.tasks.find(
                (item) => item.id === "content",
              )!;
              setMessages((items) => [
                ...items,
                {
                  id: `suggestion-${++id.current}`,
                  role: "assistant",
                  content: zh
                    ? "试试把网站内容安排到 14:00。应用前可以再调整。"
                    : "Try website content at 14:00. Adjust it before applying.",
                  createdAt: DEMO_STAMP,
                  actionState: "pending",
                  actions: [
                    {
                      type: "import_schedule_item",
                      title: task.title,
                      notes: task.id,
                      date: DEMO_DATE,
                      startTime: "14:00",
                      endTime: "14:45",
                      durationMinutes: 45,
                      projectId: task.projectId,
                    },
                  ],
                },
              ]);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
  const aiPanel = (
    <AiPanel
      embedded
      demoControls={aiControls}
      onDock={noop}
      docked
      input=""
      setInput={noop}
      busy={false}
      onSend={noop}
      onCancel={noop}
      onPlanToday={() => setMessages((items) => [...items, generate()])}
      planState={
        messages.some((m) => m.actionState === "pending") ? "preview" : "idle"
      }
      onClose={noop}
      messages={messages}
      conversations={[]}
      activeConversationId=""
      conversationListOpen={false}
      onToggleConversationList={noop}
      auditOpen={false}
      auditRuns={[]}
      auditLoading={false}
      auditError=""
      onToggleAudit={noop}
      onNewConversation={noop}
      onSelectConversation={noop}
      onRenameConversation={noop}
      onToggleConversationPinned={noop}
      onDeleteConversation={noop}
      memoryNotice=""
      onOpenMemorySettings={noop}
      actionPatches={patches}
      onPatchAction={(messageId, index, patch) =>
        setPatches((state) => ({
          ...state,
          [messageId]: {
            ...state[messageId],
            [index]: { ...state[messageId]?.[index], ...patch },
          },
        }))
      }
      onConfirmAction={(messageId, _action, index) => apply(messageId, index)}
      onDismissAction={(messageId, _action, index) => {
        setMessages((items) =>
          items.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  actions: m.actions?.filter((_, i) => i !== index),
                  selectedActions: Object.fromEntries(
                    (m.actions || []).flatMap((_, i) =>
                      i === index
                        ? []
                        : [
                            [
                              i > index ? i - 1 : i,
                              m.selectedActions?.[i] !== false,
                            ],
                          ],
                    ),
                  ),
                }
              : m,
          ),
        );
        setPatches((state) => ({
          ...state,
          [messageId]: Object.fromEntries(
            Object.entries(state[messageId] || {}).flatMap(([i, patch]) =>
              Number(i) === index
                ? []
                : [[Number(i) > index ? Number(i) - 1 : Number(i), patch]],
            ),
          ),
        }));
      }}
      onToggleAction={(messageId, index) =>
        setMessages((items) =>
          items.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  selectedActions: {
                    ...m.selectedActions,
                    [index]: m.selectedActions?.[index] === false,
                  },
                }
              : m,
          ),
        )
      }
      onSetAllActions={(messageId, checked) =>
        setMessages((items) =>
          items.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  selectedActions: Object.fromEntries(
                    (m.actions || []).map((_, i) => [i, checked]),
                  ),
                }
              : m,
          ),
        )
      }
      onAdoptSelected={(messageId) => apply(messageId)}
      onRejectSelected={(messageId) =>
        setMessages((items) =>
          items.map((m) =>
            m.id === messageId
              ? { ...m, actions: [], actionState: "rejected" }
              : m,
          ),
        )
      }
      onViewImport={() => setPane("timeline")}
      onUndoImport={undo}
      projectList={data.projects}
      taskList={data.tasks}
      lang={lang}
      onAttachment={noop}
      onClearAttachment={noop}
      model="Example"
      models={["Example"]}
      onModelChange={noop}
      safetyLevel="ask"
      onSafetyLevelChange={noop}
      onApproveAgent={noop}
      onRejectAgent={noop}
      onUndoAgent={undo}
      globalAgentAvailable={false}
    />
  );
  return (
    <div
      className={`df-app mode-${feature === "planning" ? "planning" : "execute"} theme-light type-editorial product-demo${!visible ? " demo-offscreen" : ""}${feature === "ai" ? " demo-ai" : ""}`}
      style={themeVars(
        settings,
        feature === "planning" ? "planning" : "execute",
      )}
      onPointerDownCapture={interact}
      onKeyDownCapture={interact}
    >
      <div className="demo-toolbar">
        <strong>
          NavoPath /{" "}
          {feature === "planning"
            ? zh
              ? "规划"
              : "Planning"
            : feature === "ai"
              ? "Navo AI"
              : zh
                ? "执行"
                : "Execute"}
        </strong>
        <span>{zh ? "示例一天" : "Example day"}</span>
      </div>
      {notice && (
        <p className="demo-notice" role="status">
          {notice}
        </p>
      )}
      {feature === "planning" ? (
        <PlanningView
          key={`${lang}:${stage}`}
          demo
          initialViewMode={stage === 2 ? "kanban" : "tree"}
          lang={lang}
          referenceDate={DEMO_DATE}
          data={data}
          projects={data.projects}
          tasks={data.tasks}
          compact={compact}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onToggleTodayCandidate={(taskId) =>
            setData(
              (state) =>
                toggleTodayCandidate(state, taskId, DEMO_DATE, DEMO_STAMP).data,
            )
          }
          onPromoteSubtaskToToday={(parentId, subtaskId) =>
            setData(
              (state) =>
                promoteSubtaskToToday(
                  state,
                  parentId,
                  subtaskId,
                  DEMO_DATE,
                  () => `promoted-${++id.current}`,
                  DEMO_STAMP,
                ).data,
            )
          }
          onProjectEdit={(project) =>
            setCollapsed((state) => ({
              ...state,
              [project.id]: !state[project.id],
            }))
          }
          onTaskEdit={(task) =>
            setData(
              (state) =>
                toggleTodayCandidate(state, task.id, DEMO_DATE, DEMO_STAMP)
                  .data,
            )
          }
          onTaskUpdate={update}
          onTaskCreate={noop}
          onTaskDelete={noop}
          onDeleteSubtask={noop}
          onDataChange={setData}
          featureMetrics={false}
        />
      ) : feature === "ai" && stage > 0 ? (
        <>
          <div className="demo-pane-tabs demo-ai-tabs">
            <Button
              variant="ghost"
              aria-pressed={pane === "tasks"}
              onClick={() => setPane("tasks")}
            >
              {zh ? "AI 建议" : "AI suggestions"}
            </Button>
            <Button
              variant="ghost"
              aria-pressed={pane === "timeline"}
              onClick={() => setPane("timeline")}
            >
              {zh ? "时间轴" : "Timeline"}
            </Button>
          </div>
          <ExecutionSplitLayout
            className={`demo-execution demo-ai-execution pane-${pane}`}
            left={<div className="demo-ai-panel">{aiPanel}</div>}
            right={timeline}
          />
        </>
      ) : (
        <>
          <div className="demo-pane-tabs">
            <Button
              variant="ghost"
              aria-pressed={pane === "tasks"}
              onClick={() => setPane("tasks")}
            >
              {zh ? "任务" : "Tasks"}
            </Button>
            <Button
              variant="ghost"
              aria-pressed={pane === "timeline"}
              onClick={() => setPane("timeline")}
            >
              {zh ? "时间轴" : "Timeline"}
            </Button>
          </div>
          <ExecutionSplitLayout
            className={`demo-execution pane-${pane}`}
            left={
              <CandidatePanelShell
                className={
                  compact
                    ? pane === "tasks"
                      ? "compact-active"
                      : "compact-inactive"
                    : undefined
                }
              >
                <CandidatePanelHeader
                  title={zh ? "今日候选" : "Today's Candidates"}
                />
                <div className="df-candidate-list">
                  {taskCards(candidates)}
                  {!candidates.length && (
                    <p className="demo-empty">
                      {zh
                        ? "已选任务已安排到时间轴。"
                        : "The selected tasks are on the timeline."}
                    </p>
                  )}
                </div>
              </CandidatePanelShell>
            }
            right={timeline}
          />
          {selectedTask && (
            <div className="demo-task-controls">
              <span>{selectedTask.title}</span>
              <Button
                variant="ghost"
                onClick={() => {
                  const start = firstDemoSlot(data, selectedTask.id);
                  if (start) schedule(selectedTask.id, DEMO_DATE, start);
                }}
              >
                {zh ? "安排到空档" : "Schedule in a free slot"}
              </Button>
              {selectedTask.scheduledStart && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      schedule(
                        selectedTask.id,
                        displayDate,
                        minutesToTime(
                          timeToMinutes(selectedTask.scheduledStart!) - 15,
                        ),
                      )
                    }
                  >
                    {zh ? "提前 15 分钟" : "15 min earlier"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      schedule(
                        selectedTask.id,
                        displayDate,
                        minutesToTime(
                          timeToMinutes(selectedTask.scheduledStart!) + 15,
                        ),
                      )
                    }
                  >
                    {zh ? "延后 15 分钟" : "15 min later"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      schedule(
                        selectedTask.id,
                        displayDate,
                        selectedTask.scheduledStart!,
                        Math.round((selectedTask.estimatedHours || 0.5) * 60) +
                          15,
                      )
                    }
                  >
                    {zh ? "延长 15 分钟" : "15 min longer"}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  const next = rescheduleDemoTomorrow(data, selectedTask.id);
                  setData(next);
                  setDisplayDate(addDays(DEMO_DATE, 1));
                  setPane("timeline");
                  setNotice(
                    zh
                      ? "已安排到明天的空档。"
                      : "Scheduled in tomorrow's free time.",
                  );
                }}
              >
                {zh ? "移至明天" : "Move to tomorrow"}
              </Button>
            </div>
          )}
        </>
      )}
      {feature === "planning" && (
        <div className="demo-candidate-count" role="status">
          {zh ? "今日候选" : "Today's Candidates"} ·{" "}
          {data.tasks.filter((t) => t.plannedForDate === DEMO_DATE).length}
        </div>
      )}
      {feature === "ai" && stage > 0 && (
        <div className="demo-ai-result" role="status">
          {zh ? "示例时间轴" : "Example timeline"}:{" "}
          {data.tasks
            .filter((t) => !t.id.startsWith("event_occ_") && t.scheduledStart)
            .map((t) => `${t.scheduledStart} ${t.title}`)
            .join(" · ") || (zh ? "等待应用安排" : "Waiting for a schedule")}
        </div>
      )}
      {drag.overlay}
    </div>
  );
}
