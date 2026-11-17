"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Goal, Habit, Mode, Phase, Reflection, Session, Settings, State, Task, Timer } from "./types";
import { dateKey, nextDue, todayKey, uid } from "./utils";

const KEY = "grindbox:v1";

export const MODES: Record<Mode, { label: string; min: number | null }> = {
  deep: { label: "Deep Work", min: 50 },
  study: { label: "Study", min: 25 },
  creative: { label: "Creative Work", min: 40 },
  quick: { label: "Quick Tasks", min: 15 },
  custom: { label: "Custom", min: null },
};

export const defaultSettings: Settings = {
  name: "",
  theme: "system",
  timeZone: "",
  dateFormat: "ISO",
  weekStart: 1,
  notifications: false,
  workMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  availableHours: 6,
  hoursStart: "09:00",
  hoursEnd: "17:00",
  gamification: true,
  categories: ["Work", "Studies", "Personal", "Health", "Projects", "Finance", "Other"],
  challenges: [],
  onboarded: false,
};

const empty: State = {
  tasks: [],
  habits: [],
  goals: [],
  sessions: [],
  reflections: [],
  settings: defaultSettings,
  timer: null,
  review: null,
};

export const newTask = (p: Partial<Task> & { title: string }): Task => ({
  notes: "",
  priority: "medium",
  status: "todo",
  spentMin: 0,
  subtasks: [],
  recurring: "none",
  postponed: 0,
  procLog: [],
  createdAt: Date.now(),
  ...p,
  category: p.category || "Other",
  id: p.id ?? uid(),
});

const workMs = (s: Settings, mode: Mode) => (MODES[mode].min ?? s.workMin) * 60000;

/** Pure: finish the running phase. Work phases log a session and queue a progress review. */
function completeTimer(s: State): State {
  const t = s.timer;
  if (!t || t.endsAt === null || Date.now() < t.endsAt) return s;
  if (t.phase !== "work") {
    return { ...s, timer: { ...t, phase: "work", totalMs: workMs(s.settings, t.mode), remainingMs: workMs(s.settings, t.mode), endsAt: null } };
  }
  const minutes = Math.round(t.totalMs / 60000);
  const session: Session = { id: uid(), taskId: t.taskId, mode: t.mode, minutes, finishedAt: t.endsAt };
  const tz = s.settings.timeZone;
  const today = dateKey(Date.now(), tz);
  const count = s.sessions.filter((x) => dateKey(x.finishedAt, tz) === today).length + 1;
  const phase: Phase = count % s.settings.longEvery === 0 ? "long" : "short";
  const ms = (phase === "long" ? s.settings.longMin : s.settings.shortMin) * 60000;
  return {
    ...s,
    sessions: [...s.sessions, session],
    tasks: s.tasks.map((x) => (x.id === t.taskId ? { ...x, spentMin: x.spentMin + minutes } : x)),
    review: session.id,
    timer: { ...t, phase, totalMs: ms, remainingMs: ms, endsAt: null },
  };
}

/** Pure: stop a work session now and log the time actually worked (needs at least a minute). */
function finishEarly(s: State): State {
  const t = s.timer;
  if (!t || t.phase !== "work") return s;
  const left = t.endsAt !== null ? Math.max(0, t.endsAt - Date.now()) : t.remainingMs;
  const minutes = Math.floor((t.totalMs - left) / 60000);
  if (minutes < 1) return { ...s, timer: null };
  const session: Session = { id: uid(), taskId: t.taskId, mode: t.mode, minutes, finishedAt: Date.now() };
  return {
    ...s,
    sessions: [...s.sessions, session],
    tasks: s.tasks.map((x) => (x.id === t.taskId ? { ...x, spentMin: x.spentMin + minutes } : x)),
    review: session.id,
    timer: null,
  };
}

