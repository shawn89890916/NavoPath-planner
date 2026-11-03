import { generateDeadlineAlignedPomodoroPlan } from "./plan";

export const defaults = { focusMinutes: 25, breakMinutes: 5, minWorkMinutes: 15, maxWorkMinutes: 50, longBreakMinutes: 15, minBreakMinutes: 2, minLongBreakMinutes: 5, longBreakEvery: 4, autoStartNextPhase: false, allowWorkAdjustment: true, allowBreakShortening: true };
const numeric = (value: unknown, fallback: number, max = 240) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.min(max, Math.round(Number(value))) : fallback;
const normalize = (value: any = {}) => ({ ...value, mode: "pomodoro", ...Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof fallback === "boolean" ? value[key] === undefined ? fallback : value[key] === true : numeric(key === "longBreakEvery" ? value[key] ?? value.rounds : value[key], fallback)])) });
const duration = (phase: string, round: number, p: any) => (phase === "focus" ? p.focusMinutes : round % p.longBreakEvery === 0 ? p.longBreakMinutes : p.breakMinutes) * 60000;
const tick = (runtime: any, now: number, transitions: string[] = []) => ({ ...runtime, runtime, transitions, displaySeconds: runtime.phaseEndsAt === undefined ? Math.max(0, Math.floor((now - runtime.phaseStartedAt) / 1000)) : Math.max(0, Math.ceil((runtime.phaseEndsAt - now) / 1000)), countsAsWork: runtime.phase !== "break" });

