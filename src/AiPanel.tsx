import React, { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Suspense, lazy } from "react";
import type { AgentAuditEntry, AgentRunState, AiConversation, Category, Language, NullablePriority, Project, RecurrenceFrequency, Settings, Subtask, Task, TaskRecurrence } from "./types";
import { type AiAction, type AiClarification, type AiStep } from "./aiAssistantApi";
import type { ParsedAttachment } from "./fileParser";
import { removeEmptyAiConversations } from "./aiConversationHistory";
import { timeBlockTop, timeBlockHeight, HOUR_HEIGHT, resizedBlockTop } from "./timelineGeometry";
import { t, weekdayName } from "./i18n";
import { term } from "./terminology";
import { candidateReturnedScheduleSummary, candidateScheduleSummary, type CandidateScheduleSummary } from "./utils/candidateSchedule";
import { normalizeTaskCheckTone } from "./utils/productivityModel";
import { addDays, addMonths, hasRecurringRule } from "./utils/recurrence";
import { countSubtasks, countDoneSubtasks } from "./utils/treeOrder";
import { TaskActions, TaskBlock, TaskBlockContent, TaskBlockDuration, TaskBlockPriority, TaskBlockRow, TaskCheckbox, TaskSubtaskShelf, type TaskBlockDragState } from "./components/TaskBlock";
import { CloseButton, IconButton } from "./components/UiPrimitives";
import { AnchoredNarrowMenu } from "./components/AnchoredNarrowMenu";
import { UiCalendarCheckIcon, UiCalendarClockIcon, UiDockSidebarIcon, UiFlagIcon, UiFolderInputIcon, UiReturnIcon, UiTrashIcon } from "./components/UiIcons";
import { clockTimeSpanMinutes } from "./utils/timelineRecords";
import { SLOT_MINUTES, ATTACHMENT_ACCEPT, AutoScheduleState, AiSessionMessage, AiClarificationQuestionsLazy, AiMarkdownLazy, addMinutes, sortAiConversations, formatMinutes, MobileSheetDismissHandle, aiStepLabel, AttachmentCard } from "./WorkspacePresentation";