function notify(title: string, body: string, on: boolean) {
  if (on && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
}

interface Ctx {
  s: State;
  ready: boolean;
  today: string;
  saveTask: (t: Task) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  toggleSubtask: (taskId: string, subId: string) => void;
  postpone: (id: string) => void;
  logProcrastination: (id: string, reason: string) => void;
  setTop: (id: string, date: string | undefined) => void;
  saveHabit: (h: Habit) => void;
  deleteHabit: (id: string) => void;
  toggleHabitDay: (id: string, day: string) => void;
  saveGoal: (g: Goal) => void;
  deleteGoal: (id: string) => void;
  startTimer: (o: { taskId?: string; mode?: Mode; minutes?: number }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  finishTimerEarly: () => void;
  dismissReview: () => void;
  dismissReminder: (id: string) => void;
  reviewSession: (id: string, progress: "yes" | "some" | "no") => void;
  saveReflection: (r: Reflection) => void;
  updateSettings: (p: Partial<Settings>) => void;
  addCategory: (c: string) => void;
  patch: (fn: (s: State) => State) => void;
  exportData: () => void;
  resetAll: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(empty);
  const [ready, setReady] = useState(false);
  const live = useRef(s);
  useEffect(() => {
    live.current = s;
  });

  // Load after mount so server and first client render match; localStorage is client-only.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as State;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setS({ ...empty, ...p, settings: { ...defaultSettings, ...p.settings } });
      }
    } catch (e) {
      console.error("GrindBox: could not read saved data", e);
    }
    setReady(true);
  }, []);

  // Another tab changed the data: adopt it instead of overwriting it with stale state.
  const fromOtherTab = useRef(false);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const p = JSON.parse(e.newValue) as State;
        fromOtherTab.current = true;
        setS({ ...empty, ...p, settings: { ...defaultSettings, ...p.settings } });
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      console.error("GrindBox: could not save data", e);
    }
  }, [s, ready]);

  useEffect(() => {
    if (!ready) return; // until settings load, keep what the pre-paint script chose
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle("dark", s.settings.theme === "dark" || (s.settings.theme === "system" && dark.matches));
    apply();
    dark.addEventListener("change", apply);
    return () => dark.removeEventListener("change", apply);
  }, [s.settings.theme, ready]);

  // Timer: wall-clock endsAt, checked on an interval and on tab return, so it survives navigation and throttling.
  const running = s.timer?.endsAt != null;
  useEffect(() => {
    if (!running) return;
    const check = () => {
      const before = live.current;
      const after = completeTimer(before);
      if (after !== before) {
        setS(after);
        if (before.timer?.phase === "work") notify("Focus session complete", "Did you make progress?", before.settings.notifications);
        else notify("Break over", "Ready for the next session?", before.settings.notifications);
      }
    };
    const id = setInterval(check, 500);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [running]);

  // Reminders: one browser notification per task; the in-app banner stays until dismissed.
  const notified = useRef(new Set<string>());
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const cur = live.current;
      const nowLocal = dateKey(Date.now()) + "T" + new Date().toTimeString().slice(0, 5);
      cur.tasks
        .filter((t) => t.remind && !t.reminded && t.remind <= nowLocal && t.status !== "done" && !notified.current.has(t.id))
        .forEach((t) => {
          notified.current.add(t.id);
          notify("Reminder", t.title, cur.settings.notifications);
        });
    }, 15000);
    return () => clearInterval(id);
  }, [ready]);

  const patch = useCallback((fn: (s: State) => State) => setS(fn), []);
  // Empty until mounted: the clock must not be read during prerender.
  const today = ready ? todayKey(s.settings) : "";

  const api = useMemo<Ctx>(() => {
    const T = (fn: (t: Task[], st: State) => Task[]) => setS((p) => ({ ...p, tasks: fn(p.tasks, p) }));
    const upsert = <X extends { id: string }>(list: X[], x: X) => (list.some((y) => y.id === x.id) ? list.map((y) => (y.id === x.id ? x : y)) : [...list, x]);
    const setTimer = (timer: Timer | null) => setS((p) => ({ ...p, timer }));
    return {
      s,
      ready,
      today,
      patch,
      saveTask: (t) =>
        setS((p) => {
          const cats = p.settings.categories;
          const settings = t.category && !cats.includes(t.category) ? { ...p.settings, categories: [...cats, t.category] } : p.settings;
          return { ...p, settings, tasks: upsert(p.tasks, t) };
        }),
      deleteTask: (id) => T((ts) => ts.filter((t) => t.id !== id)),
      toggleTask: (id) =>
        setS((p) => {
          const t = p.tasks.find((x) => x.id === id);
          if (!t) return p;
          const td = todayKey(p.settings);
          if (t.status === "done") return { ...p, tasks: p.tasks.map((x) => (x.id === id ? { ...x, status: "todo", completedAt: undefined } : x)) };
          const done: Task = { ...t, status: "done", completedAt: Date.now() };
          const tasks = p.tasks.map((x) => (x.id === id ? done : x));
          if (t.recurring !== "none") {
            tasks.push({ ...t, id: uid(), status: "todo", due: nextDue(t.due, t.recurring, td), subtasks: t.subtasks.map((x) => ({ ...x, id: uid(), done: false })), spentMin: 0, postponed: 0, procLog: [], completedAt: undefined, createdAt: Date.now(), topFor: undefined, reminded: false });
          }
          return { ...p, tasks };
        }),
      toggleSubtask: (taskId, subId) =>
        T((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: t.status === "todo" ? "doing" : t.status, subtasks: t.subtasks.map((x) => (x.id === subId ? { ...x, done: !x.done } : x)) } : t))),
      postpone: (id) =>
        setS((p) => {
          const td = todayKey(p.settings);
          return { ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, due: nextDue(t.due && t.due > td ? t.due : td, "daily", td), postponed: t.postponed + 1, topFor: undefined } : t)) };
        }),
      logProcrastination: (id, reason) => T((ts) => ts.map((t) => (t.id === id ? { ...t, procLog: [...t.procLog, { at: Date.now(), reason }] } : t))),
      setTop: (id, date) => T((ts) => ts.map((t) => (t.id === id ? { ...t, topFor: date } : t))),
      saveHabit: (h) => setS((p) => ({ ...p, habits: upsert(p.habits, h) })),
      deleteHabit: (id) => setS((p) => ({ ...p, habits: p.habits.filter((h) => h.id !== id) })),
      toggleHabitDay: (id, day) =>
        setS((p) => ({ ...p, habits: p.habits.map((h) => (h.id === id ? { ...h, log: h.log.includes(day) ? h.log.filter((d) => d !== day) : [...h.log, day] } : h)) })),
      saveGoal: (g) => setS((p) => ({ ...p, goals: upsert(p.goals, g) })),
      deleteGoal: (id) =>
        setS((p) => ({
          ...p,
          goals: p.goals.filter((g) => g.id !== id),
          tasks: p.tasks.map((t) => (t.goalId === id ? { ...t, goalId: undefined } : t)),
          habits: p.habits.map((h) => (h.goalId === id ? { ...h, goalId: undefined } : h)),
        })),
      startTimer: ({ taskId, mode = "study", minutes }) =>
        setS((p) => {
          const ms = minutes ? minutes * 60000 : workMs(p.settings, mode);
          const task = p.tasks.find((t) => t.id === taskId);
          return {
            ...p,
            tasks: task && task.status === "todo" ? p.tasks.map((t) => (t.id === taskId ? { ...t, status: "doing" } : t)) : p.tasks,
            timer: { phase: "work", mode, taskId, totalMs: ms, remainingMs: ms, endsAt: Date.now() + ms },
          };
        }),
      pauseTimer: () =>
        setS((p) => (p.timer?.endsAt ? { ...p, timer: { ...p.timer, remainingMs: Math.max(0, p.timer.endsAt - Date.now()), endsAt: null } } : p)),
      resumeTimer: () => setS((p) => (p.timer && p.timer.endsAt === null ? { ...p, timer: { ...p.timer, endsAt: Date.now() + p.timer.remainingMs } } : p)),
      resetTimer: () => setTimer(null),
      finishTimerEarly: () => setS(finishEarly),
      dismissReview: () => setS((p) => ({ ...p, review: null })),
      dismissReminder: (id) => T((ts) => ts.map((t) => (t.id === id ? { ...t, reminded: true } : t))),
      reviewSession: (id, progress) =>
        setS((p) => ({ ...p, review: null, sessions: p.sessions.map((x) => (x.id === id ? { ...x, progress } : x)) })),
      saveReflection: (r) => setS((p) => ({ ...p, reflections: [...p.reflections.filter((x) => x.week !== r.week), r] })),
      updateSettings: (patchS) => setS((p) => ({ ...p, settings: { ...p.settings, ...patchS } })),
      addCategory: (c) => setS((p) => (p.settings.categories.includes(c) ? p : { ...p, settings: { ...p.settings, categories: [...p.settings.categories, c] } })),
      exportData: () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(live.current, null, 2)], { type: "application/json" }));
        a.download = `grindbox-${dateKey(Date.now())}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      resetAll: () => setS({ ...empty, settings: { ...defaultSettings, theme: live.current.settings.theme } }),
    };
  }, [s, ready, today, patch]);

  return <AppCtx.Provider value={api}>{children}</AppCtx.Provider>;
}

/** Remaining ms of the active timer, recomputed from the wall clock. */
export function useRemaining(t: Timer | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (t?.endsAt == null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [t?.endsAt]);
  if (!t) return 0;
  // Wall-clock read is intentional: remaining time comes from endsAt, not from counting ticks.
  // eslint-disable-next-line react-hooks/purity
  return t.endsAt != null ? Math.max(0, t.endsAt - Date.now()) : t.remainingMs;
}