export const provider = {
  id: "pomodoro", label: { zh: "番茄钟", en: "Pomodoro" },
  description: { zh: "安排专注、短休息与长休息，并对齐任务截止时间。设置位于番茄钟插件页面。", en: "Focus, short and long breaks aligned to your task deadline. Configure in Pomodoro plugin settings." },
  normalizePreferences: normalize,
  createRuntime(now: number, value: any) { const p = normalize(value); return { mode: "pomodoro", phase: "focus", running: true, round: 1, phaseStartedAt: now, phaseEndsAt: now + p.focusMinutes * 60000 }; },
  createDeadlineRuntime(startAt: number, endAt: number, value: any) {
    const p = normalize(value);
    const plan = generateDeadlineAlignedPomodoroPlan({ startAt: new Date(startAt), endAt: new Date(endAt), preferredWorkMinutes: p.focusMinutes, minWorkMinutes: p.allowWorkAdjustment ? p.minWorkMinutes : p.focusMinutes, maxWorkMinutes: p.allowWorkAdjustment ? p.maxWorkMinutes : p.focusMinutes, preferredShortBreakMinutes: p.breakMinutes, minShortBreakMinutes: p.allowBreakShortening ? p.minBreakMinutes : p.breakMinutes, preferredLongBreakMinutes: p.longBreakMinutes, minLongBreakMinutes: p.allowBreakShortening ? p.minLongBreakMinutes : p.longBreakMinutes, longBreakEvery: p.longBreakEvery }).map((phase) => ({ ...phase, startAt: phase.startAt.getTime(), endAt: phase.endAt.getTime() }));
    // Keep the deadline exact, including seconds left within the final minute.
    if (plan.length) plan[plan.length - 1].endAt = endAt;
    else if (endAt > startAt) plan.push({ id: `phase-${startAt}`, type: "work", startAt, endAt, durationMinutes: (endAt - startAt) / 60000, index: 0 });
    return { mode: "pomodoro", phase: "focus", running: false, round: 1, phaseStartedAt: startAt, phaseEndsAt: plan[0]?.endAt || endAt, pausedAt: startAt, plan, phaseIndex: 0 };
  },
  normalizeRuntime(value: any, preferences: any, now: number) {
    const p = normalize(preferences);
    if (value?.mode !== "pomodoro") return { ...this.createRuntime(now, p), running: false, pausedAt: now };
    const runtime = { ...value, mode: "pomodoro", phase: ["focus", "break", "overrun"].includes(value.phase) ? value.phase : "focus", round: numeric(value.round, 1), phaseStartedAt: Number.isFinite(value.phaseStartedAt) && value.phaseStartedAt <= now ? value.phaseStartedAt : now };
    // One-time persisted legacy state migration; the host never interprets it.
    runtime.plan = value.plan || value.pomodoroPlan;
    runtime.phaseIndex = value.phaseIndex ?? value.currentPomodoroPhaseIndex ?? 0;
    delete runtime.pomodoroPlan; delete runtime.currentPomodoroPhaseIndex;
    if (runtime.phase !== "overrun" && !(runtime.phaseEndsAt >= runtime.phaseStartedAt)) runtime.phaseEndsAt = runtime.phaseStartedAt + duration(runtime.phase, runtime.round, p);
    if (!runtime.running && !Number.isFinite(runtime.pausedAt)) runtime.pausedAt = now;
    return runtime;
  },
  advance(value: any, preferences: any, now: number) {
    const p = normalize(preferences); let runtime = { ...value }; const transitions: string[] = [];
    if (runtime.pausedAt !== undefined) {
      if (!runtime.running) now = runtime.pausedAt;
      else {
        const shift = Math.max(0, now - runtime.pausedAt);
        runtime.phaseStartedAt += shift;
        // An aligned plan retains its absolute task deadline after a pause.
        if (!runtime.plan && runtime.phaseEndsAt !== undefined) runtime.phaseEndsAt += shift;
        delete runtime.pausedAt;
      }
    }
    // Maximum bounded by the minimum supported phase length (one minute).
    for (let i = 0; runtime.running && runtime.phaseEndsAt !== undefined && now >= runtime.phaseEndsAt && i < 100000; i++) {
      const end = runtime.phaseEndsAt;
      transitions.push(runtime.phase === "focus" ? "pomodoro:focusComplete" : "pomodoro:breakComplete");
      const nextIndex = (runtime.phaseIndex || 0) + 1;
      const next = runtime.plan?.[nextIndex];
      if (runtime.plan && !next) { runtime = { ...runtime, phase: "overrun", phaseStartedAt: end }; delete runtime.phaseEndsAt; break; }
      const phase = next ? next.type === "work" ? "focus" : "break" : runtime.phase === "focus" ? "break" : "focus";
      const round = phase === "focus" ? runtime.round + 1 : runtime.round;
      runtime = { ...runtime, phase, round, phaseStartedAt: next?.startAt ?? end, phaseEndsAt: next?.endAt ?? end + duration(phase, round, p), phaseIndex: next ? nextIndex : undefined };
      if (!p.autoStartNextPhase) { runtime.running = false; runtime.pausedAt = end; now = end; break; }
    }
    return tick(runtime, now, transitions);
  },
  workMilliseconds(value: any, preferences: any, from: number, now: number) {
    if (!value.running || value.pausedAt !== undefined || now <= from) return 0;
    const p = normalize(preferences);
    if (value.plan) {
      const limit = p.autoStartNextPhase ? now : Math.min(now, value.phaseEndsAt ?? now);
      const work = value.plan.filter((phase: any) => phase.type === "work").reduce((sum: number, phase: any) => sum + Math.max(0, Math.min(limit, phase.endAt) - Math.max(from, phase.startAt)), 0);
      const finalEnd = value.plan.at(-1)?.endAt;
      return work + (finalEnd && p.autoStartNextPhase ? Math.max(0, now - Math.max(from, finalEnd)) : value.phase === "overrun" ? Math.max(0, now - from) : 0);
    }
    let cursor = Math.max(from, value.phaseStartedAt), phase = value.phase, round = value.round, end = value.phaseEndsAt ?? now, work = 0;
    for (let i = 0; cursor < now && i < 100000; i++) {
      const stop = Math.min(end, now); if (phase !== "break") work += Math.max(0, stop - cursor); cursor = stop;
      if (cursor >= now || !p.autoStartNextPhase) break;
      phase = phase === "focus" ? "break" : "focus"; if (phase === "focus") round++; end += duration(phase, round, p);
    }
    return work;
  },
  notification(transition: string, lang: string) {
    const text = lang === "zh" ? { "pomodoro:focusComplete": { title: "专注结束", body: "该休息一下了。" }, "pomodoro:breakComplete": { title: "休息结束", body: "准备开始下一轮专注。" } } : { "pomodoro:focusComplete": { title: "Focus complete", body: "Time for a break." }, "pomodoro:breakComplete": { title: "Break complete", body: "Ready for the next focus round." } };
    return (text as any)[transition];
  },
};

