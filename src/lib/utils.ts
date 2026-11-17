import type { Goal, Habit, Priority, Session, Settings, Task } from "./types";

// randomUUID needs a secure context; fall back so the app also works over a LAN http address.
export const uid = () =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const dateKey = (d: Date | number, tz?: string) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: tz || undefined });

export const todayKey = (s: Settings) => dateKey(Date.now(), s.timeZone);

export const addDays = (key: string, n: number) => {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

export const dow = (key: string) => new Date(key + "T12:00:00").getDay();

export const weekStartKey = (key: string, ws: 0 | 1) => addDays(key, -((dow(key) - ws + 7) % 7));

export const weekdayLabels = (ws: 0 | 1) => (ws === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]);

export const weekDays = (key: string, ws: 0 | 1) => {
  const start = weekStartKey(key, ws);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export function fmtDate(key: string | undefined, today: string, fmt: Settings["dateFormat"]) {
  if (!key) return "";
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = key.split("-");
  return fmt === "ISO" ? key : fmt === "DMY" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
}

export const weekdayName = (key: string, long = false) =>
  new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: long ? "long" : "short" });

export const fmtMin = (m: number) => {
  m = Math.round(m);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
};

export const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const isOpen = (t: Task) => t.status !== "done" && t.status !== "archived";
export const isOverdue = (t: Task, today: string) => isOpen(t) && !!t.due && t.due < today;
export const doneKey = (t: Task, tz: string) => (t.completedAt ? dateKey(t.completedAt, tz) : undefined);

/** What to work on right now: today's top pick, else highest priority, earliest deadline. */
export function pickNext(tasks: Task[], today: string): Task | undefined {
  const open = tasks.filter(isOpen);
  const top = open.find((t) => t.topFor === today);
  if (top) return top;
  const urgent = open.filter((t) => t.due && t.due <= today);
  const pool = urgent.length ? urgent : open;
  return [...pool].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
      a.createdAt - b.createdAt,
  )[0];
}

export function nextDue(due: string | undefined, rec: Task["recurring"], today: string) {
  let d = due ?? today;
  const step = () => {
    if (rec === "daily") d = addDays(d, 1);
    else if (rec === "weekly") d = addDays(d, 7);
    else {
      const x = new Date(d + "T12:00:00");
      x.setMonth(x.getMonth() + 1);
      d = dateKey(x);
    }
  };
  do step();
  while (d <= today);
  return d;
}

export const isScheduled = (h: Habit, key: string) =>
  h.schedule === "daily" || (h.schedule === "days" && h.days.includes(dow(key)));

/** Streaks are forgiving: unscheduled days never break them, and today stays open until it ends. */
export function habitStats(h: Habit, today: string, ws: 0 | 1) {
  const log = new Set(h.log);
  const created = dateKey(h.createdAt);
  const start = [created, ...h.log].sort()[0];
  let best = 0;
  let current = 0;

  if (h.schedule === "weekly") {
    let run = 0;
    const thisWeek = weekStartKey(today, ws);
    for (let w = weekStartKey(start, ws); w <= thisWeek; w = addDays(w, 7)) {
      const n = Array.from({ length: 7 }, (_, i) => addDays(w, i)).filter((k) => log.has(k)).length;
      if (n >= h.weeklyTarget) run++;
      else if (w !== thisWeek) run = 0;
      best = Math.max(best, run);
    }
    current = run;
  } else {
    let run = 0;
    for (let k = start; k <= today; k = addDays(k, 1)) {
      if (!isScheduled(h, k)) continue;
      if (log.has(k)) run++;
      else if (k !== today) run = 0;
      best = Math.max(best, run);
    }
    current = run;
  }

  const days = weekDays(today, ws);
  const done = days.filter((k) => log.has(k)).length;
  const expected = h.schedule === "weekly" ? h.weeklyTarget : days.filter((k) => isScheduled(h, k)).length;
  const weekPct = expected ? Math.min(100, Math.round((done / expected) * 100)) : 0;

  const lastDone = [...h.log].sort().pop();
  const missed = lastDone ? Math.max(0, daysBetween(lastDone, today)) : daysBetween(created, today);
  return { current, best, weekPct, missed, lastDone };
}

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 864e5);

export function goalProgress(g: Goal, tasks: Task[]) {
  if (g.done) return 100;
  if (g.milestones.length) return Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100);
  const linked = tasks.filter((t) => t.goalId === g.id && t.status !== "archived");
  return linked.length ? Math.round((linked.filter((t) => t.status === "done").length / linked.length) * 100) : g.done ? 100 : 0;
}

export function xpOf(tasks: Task[], sessions: Session[], habits: Habit[]) {
  const w: Record<Priority, number> = { critical: 25, high: 15, medium: 10, low: 5 };
  return (
    tasks.filter((t) => t.status === "done").reduce((a, t) => a + w[t.priority], 0) +
    sessions.length * 5 +
    habits.reduce((a, h) => a + h.log.length * 2, 0)
  );
}

export const levelOf = (xp: number) => {
  let lvl = 1;
  let need = 100;
  let left = xp;
  while (left >= need) {
    left -= need;
    lvl++;
    need += 50;
  }
  return { lvl, into: left, need };
};

/** Tiny first action by keyword; a template, not AI. */
export function smallestStep(title: string) {
  const t = title.toLowerCase();
  const rules: [RegExp, string][] = [
    [/math|calcul|algebra|physics|problem set|homework/, "Solve one problem"],
    [/study|exam|revise|review|learn/, "Read one page or write one question you cannot answer"],
    [/write|essay|paper|proposal|report|thesis|draft/, "Open the document and write one sentence"],
    [/edit|video|footage|render/, "Open the project and organize five clips"],
    [/code|program|build|bug|feature|app/, "Open the project and write the name of the first function"],
    [/email|reply|message|call/, "Write the first line of the message"],
    [/clean|tidy|organi[sz]e|laundry|dishes/, "Put away five items"],
    [/exercise|workout|run|gym/, "Put on your workout clothes"],
    [/read|book/, "Read one paragraph"],
  ];
  return rules.find(([r]) => r.test(t))?.[1] ?? `Open what you need for "${title}" and look at it for two minutes`;
}

export const suggestSteps = (title: string) => [
  `Open what you need for "${title}"`,
  "Write down what done looks like",
  smallestStep(title),
  "Do the main part, rough is fine",
  "Review and fix the obvious problems",
  "Finish and mark it done",
];