export default function AiPanel({ embedded = false, demoControls, docked, onDock, input, setInput, busy, onSend, onCancel, onPlanToday, planState, onClose, messages, conversations, activeConversationId, conversationListOpen, onToggleConversationList, auditOpen, auditRuns, auditLoading, auditError, onToggleAudit, onNewConversation, onSelectConversation, onRenameConversation, onToggleConversationPinned, onDeleteConversation, memoryNotice, onOpenMemorySettings, actionPatches, onPatchAction, onConfirmAction, onDismissAction, onToggleAction, onSetAllActions, onAdoptSelected, onRejectSelected, onViewImport, onUndoImport, projectList, taskList, lang, attachment, attachmentStatus, onAttachment, onClearAttachment, model, models, onModelChange, safetyLevel, onSafetyLevelChange, onApproveAgent, onRejectAgent, onUndoAgent, globalAgentAvailable }: { embedded?: boolean; demoControls?: React.ReactNode; docked: boolean; onDock: (docked: boolean) => void; input: string; setInput: (v: string) => void; busy: boolean; onSend: (messageOverride?: string) => void | Promise<unknown>; onCancel: () => void; onPlanToday: () => void; planState: AutoScheduleState; onClose: () => void; messages: AiSessionMessage[]; conversations: AiConversation[]; activeConversationId: string; conversationListOpen: boolean; onToggleConversationList: () => void; auditOpen: boolean; auditRuns: AgentAuditEntry[]; auditLoading: boolean; auditError: string; onToggleAudit: () => void; onNewConversation: () => void; onSelectConversation: (conversationId: string) => void; onRenameConversation: (conversationId: string, title: string) => void; onToggleConversationPinned: (conversationId: string) => void; onDeleteConversation: (conversationId: string) => void; memoryNotice: string; onOpenMemorySettings: () => void; actionPatches: Record<string, Record<number, Record<string, unknown>>>; onPatchAction: (messageId: string, index: number, patch: Record<string, unknown>) => void; onConfirmAction: (messageId: string, action: AiAction, index: number) => void; onDismissAction: (messageId: string, action: AiAction, index: number) => void; onToggleAction: (messageId: string, index: number) => void; onSetAllActions: (messageId: string, checked: boolean) => void; onAdoptSelected: (messageId: string) => void; onRejectSelected: (messageId: string) => void; onViewImport: (messageId: string) => void; onUndoImport: (messageId: string) => void; projectList?: { id: string; title: string; color?: string }[]; taskList?: { id: string; title: string }[]; lang: Language; attachment?: ParsedAttachment | null; attachmentStatus?: string; onAttachment: (file: File) => void; onClearAttachment: () => void; model: string; models: readonly string[]; onModelChange: (model: string) => void; safetyLevel: Settings["aiSafetyLevel"]; onSafetyLevelChange: (level: Settings["aiSafetyLevel"]) => void; onApproveAgent: (messageId: string) => void; onRejectAgent: (messageId: string) => void; onUndoAgent: (messageId: string) => void; globalAgentAvailable: boolean }) {
  const projects = projectList || [];
  const tasks = taskList || [];
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const composerMenuRef = useRef<HTMLDivElement>(null);
  const composerMenuButtonRef = useRef<HTMLButtonElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [editMenu, setEditMenu] = useState<{ messageId: string; index: number; kind: "time" | "duration" | "project" | "type" } | null>(null);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [conversationDraftTitle, setConversationDraftTitle] = useState("");
  const [desktopBounds, setDesktopBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const resizeCursors = { n: "n-resize", ne: "ne-resize", e: "e-resize", se: "se-resize", s: "s-resize", sw: "sw-resize", w: "w-resize", nw: "nw-resize" } as const;
  const desktopInteractionRef = useRef<{
    kind: "move" | keyof typeof resizeCursors;
    pointerId: number;
    startX: number;
    startY: number;
    bounds: { left: number; top: number; width: number; height: number };
  } | null>(null);
  const isLandscapePanel = () => window.matchMedia("(min-width: 701px) and (orientation: landscape)").matches;
  const beginDesktopPanelInteraction = (event: React.PointerEvent<HTMLElement>, kind: "move" | keyof typeof resizeCursors) => {
    if (embedded || !isLandscapePanel() || docked) return;
    if (kind === "move" && (event.target as HTMLElement).closest("button, summary, input, select, textarea, label")) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    desktopInteractionRef.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      bounds: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const getDesktopResizeDirection = (event: React.PointerEvent<HTMLElement>): keyof typeof resizeCursors | null => {
    if (embedded || !isLandscapePanel() || docked) return null;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const vertical = event.clientY - rect.top <= 16 ? "n" : rect.bottom - event.clientY <= 16 ? "s" : "";
    const horizontal = event.clientX - rect.left <= 16 ? "w" : rect.right - event.clientX <= 16 ? "e" : "";
    if (!vertical && !horizontal) return null;
    return `${vertical}${horizontal}` as keyof typeof resizeCursors;
  };
  const beginDesktopResizeFromPanel = (event: React.PointerEvent<HTMLElement>) => {
    const direction = getDesktopResizeDirection(event);
    if (!direction) return;
    event.stopPropagation();
    beginDesktopPanelInteraction(event, direction);
  };
  const updateDesktopResizeCursor = (event: React.PointerEvent<HTMLElement>) => {
    if (desktopInteractionRef.current) return;
    const direction = getDesktopResizeDirection(event);
    const cursor = direction ? resizeCursors[direction] : "";
    panelRef.current?.style.setProperty("cursor", cursor);
    panelRef.current?.querySelector<HTMLElement>(".df-ai-panel-head")?.style.setProperty("cursor", cursor);
  };
  const updateDesktopPanelInteraction = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = desktopInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    const maxWidth = Math.max(420, window.innerWidth - 16);
    const maxHeight = Math.max(360, window.innerHeight - 16);
    const isMove = interaction.kind === "move";
    const resizeWest = !isMove && interaction.kind.includes("w");
    const resizeEast = !isMove && interaction.kind.includes("e");
    const resizeNorth = !isMove && interaction.kind.includes("n");
    const resizeSouth = !isMove && interaction.kind.includes("s");
    const right = interaction.bounds.left + interaction.bounds.width;
    const bottom = interaction.bounds.top + interaction.bounds.height;
    const left = isMove
      ? Math.min(Math.max(interaction.bounds.left + deltaX, 8), window.innerWidth - interaction.bounds.width - 8)
      : resizeWest
        ? Math.min(Math.max(interaction.bounds.left + deltaX, 8), right - 420)
        : interaction.bounds.left;
    const top = isMove
      ? Math.min(Math.max(interaction.bounds.top + deltaY, 8), window.innerHeight - interaction.bounds.height - 8)
      : resizeNorth
        ? Math.min(Math.max(interaction.bounds.top + deltaY, 8), bottom - 360)
        : interaction.bounds.top;
    const width = resizeWest
      ? right - left
      : resizeEast
        ? Math.min(Math.max(interaction.bounds.width + deltaX, 420), maxWidth - interaction.bounds.left)
        : interaction.bounds.width;
    const height = resizeNorth
      ? bottom - top
      : resizeSouth
        ? Math.min(Math.max(interaction.bounds.height + deltaY, 360), maxHeight - interaction.bounds.top)
        : interaction.bounds.height;
    setDesktopBounds({ left, top, width, height });
  };
  const endDesktopPanelInteraction = (event: React.PointerEvent<HTMLElement>) => {
    if (desktopInteractionRef.current?.pointerId !== event.pointerId) return;
    desktopInteractionRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  useEffect(() => {
    if (!conversationListOpen) return;
    setMobileCollapsed(false);
    setComposerMenuOpen(false);
  }, [conversationListOpen]);
  useEffect(() => {
    if (!composerMenuOpen) return;
    const closeComposerMenu = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (composerMenuRef.current?.contains(target) || composerMenuButtonRef.current?.contains(target))) return;
      setComposerMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeComposerMenu);
    return () => document.removeEventListener("pointerdown", closeComposerMenu);
  }, [composerMenuOpen]);
  useEffect(() => {
    if (!conversationMenuId) return;
    const closeConversationMenu = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".df-ai-conversation-actions")) return;
      setConversationMenuId(null);
    };
    document.addEventListener("pointerdown", closeConversationMenu);
    return () => document.removeEventListener("pointerdown", closeConversationMenu);
  }, [conversationMenuId]);
  useEffect(() => {
    if (conversationListOpen) return;
    setConversationMenuId(null);
    setRenamingConversationId(null);
  }, [conversationListOpen]);
  useLayoutEffect(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "38px";
    if (input) textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 38), 150)}px`;
  }, [input]);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !followLatestRef.current) return;
    const streaming = messages.some((message) => message.streaming);
    body.scrollTo({ top: (embedded || demoControls) && messages.length === 1 ? 0 : body.scrollHeight, behavior: streaming || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, attachmentStatus]);
  const sortedConversations = sortAiConversations(removeEmptyAiConversations(conversations));
  const activeConversationTitle = conversations.find((conversation) => conversation.id === activeConversationId)?.title;
  const conversationPreview = (conversation: AiConversation) => {
    const preview = conversation.messages.find((message) => message.role === "user")?.content
      || conversation.messages[0]?.content
      || (lang === "zh" ? "尚无消息" : "No messages yet");
    return preview.replace(/\s+/g, " ").trim();
  };
  const conversationDate = (conversation: AiConversation) => new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: new Date(conversation.updatedAt || conversation.createdAt).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(conversation.updatedAt || conversation.createdAt));
  const promptSuggestions = lang === "zh"
    ? ["把今天最重要的三件事排好", "安排 90 分钟专注学习", "把今天没完成的任务移到明天"]
    : ["Plan my three priorities for today", "Schedule 90 minutes of focused study", "Move unfinished tasks to tomorrow"];
  const text = {
    thinking: lang === "zh" ? "正在思考" : "Thinking",
    chats: lang === "zh" ? "对话" : "Chats",
    newChat: lang === "zh" ? "新对话" : "New",
    noChats: lang === "zh" ? "暂无对话" : "No conversations",
    historyTitle: lang === "zh" ? "历史对话" : "Conversation history",
    recentChats: lang === "zh" ? "最近的对话" : "Recent conversations",
    currentChat: lang === "zh" ? "当前" : "Current",
    chatUnit: lang === "zh" ? "个会话" : "conversations",
    untitled: lang === "zh" ? "未命名对话" : "Untitled",
    rename: lang === "zh" ? "重命名" : "Rename",
    pin: lang === "zh" ? "置顶" : "Pin",
    unpin: lang === "zh" ? "取消置顶" : "Unpin",
    pinned: lang === "zh" ? "已置顶" : "Pinned",
    delete: lang === "zh" ? "删除" : "Delete",
    save: lang === "zh" ? "保存" : "Save",
    cancel: lang === "zh" ? "取消" : "Cancel",
    more: lang === "zh" ? "更多会话操作" : "More conversation actions",
    parsed: lang === "zh" ? "建议操作" : "Suggested actions",
    selectAll: lang === "zh" ? "全选" : "All",
    selectNone: lang === "zh" ? "全不选" : "None",
    itemUnit: lang === "zh" ? "项" : "items",
    task: lang === "zh" ? "任务" : "Task",
    event: lang === "zh" ? "事件" : "Event",
    unassigned: lang === "zh" ? "未归属" : "Unassigned",
    cancelRound: lang === "zh" ? "取消本轮" : "Reject round",
    addSelected: lang === "zh" ? "一键添加选中项" : "Add selected",
    viewMemory: lang === "zh" ? "查看记忆" : "View memory",
    upload: lang === "zh" ? "上传文件" : "Upload file",
  };
  const timeOptions = ["08:00", "09:00", "10:00", "14:00", "16:00", "18:00", "20:00", "21:00"];
  const durationOptions = [15, 30, 45, 60, 90, 120, 150, 180];
  const latestAssistantIndex = messages.reduce((latest, message, index) => message.role === "assistant" ? index : latest, -1);
  const clarificationDisabled = (message: AiSessionMessage, index: number) => index !== latestAssistantIndex
    || messages.slice(index + 1).some((next) => next.role === "user")
    || busy
    || Boolean(message.agent?.decisionState === "pending" && message.agent.pending.length > 0);
  const menuIs = (messageId: string, index: number, kind: "time" | "duration" | "project" | "type") => editMenu?.messageId === messageId && editMenu.index === index && editMenu.kind === kind;
  const toggleMenu = (messageId: string, index: number, kind: "time" | "duration" | "project" | "type") => {
    setEditMenu((current) => current?.messageId === messageId && current.index === index && current.kind === kind ? null : { messageId, index, kind });
  };
  const patchTime = (messageId: string, index: number, action: Record<string, unknown>, startTime: string) => {
    const minutes = Number(action.durationMinutes) || (typeof action.end === "string" || typeof action.endTime === "string"
      ? Math.max(clockTimeSpanMinutes(startTime, (action.end || action.endTime) as string), SLOT_MINUTES)
      : 60);
    onPatchAction(messageId, index, { start: startTime, startTime, end: addMinutes(startTime, minutes), endTime: addMinutes(startTime, minutes), durationMinutes: minutes });
    setEditMenu(null);
  };
  const patchDuration = (messageId: string, index: number, action: Record<string, unknown>, minutes: number) => {
    const startTime = (action.start || action.startTime) as string | undefined;
    onPatchAction(messageId, index, { durationMinutes: minutes, ...(startTime ? { end: addMinutes(startTime, minutes), endTime: addMinutes(startTime, minutes) } : {}) });
    setEditMenu(null);
  };
  const patchType = (messageId: string, index: number, action: Record<string, unknown>, kind: "task" | "event") => {
    const startTime = (action.start || action.startTime || "09:00") as string;
    const minutes = Number(action.durationMinutes) || 60;
    onPatchAction(messageId, index, {
      kind,
      ...(kind === "event" ? { type: "import_schedule_item", startTime, endTime: (action.end || action.endTime || addMinutes(startTime, minutes)) } : {}),
    });
    setEditMenu(null);
  };
  const acceptAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onAttachment(file);
    event.currentTarget.value = "";
    setComposerMenuOpen(false);
  };
  const dockLabel = docked
    ? (lang === "zh" ? "恢复浮动窗口" : "Undock to floating window")
    : (lang === "zh" ? "停靠到侧栏" : "Dock to sidebar");
  return <aside ref={panelRef} className={`df-ai-panel df-ai-panel-reference${embedded ? " is-embedded" : ""}${mobileCollapsed ? " is-mobile-collapsed" : ""}${conversationListOpen ? " is-history-open" : ""}${desktopBounds ? " is-desktop-positioned" : ""}${docked ? " is-docked" : ""}`} style={desktopBounds ? { "--ai-panel-left": `${desktopBounds.left}px`, "--ai-panel-top": `${desktopBounds.top}px`, "--ai-panel-width": `${desktopBounds.width}px`, "--ai-panel-height": `${desktopBounds.height}px` } as CSSProperties : undefined} onPointerDown={embedded ? undefined : beginDesktopResizeFromPanel} onPointerMove={(event) => { updateDesktopPanelInteraction(event); updateDesktopResizeCursor(event); }} onPointerUp={endDesktopPanelInteraction} onPointerCancel={endDesktopPanelInteraction} onPointerLeave={() => { panelRef.current?.style.removeProperty("cursor"); panelRef.current?.querySelector<HTMLElement>(".df-ai-panel-head")?.style.removeProperty("cursor"); }}>
    {!embedded && <MobileSheetDismissHandle onDismiss={onClose} onCollapse={() => setMobileCollapsed(true)} onExpand={() => setMobileCollapsed(false)} collapsed={mobileCollapsed} lang={lang} />}
    <div className="df-ai-panel-head" onPointerDown={embedded ? undefined : (event) => beginDesktopPanelInteraction(event, "move")} onPointerMove={updateDesktopPanelInteraction} onPointerUp={endDesktopPanelInteraction} onPointerCancel={endDesktopPanelInteraction}>
      <div className="df-ai-panel-title">
        <strong>{conversationListOpen ? text.historyTitle : (demoControls ? (lang === "zh" ? "Navo AI · 示例体验" : "Navo AI · Example") : activeConversationTitle || "NavoPath AI")}</strong>
      </div>
      <div className="df-ai-head-actions">
        {!demoControls && <>
        <button className="df-ai-reference-tool new-chat" onClick={onNewConversation} aria-label={text.newChat} title={text.newChat}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" /><path d="m16.5 3.5 4 4L12 16l-4.5 1 1-4.5Z" /></svg></button>
        <button className={`df-ai-reference-tool history ${conversationListOpen ? "active" : ""}`} onClick={onToggleConversationList} aria-label={text.chats} title={text.chats}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3.5 2" /></svg></button>
        </>}
        {!(embedded && demoControls) && <IconButton className={`df-ai-reference-tool dock${docked ? " active" : ""}`} icon={<UiDockSidebarIcon size={18} />} label={dockLabel} aria-pressed={docked} onClick={() => {
          desktopInteractionRef.current = null;
          onDock(!docked);
        }} />}
        {!demoControls && <details className="df-ai-head-more">
          <summary className="df-ai-reference-tool" aria-label={lang === "zh" ? "更多选项" : "More options"} title={lang === "zh" ? "更多选项" : "More options"}>•••</summary>
          <div className="df-ai-head-menu">
            <button className={auditOpen ? "active" : ""} onClick={onToggleAudit}>{lang === "zh" ? "Agent 审计" : "Agent audit"}</button>
            <button onClick={onOpenMemorySettings}>{lang === "zh" ? "AI 设置" : "AI settings"}</button>
          </div>
        </details>}
        {!(embedded && demoControls) && <CloseButton className="df-ai-reference-tool close" onClick={onClose} label={t(lang, "aiPanel.close")} />}
      </div>
    </div>
    {conversationListOpen && <section className="df-ai-conversation-list" aria-label={text.historyTitle}>
      <header className="df-ai-history-head">
        <div><strong>{text.recentChats}</strong><small>{sortedConversations.length} {text.chatUnit}</small></div>
        <button type="button" onClick={onNewConversation}>{text.newChat}<span aria-hidden="true">＋</span></button>
      </header>
      <div className="df-ai-conversation-items">
        {sortedConversations.length === 0 && <div className="df-ai-history-empty"><strong>{text.noChats}</strong><small>{lang === "zh" ? "开始一段新对话后，会在这里继续。" : "Start a new conversation and return to it here."}</small></div>}
        {sortedConversations.map((conversation, conversationIndex) => {
          const active = conversation.id === activeConversationId;
          const renaming = renamingConversationId === conversation.id;
          const menuOpen = conversationMenuId === conversation.id;
          return <article key={conversation.id} className={`df-ai-conversation-row${active ? " active" : ""}${conversation.pinned ? " pinned" : ""}`}>
            {renaming ? <form className="df-ai-conversation-rename" onSubmit={(event) => {
              event.preventDefault();
              const title = conversationDraftTitle.trim();
              if (!title) return;
              onRenameConversation(conversation.id, title);
              setRenamingConversationId(null);
            }}>
              <input autoFocus maxLength={80} value={conversationDraftTitle} onChange={(event) => setConversationDraftTitle(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Escape") setRenamingConversationId(null);
              }} aria-label={text.rename} />
              <button type="submit" disabled={!conversationDraftTitle.trim()}>{text.save}</button>
              <button type="button" onClick={() => setRenamingConversationId(null)}>{text.cancel}</button>
            </form> : <>
              <button type="button" className="df-ai-conversation-main" onClick={() => onSelectConversation(conversation.id)}>
                <span className="df-ai-conversation-copy">
                  <span className="df-ai-conversation-title-line">
                    {conversation.pinned && <svg className="df-ai-conversation-pin" viewBox="0 0 24 24" aria-label={text.pinned}><path d="M9 3h6l-.8 5.1 3.3 3.3v1.1h-11v-1.1l3.3-3.3L9 3Z" /><path d="M12 12.5V21" /></svg>}
                    <strong>{conversation.title || text.untitled}</strong>
                    {active && <small className="df-ai-conversation-current">{text.currentChat}</small>}
                  </span>
                  <span className="df-ai-conversation-preview">{conversationPreview(conversation)}</span>
                  <small>{conversationDate(conversation)} · {conversation.messages.length} {lang === "zh" ? "条消息" : "messages"}</small>
                </span>
              </button>
              <div className={`df-ai-conversation-actions${menuOpen ? " open" : ""}${sortedConversations.length > 2 && conversationIndex >= sortedConversations.length - 2 ? " opens-up" : ""}`}>
                <button type="button" className="df-ai-conversation-more" aria-label={text.more} title={text.more} aria-expanded={menuOpen} onClick={() => setConversationMenuId((current) => current === conversation.id ? null : conversation.id)}>•••</button>
                {menuOpen && <div className="df-ai-conversation-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => {
                    setConversationDraftTitle(conversation.title || "");
                    setRenamingConversationId(conversation.id);
                    setConversationMenuId(null);
                  }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></svg><span>{text.rename}</span></button>
                  <button type="button" role="menuitem" onClick={() => {
                    onToggleConversationPinned(conversation.id);
                    setConversationMenuId(null);
                  }}><svg className={conversation.pinned ? "is-unpin" : ""} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-.8 5.1 3.3 3.3v1.1h-11v-1.1l3.3-3.3L9 3Z" /><path d="M12 12.5V21" />{conversation.pinned && <path className="pin-slash" d="M4 4l16 16" />}</svg><span>{conversation.pinned ? text.unpin : text.pin}</span></button>
                  <button type="button" role="menuitem" className="danger" onClick={() => {
                    onDeleteConversation(conversation.id);
                    setConversationMenuId(null);
                  }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg><span>{text.delete}</span></button>
                </div>}
              </div>
            </>}
          </article>;
        })}
      </div>
    </section>}
    {auditOpen && <div className="df-agent-audit-list">
      <header><strong>{lang === "zh" ? "Agent 审计记录" : "Agent audit history"}</strong><small>{lang === "zh" ? "保留最近 30 天，最多显示 50 条" : "Last 30 days, up to 50 runs"}</small></header>
      {auditLoading && <p>{lang === "zh" ? "正在读取…" : "Loading…"}</p>}
      {auditError && <p className="error" role="alert">{auditError}</p>}
      {!auditLoading && !auditError && auditRuns.length === 0 && <p>{lang === "zh" ? "暂无审计记录" : "No audit runs yet"}</p>}
      {auditRuns.map((run) => <article key={run.id}>
        <div><strong>{run.status}</strong><time>{new Date(run.createdAt).toLocaleString()}</time></div>
        <small>{run.trigger} · {run.tools.length} {lang === "zh" ? "次查询" : "queries"} · {run.commands.length} {lang === "zh" ? "个命令" : "commands"}</small>
        <code>{run.id}</code>
      </article>)}
    </div>}
    <div className="df-ai-panel-body" ref={bodyRef} onScroll={(event) => {
      const element = event.currentTarget;
      followLatestRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
    }}>
      {messages.length === 0 && <div className="df-ai-reference-empty">
        <div className="df-ai-reference-prompt">{demoControls ? (lang === "zh" ? "今天想推进的几件事" : "A few things for today") : (lang === "zh" ? "今天想先推进什么？" : "What would you like to move forward today?")}</div>
        {demoControls}
        {!demoControls && <div className="df-ai-reference-suggestions">
          {promptSuggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}
        </div>}
        {!demoControls && <div className={`df-ai-capability-state ${globalAgentAvailable ? "ready" : "locked"}`}>
          <span aria-hidden="true">{globalAgentAvailable ? "●" : "○"}</span>
          <small>{globalAgentAvailable ? (lang === "zh" ? "已连接工作区 · 写入前按安全等级确认" : "Workspace connected · writes follow your safety level") : (lang === "zh" ? "登录后可读取完整工作区" : "Sign in to access the full workspace")}</small>
        </div>}
      </div>}
      {messages.map((message, messageIndex) => <section key={message.id} className={`df-ai-turn ${message.role}`}>
        {message.role === "user" ? <>
          <div className="df-ai-msg-bubble user"><span>{message.content}</span></div>
          {message.attachment && <AttachmentCard attachment={message.attachment} referenced />}
          {!demoControls && message.content && <div className="df-ai-message-actions" aria-label={lang === "zh" ? "消息操作" : "Message actions"}>
            <button type="button" onClick={() => setInput(message.content)}>{lang === "zh" ? "修改" : "Edit"}</button>
            <button type="button" onClick={() => { if (navigator.clipboard) void navigator.clipboard.writeText(message.content); }}>{lang === "zh" ? "复制" : "Copy"}</button>
          </div>}
        </> : <>
          {!(embedded && demoControls) && <div className={`df-ai-assistant-label ${message.status === "thinking" ? "active" : ""}`}><span>N</span><small>NavoPath AI</small></div>}
          {message.steps && message.steps.length > 0 && <details className={`df-ai-progress ${message.status === "thinking" ? "thinking" : ""}`} open={message.status === "thinking"}>
            <summary>
              <span className="df-ai-progress-icon" aria-hidden="true">{message.status === "error" ? "!" : message.status === "thinking" ? "●" : "✓"}</span>
              <span>{message.status === "thinking" ? aiStepLabel(message.steps.find((step) => step.status === "running") || message.steps[message.steps.length - 1]!, lang) : message.status === "error" ? (lang === "zh" ? "处理失败" : "Processing failed") : (lang === "zh" ? "处理完成" : "Completed")}</span>
              <small>{message.steps.filter((step) => step.status === "done").length}/{message.steps.length}</small>
            </summary>
            <div className="df-ai-progress-detail">
              {message.steps.map((step, index) => <div className={`df-ai-step ${step.status}`} key={`${step.label}-${index}`}><span className="df-ai-step-status" aria-hidden="true">{step.status === "done" ? "✓" : step.status === "error" ? "!" : step.status === "running" ? "●" : "·"}</span><span>{aiStepLabel(step, lang)}</span></div>)}
            </div>
          </details>}
          {message.content && <div className={`df-ai-reply ${message.status === "error" ? "error" : ""}`}>{message.streaming || (embedded && demoControls && message.status === "thinking") ? <p className="df-ai-streaming-text">{message.content}</p> : <Suspense fallback={<p>{lang === "zh" ? "正在排版答案…" : "Formatting answer…"}</p>}><AiMarkdownLazy>{message.content}</AiMarkdownLazy></Suspense>}</div>}
          {message.clarifications && message.clarifications.length > 0 && <Suspense fallback={<p role="status">{lang === "zh" ? "加载中…" : "Loading…"}</p>}><AiClarificationQuestionsLazy clarifications={message.clarifications} lang={lang} disabled={clarificationDisabled(message, messageIndex)} onSubmit={onSend} /></Suspense>}
          {message.agent && <div className="df-agent-run-card">
            {message.agent.applied.length > 0 && message.agent.decisionState !== "undone" && <div className="df-agent-applied executed">
              <strong>{lang === "zh" ? `已自动执行 ${message.agent.applied.length} 项` : `${message.agent.applied.length} action(s) applied`}</strong>
              {message.agent.applied.map((action) => <span key={action.commandId}>{action.title} · {action.operation}</span>)}
              <button type="button" className="df-ai-undo-action" disabled={busy} onClick={() => onUndoAgent(message.id)} aria-label={lang === "zh" ? "撤回本轮 AI 执行" : "Undo this AI run"}>{lang === "zh" ? "撤回本轮操作" : "Undo this run"}</button>
            </div>}
            {message.agent.pending.length > 0 && message.agent.decisionState === "pending" && <div className="df-agent-confirm-card">
              <header><strong>{lang === "zh" ? "需要确认" : "Confirmation required"}</strong><small>{lang === "zh" ? `将影响 ${message.agent.pending.length} 个操作` : `${message.agent.pending.length} operation(s)`}</small></header>
              {message.agent.pending.map((command) => <article key={command.id}>
                <div><strong>{command.operation} · {command.entity}</strong>{command.targetId && <code>{command.targetId}</code>}</div>
                {command.reason && <p>{command.reason}</p>}
                {command.values && Object.keys(command.values).length > 0 && <dl>{Object.entries(command.values).filter(([key]) => !/(token|secret|password|url)/i.test(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl>}
              </article>)}
              <footer><button type="button" disabled={busy} onClick={() => onRejectAgent(message.id)}>{lang === "zh" ? "取消" : "Cancel"}</button><button type="button" className="primary" disabled={busy} onClick={() => onApproveAgent(message.id)}>{lang === "zh" ? "确认并执行" : "Confirm and apply"}</button></footer>
            </div>}
            {message.agent.forbidden && message.agent.forbidden.length > 0 && <div className="df-agent-forbidden">{lang === "zh" ? `已阻止 ${message.agent.forbidden.length} 项越权操作` : `${message.agent.forbidden.length} unauthorized action(s) blocked`}</div>}
            {message.agent.decisionState === "rejected" && <div className="df-agent-decision-outcome">{lang === "zh" ? "待确认操作已取消" : "Pending actions cancelled"}</div>}
            {message.agent.decisionState === "undone" && <div className="df-agent-decision-outcome">{lang === "zh" ? "本轮 AI 操作已撤销" : "This AI run was undone"}</div>}
          </div>}
          {message.plan && message.plan.length > 0 && <div className="df-ai-plan">
            <div className="df-ai-plan-header"><span>{lang === "zh" ? "今日时间块" : "Today's time blocks"}</span><small>{message.plan.length} {text.itemUnit}</small></div>
            {message.plan.map((block, pi) => <div key={pi} className="df-ai-plan-row">
              <span className="df-ai-plan-time mono">{block.start} - {block.end}</span>
              <span className="df-ai-plan-title">{block.title}</span>
              {block.durationMinutes ? <span className="df-ai-plan-dur">{block.durationMinutes}m</span> : null}
            </div>)}
          </div>}
          {message.actions && message.actions.length > 0 && <div className="df-ai-actions">
            <div className="df-ai-action-header"><span>{text.parsed}</span><div><button onClick={() => onSetAllActions(message.id, true)}>{text.selectAll}</button><button onClick={() => onSetAllActions(message.id, false)}>{text.selectNone}</button><small>{message.actions.length} {text.itemUnit}</small></div></div>
            {message.actions.map((action, i) => {
            const patchedAction = { ...action, ...(actionPatches[message.id]?.[i] || {}) } as AiAction;
            const a = patchedAction as Record<string, unknown>;
            const title = a.title as string || a.type as string;
            const date = a.date as string | undefined;
            const start = (a.start || a.startTime) as string | undefined;
            const end = (a.end || a.endTime) as string | undefined;
            const dur = a.durationMinutes as number | undefined;
            const projectName = (a.projectName as string) || undefined;
            const projectId = (a.projectId as string) || undefined;
            const reason = typeof a.reason === 'string' ? a.reason : undefined;
            const isSubtaskAction = patchedAction.type === "create_subtasks";
            const subtaskSuggestions = isSubtaskAction ? (patchedAction.subtasks || []) : [];
            const targetTaskTitle = isSubtaskAction
              ? tasks.find((task) => task.id === patchedAction.taskId)?.title || (lang === "zh" ? "所选任务" : "Selected task")
              : "";
            const isAccepted = patchedAction.type === "none";
            const proj = projectId ? projects.find((p: any) => String(p.id) === String(projectId)) : null;
            const finalProjectName = projectName || proj?.title || text.unassigned;
            const projColor = proj?.color;
            const kind = a.kind === "event" ? "event" : "task";
            return (
            <div key={i} className={`df-ai-task-card ${isAccepted ? "accepted" : ""}`}>
              {(patchedAction.type === "import_schedule_item" || patchedAction.type === "schedule_task") && <input className="df-ai-import-check" aria-label={lang === "zh" ? `选择 ${title}` : `Select ${title}`} type="checkbox" checked={message.selectedActions?.[i] !== false} onChange={() => onToggleAction(message.id, i)} />}
              {projColor && <span className="df-ai-task-strip" style={{ background: projColor }} />}
              <div className="df-ai-task-body">
                {isSubtaskAction ? <>
                  <div className="df-ai-task-row-top"><strong>{lang === "zh" ? `拆解「${targetTaskTitle}」` : `Break down “${targetTaskTitle}”`}</strong></div>
                  <ul className="df-ai-subtask-preview">
                    {subtaskSuggestions.map((subtask, subtaskIndex) => <li key={`${subtask.title}-${subtaskIndex}`}><span>{subtaskIndex + 1}</span><strong>{subtask.title}</strong>{subtask.estimateMinutes ? <small>{formatMinutes(subtask.estimateMinutes)}</small> : null}</li>)}
                  </ul>
                  {reason && <div className="df-ai-task-row-bot"><small>{reason}</small></div>}
                </> : <>
                  <div className="df-ai-task-row-top">
                    <strong>{title}</strong>
                    {start && end && <button className="df-ai-chip-button mono" onClick={() => toggleMenu(message.id, i, "time")}>{start} - {end}</button>}
                  </div>
                  <div className="df-ai-task-row-mid">
                    <span className="df-ai-task-project">{text.task}</span>
                    <button className="df-ai-chip-button" onClick={() => toggleMenu(message.id, i, "project")}># {finalProjectName}</button>
                    {a.recurrence ? <span className="df-ai-task-project">↻ {(a.recurrence as any).frequency}</span> : null}
                  </div>
                  <div className="df-ai-task-row-bot">
                    {dur && <button className="df-ai-chip-button" onClick={() => toggleMenu(message.id, i, "duration")}>{formatMinutes(dur)}</button>}
                    {date && <span className="df-ai-task-dur">{date}</span>}
                    {reason && <small>{reason}</small>}
                    {typeof a.warning === "string" && <small>{a.warning}</small>}
                  </div>
                  {menuIs(message.id, i, "time") && <div className="df-ai-action-menu">{timeOptions.map((option) => <button key={option} onClick={() => patchTime(message.id, i, a, option)}>{option}</button>)}</div>}
                  {menuIs(message.id, i, "duration") && <div className="df-ai-action-menu">{durationOptions.map((option) => <button key={option} onClick={() => patchDuration(message.id, i, a, option)}>{formatMinutes(option)}</button>)}</div>}
                  {menuIs(message.id, i, "project") && <div className="df-ai-action-menu"><button onClick={() => { onPatchAction(message.id, i, { projectId: "", projectName: "" }); setEditMenu(null); }}>{text.unassigned}</button>{projects.map((project) => <button key={project.id} onClick={() => { onPatchAction(message.id, i, { projectId: project.id, projectName: project.title }); setEditMenu(null); }}><span className="df-ai-project-dot" style={{ background: project.color || "var(--accent-active)" }} />{project.title}</button>)}</div>}
                </>}
              </div>
              {!isAccepted && (
                <div className="df-ai-task-actions">
                  <button className="df-ai-task-accept" aria-label={`${t(lang, "aiPanel.adopt")}: ${title}`} onClick={() => onConfirmAction(message.id, patchedAction, i)} title={t(lang, "aiPanel.adopt")}>✓</button>
                  <CloseButton className="df-ai-task-cancel" onClick={() => onDismissAction(message.id, patchedAction, i)} label={t(lang, "aiPanel.cancel")} />
                </div>
              )}
              {isAccepted && <span className="df-ai-task-done">{t(lang, "aiPanel.adopted")}</span>}
            </div>
          );})}
          {message.actions.length > 0 && <div className="df-ai-import-bulk">
            <button onClick={() => onRejectSelected(message.id)}>{text.cancelRound}</button>
            <button className="primary" disabled={!message.actions.some((_, index) => message.selectedActions?.[index] !== false)} onClick={() => onAdoptSelected(message.id)}>{text.addSelected}</button>
          </div>}
        </div>}
          {message.actionState && message.actionState !== "pending" && !(embedded && demoControls && message.actionState === "adopted") && <div className={`df-ai-action-outcome ${message.actionState}`}>
          <span>{message.actionState === "adopted" ? (lang === "zh" ? `已添加 ${message.importCommit?.addedCount || 0} 项` : `Added ${message.importCommit?.addedCount || 0} items`) : message.actionState === "undone" ? (lang === "zh" ? "已撤回本次添加" : "Changes undone") : (lang === "zh" ? "已否决本轮建议" : "Suggestions dismissed")}</span>
          {message.actionState === "adopted" && !(embedded && demoControls) && <div>
            {message.importCommit?.focus && !(embedded && demoControls) && <button onClick={() => onViewImport(message.id)}>{lang === "zh" ? "查看时间轴" : "View timeline"}</button>}
            <button onClick={() => onUndoImport(message.id)}>{lang === "zh" ? "撤回本次操作" : "Undo changes"}</button>
          </div>}
          </div>}
          {!demoControls && message.content && <div className="df-ai-message-actions" aria-label={lang === "zh" ? "消息操作" : "Message actions"}>
            <button type="button" onClick={() => setInput(message.content)}>{lang === "zh" ? "修改" : "Edit"}</button>
            <button type="button" onClick={() => { if (navigator.clipboard) void navigator.clipboard.writeText(message.content); }}>{lang === "zh" ? "复制" : "Copy"}</button>
          </div>}
        </>}
      </section>)}
    </div>
    {!(demoControls && messages.length === 0) && <div className="df-ai-panel-foot">
      {!demoControls && <button className={`df-ai-panel-plan${planState === "generating" || planState === "committing" ? " thinking" : ""}`} type="button" onClick={onPlanToday} disabled={planState === "generating" || planState === "committing"}>
        <span>{lang === "zh" ? "安排建议" : "Schedule Suggestions"}</span>
        <small>{planState === "generating" ? (lang === "zh" ? "分析中" : "Analyzing") : planState === "committing" ? (lang === "zh" ? "应用中" : "Applying") : planState === "preview" ? (lang === "zh" ? "重新生成" : "Regenerate") : (lang === "zh" ? "为今天生成时间安排" : "Build today's schedule")}</small>
      </button>}
      {memoryNotice && <button className="df-ai-memory-notice" onClick={onOpenMemorySettings}>{memoryNotice} · {text.viewMemory}</button>}
      {(attachment || attachmentStatus) && <AttachmentCard attachment={attachment ? { name: attachment.name, size: attachment.size, pageCount: attachment.pageCount, truncated: attachment.truncated, status: "ready", statusText: attachmentStatus || "文本已提取", summary: attachment.text.slice(0, 120).replace(/\s+/g, " ") } : { name: "正在解析附件", size: 0, status: "error", statusText: attachmentStatus || "正在解析", summary: "" }} onRemove={onClearAttachment} />}
      {demoControls || <div className="df-ai-composer-row">
        <textarea ref={composerTextareaRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={t(lang, "aiPanel.thinkPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} />
        <button ref={composerMenuButtonRef} type="button" className={`df-ai-attach-btn${composerMenuOpen ? " active" : ""}`} title={lang === "zh" ? "模型、安全与附件" : "Model, safety, and attachments"} aria-label={lang === "zh" ? "打开更多选项" : "Open more options"} aria-expanded={composerMenuOpen} onClick={() => setComposerMenuOpen((open) => !open)}>＋</button>
        <label className="df-ai-inline-model">
          <span className="df-visually-hidden">{lang === "zh" ? "选择模型" : "Choose model"}</span>
          <select aria-label={lang === "zh" ? "选择模型" : "Choose model"} value={model} onChange={(event) => onModelChange(event.target.value)}>{models.map((option) => <option key={option} value={option}>{option.split("/").pop() || option}</option>)}</select>
        </label>
        {composerMenuOpen && <div ref={composerMenuRef} className="df-ai-attach-menu df-ai-composer-menu">
          <label className="df-ai-composer-setting df-ai-composer-menu-model"><span>{lang === "zh" ? "模型" : "Model"}</span><select aria-label={lang === "zh" ? "选择模型" : "Choose model"} value={model} onChange={(event) => onModelChange(event.target.value)}>{models.map((option) => <option key={option} value={option}>{option.split("/").pop() || option}</option>)}</select></label>
          <label className="df-ai-composer-setting"><span>{lang === "zh" ? "权限等级" : "Permission level"}</span><select aria-label={lang === "zh" ? "选择权限等级" : "Choose permission level"} value={safetyLevel} onChange={(event) => onSafetyLevelChange(event.target.value as Settings["aiSafetyLevel"])}><option value="ask">{lang === "zh" ? "请求批准 · 编辑外部文件和使用互联网时始终询问" : "Ask for approval · Always ask for external files and internet"}</option><option value="approve">{lang === "zh" ? "帮我批准 · 仅检测到风险的操作询问" : "Help me approve · Ask only for risky operations"}</option><option value="full">{lang === "zh" ? "完全访问权限 · 自动执行普通工作区操作" : "Full access · Auto-run ordinary workspace actions"}</option></select></label>
          <div className="df-ai-composer-menu-rule" />
          {[
          [lang === "zh" ? "相机" : "Camera", "image/*", "environment"],
          [lang === "zh" ? "照片" : "Photos", "image/*", ""],
          [lang === "zh" ? "文件" : "Files", ATTACHMENT_ACCEPT, ""],
        ].map(([label, accept, capture]) => <label className="df-ai-composer-upload" key={label}>{label}<input type="file" accept={accept} capture={capture === "environment" ? "environment" : undefined} onChange={acceptAttachment} /></label>)}</div>}
        <button className="df-ai-send-btn" onClick={busy ? onCancel : () => void onSend()} disabled={!busy && !input.trim() && !attachment} title={busy ? (lang === "zh" ? "取消请求" : "Cancel request") : t(lang, "aiPanel.send")} aria-label={busy ? (lang === "zh" ? "停止生成" : "Stop generating") : t(lang, "aiPanel.send")}>{busy ? <span className="df-ai-stop-icon" aria-hidden="true" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M7 10l5-5 5 5" /></svg>}</button>
      </div>}
    </div>}
  </aside>;
}