export default {
  onload(ctx: any) {
    const zh = ctx.language === "zh";
    const title = zh ? "番茄钟" : "Pomodoro";
    const open = () => ctx.timers.open("pomodoro");
    const withSettings = (value: any) => normalize({ ...value, ...ctx.settings.get() });
    const mode: any = { ...provider };
    for (const name of ["normalizePreferences", "createRuntime", "normalizeRuntime", "advance", "workMilliseconds", "createDeadlineRuntime"]) {
      mode[name] = (...args: any[]) => {
        const index = name === "normalizePreferences" ? 0 : name === "normalizeRuntime" || name === "advance" || name === "workMilliseconds" ? 1 : name === "createDeadlineRuntime" ? 2 : 1;
        args[index] = withSettings(args[index]); return (provider as any)[name].apply(provider, args);
      };
    }
    ctx.timers.registerMode(mode);
    ctx.ui.addHeaderItem(title, (container: HTMLElement) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "navopath-plugin-header-button"; button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3"/></svg>';
      button.setAttribute("aria-label", zh ? "打开番茄钟" : "Open Pomodoro");
      const reorderHint = zh ? " · 拖动调整插件顺序" : " · Drag to reorder plugins";
      button.title = (zh ? "番茄钟" : "Pomodoro") + reorderHint;
      button.setAttribute("aria-label", (zh ? "打开番茄钟" : "Open Pomodoro") + reorderHint);
      const offState = ctx.events.on("timer:changed", (value: any) => {
        const active = value?.mode === "pomodoro";
        button.dataset.running = String(active && value?.running === true);
        const phase = value?.phase === "break" ? (zh ? "休息" : "Break") : value?.phase === "overrun" ? (zh ? "超时" : "Overtime") : (zh ? "专注" : "Focus");
        const remaining = Math.max(0, Number(value?.displaySeconds) || 0);
        const clock = Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
        const detail = active ? " · " + phase + " " + clock : "";
        button.title = (zh ? "番茄钟" : "Pomodoro") + detail + reorderHint;
        button.setAttribute("aria-label", (zh ? "打开番茄钟" : "Open Pomodoro") + detail + reorderHint);
      });
      const off = ctx.on(button, "click", open); container.append(button);
      return () => { off(); offState(); button.remove(); };
    });
    ctx.settings.registerPage(ctx.language === "zh" ? "番茄钟" : "Pomodoro", (container: HTMLElement) => {
      const form = document.createElement("form"); form.className = "navopath-plugin-settings navopath-pomodoro";
      const help = document.createElement("p"); help.textContent = zh ? "顶部「番茄钟」或「插件工具 → 打开番茄钟」打开专注界面，点「开始」即可专注，可随时暂停。当前时间有时间轴任务时会关联并记录实际专注用时；未关联任务时仅计时。休息不计入任务用时。未关联的专注在「重置」后才会重新关联当前任务。" : "Use Pomodoro in the header or Plugin tools → Open Pomodoro, then Start or Pause. An active timeline task receives focus work logs; without one, focus runs without a task log. Breaks never count as work. Reset an unlinked session to link a newly active task.";
      const launch = document.createElement("button"); launch.type = "button"; launch.textContent = zh ? "打开番茄钟" : "Open Pomodoro"; const offLaunch = ctx.on(launch, "click", open); form.append(help, launch);
      const labels: any = { focusMinutes: ["偏好专注（分钟）", "Preferred focus (minutes)"], breakMinutes: ["短休息（分钟）", "Short break (minutes)"], rounds: ["每组轮数", "Rounds per set"], minWorkMinutes: ["最短专注", "Minimum focus"], maxWorkMinutes: ["最长专注", "Maximum focus"], longBreakMinutes: ["长休息", "Long break"], minBreakMinutes: ["最短短休息", "Minimum short break"], minLongBreakMinutes: ["最短长休息", "Minimum long break"], longBreakEvery: ["长休息周期", "Long break every"], autoStartNextPhase: ["自动开始下一阶段", "Start next phase automatically"], allowWorkAdjustment: ["允许调整专注时长", "Adjust focus duration"], allowBreakShortening: ["允许缩短休息", "Shorten breaks"] };
      const current = withSettings({});
      for (const [key, fallback] of Object.entries(defaults)) {
        const row = document.createElement("label"); const text = document.createElement("span"); text.textContent = labels[key][zh ? 0 : 1];
        const input = document.createElement("input"); input.name = key; input.type = typeof fallback === "boolean" ? "checkbox" : "number"; input.min = "1"; input.max = "240"; input.value = String(current[key]); input.checked = current[key] === true; row.append(text, input); form.append(row);
      }
      const save = document.createElement("button"); save.type = "submit"; save.textContent = zh ? "保存" : "Save"; form.append(save);
      form.onsubmit = async (event) => { event.preventDefault(); const result: any = {}; for (const [key, fallback] of Object.entries(defaults)) { const input = form.elements.namedItem(key) as HTMLInputElement; result[key] = typeof fallback === "boolean" ? input.checked : Number(input.value); } await ctx.settings.save(normalize(result)); ctx.ui.toast(zh ? "番茄钟设置已保存" : "Pomodoro settings saved"); };
      container.append(form); return () => { offLaunch(); form.remove(); };
    });
  },
};
