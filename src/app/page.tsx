"use client";
import Link from "next/link";
import { useState } from "react";
import { TaskRow } from "@/components/TaskRow";
import { useDialogs } from "@/components/dialogs";
import { mmss } from "@/components/Shell";
import { Bar, Button, Check, Empty, Input, Section } from "@/components/ui";
import { newTask, useApp, useRemaining } from "@/lib/store";
import { addDays, dateKey, doneKey, fmtDate, fmtMin, goalProgress, isOpen, isOverdue, isScheduled, levelOf, pickNext, weekDays, weekdayName, xpOf } from "@/lib/utils";

export default function Dashboard() {
  const { s, today, saveTask, toggleHabitDay } = useApp();
  const { procrastinate, startSmall, focus } = useDialogs();
  const [title, setTitle] = useState("");
  const [forToday, setForToday] = useState(true);
  const [added, setAdded] = useState("");
  const tz = s.settings.timeZone;
  const left = useRemaining(s.timer);

  const open = s.tasks.filter(isOpen);
  const dueToday = open.filter((t) => t.due === today);
  const overdue = open.filter((t) => isOverdue(t, today));
  const doneToday = s.tasks.filter((t) => doneKey(t, tz) === today);
  const total = dueToday.length + overdue.length + doneToday.length;
  const pct = total ? Math.round((doneToday.length / total) * 100) : 0;
  const next = pickNext(s.tasks, today);
  const habitsToday = s.habits.filter((h) => !h.paused && isScheduled(h, today));
  const habitsDone = habitsToday.filter((h) => h.log.includes(today)).length;
  const upcoming = open.filter((t) => t.due && t.due > today && t.due <= addDays(today, 7)).sort((a, b) => a.due!.localeCompare(b.due!));
  const sessionsToday = s.sessions.filter((x) => dateKey(x.finishedAt, tz) === today);
  const focusToday = sessionsToday.reduce((a, x) => a + x.minutes, 0);
  const week = weekDays(today, s.settings.weekStart).map((k) => ({ k, n: s.tasks.filter((t) => doneKey(t, tz) === k).length }));
  const max = Math.max(1, ...week.map((w) => w.n));
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz || undefined })) % 24;
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const { lvl, into, need } = levelOf(xpOf(s.tasks, s.sessions, s.habits));
  const plannedMin = open.filter((t) => t.due === today || t.topFor === today).reduce((a, t) => a + (t.estimateMin ?? 30), 0);
  const topCount = open.filter((t) => t.topFor === today).length;
  const activeGoals = s.goals.filter((g) => !g.done);
  const weekDone = week.reduce((a, w) => a + w.n, 0);

  const add = () => {
    const v = title.trim();
    if (!v) return;
    saveTask(newTask({ title: v, due: forToday ? today : undefined, category: s.settings.categories[0] }));
    setTitle("");
    setAdded(`Added “${v}” to ${forToday ? "Today" : "Inbox"}.`);
  };

  const tiles: [string, string, string, string][] = [
    ["/tasks", "Tasks", `${open.length} open`, overdue.length ? `${overdue.length} overdue` : "none overdue"],
    ["/planner", "Planner", `${fmtMin(plannedMin)} planned today`, `Top 3: ${topCount}/3`],
    ["/focus", "Focus", s.timer ? (s.timer.phase === "work" ? "Session running" : "On a break") : `${sessionsToday.length} session${sessionsToday.length === 1 ? "" : "s"} today`, fmtMin(focusToday) + " focused"],
    ["/habits", "Habits", habitsToday.length ? `${habitsDone}/${habitsToday.length} done today` : "None scheduled today", `${s.habits.length} tracked`],
    ["/goals", "Goals", `${activeGoals.length} active`, activeGoals[0] ? `${activeGoals[0].title}: ${goalProgress(activeGoals[0], s.tasks)}%` : "Set a direction"],
    ["/insights", "Insights", `${weekDone} done this week`, "Weekly reflection"],
  ];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{greet}{s.settings.name ? `, ${s.settings.name}` : ""}</h1>
        <p className="text-[13px] text-muted">{new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      </div>

      <section className="mb-6 rounded-lg border border-line bg-surface p-4" aria-label="What to work on right now">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">What to work on right now</p>
        {next ? (
          <>
            <p className="text-lg font-medium">{next.title}</p>
            <p className="mb-3 text-[13px] text-muted">
              {next.topFor === today ? "Your top priority today" : isOverdue(next, today) ? "Overdue" : next.due ? `Due ${fmtDate(next.due, today, s.settings.dateFormat).toLowerCase()}` : "No deadline"}
              {next.subtasks.find((x) => !x.done) && ` · Next step: ${next.subtasks.find((x) => !x.done)!.title}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {s.timer ? (
                <Link href="/focus" className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-bg hover:opacity-90 md:h-8">
                  {s.timer.phase === "work" ? "Continue focus session" : "On a break"} · {mmss(left)}
                </Link>
              ) : (
                <Button variant="primary" onClick={() => focus({ taskId: next.id, mode: "study" })}>Start focus</Button>
              )}
              <Button onClick={() => startSmall(next.id)}>Start small</Button>
              <Button onClick={() => procrastinate(next.id)}>I&apos;m procrastinating</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-muted">Nothing open. Add a task below, or enjoy the quiet.</p>
            {s.timer && (
              <Link href="/focus" className="mt-3 inline-flex h-9 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-bg hover:opacity-90 md:h-8">
                {s.timer.phase === "work" ? "Continue focus session" : "On a break"} · {mmss(left)}
              </Link>
            )}
          </>
        )}
      </section>

      <form className="mb-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={title} onChange={(e) => { setTitle(e.target.value); setAdded(""); }} placeholder="Quick add a task and press Enter" aria-label="Quick add task" />
        <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted">
          <input type="checkbox" checked={forToday} onChange={(e) => setForToday(e.target.checked)} /> Today
        </label>
        <Button type="submit" variant="primary">Add</Button>
      </form>
      <p className="mb-6 min-h-5 text-xs text-ok" role="status">{added}</p>

      <Section title="Workspace">
        <div className="grid gap-x-6 sm:grid-cols-2">
          {tiles.map(([href, name, a, b]) => (
            <Link key={href} href={href} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 hover:bg-hover">
              <span className="font-medium">{name}</span>
              <span className="min-w-0 truncate text-right text-xs text-muted">{a} · {b}</span>
            </Link>
          ))}
        </div>
      </Section>

      <div className="mb-8">
        <div className="mb-1.5 flex justify-between text-[13px]">
          <span>{doneToday.length} done · {dueToday.length + overdue.length} left today</span>
          <span className="text-muted">{pct}%</span>
        </div>
        <Bar pct={pct} label="Today's task progress" tone="ok" />
      </div>

      {overdue.length > 0 && (
        <Section title={`Overdue (${overdue.length})`}>
          <ul>{overdue.map((t) => <TaskRow key={t.id} task={t} compact />)}</ul>
        </Section>
      )}

      <Section title="Due today" action={<Link href="/tasks" className="text-xs text-muted hover:text-ink">All tasks</Link>}>
        {dueToday.length || doneToday.length ? (
          <ul>
            {dueToday.map((t) => <TaskRow key={t.id} task={t} compact />)}
            {doneToday.map((t) => <TaskRow key={t.id} task={t} compact />)}
          </ul>
        ) : (
          <Empty>Nothing due today.</Empty>
        )}
      </Section>

      {s.habits.length > 0 && <Section title="Habits today" action={<Link href="/habits" className="text-xs text-muted hover:text-ink">Manage</Link>}>
        {habitsToday.length ? (
          <ul>
            {habitsToday.map((h) => (
              <li key={h.id} className="flex items-center gap-2.5 border-b border-line py-2 last:border-0">
                <Check checked={h.log.includes(today)} onChange={() => toggleHabitDay(h.id, today)} label={h.title} />
                {h.title}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No habits scheduled today.</Empty>
        )}
      </Section>}

      {upcoming.length > 0 && (
        <Section title="Upcoming deadlines (7 days)">
          <ul>{upcoming.map((t) => <TaskRow key={t.id} task={t} compact />)}</ul>
        </Section>
      )}

      <Section title="This week">
        {weekDone === 0 ? <Empty>Nothing completed yet this week.</Empty> : <>
        <div className="flex h-24 items-end gap-2">
          {week.map((w) => (
            <div key={w.k} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] tabular-nums text-muted">{w.n || ""}</span>
              <div className={`w-full rounded-sm ${w.k === today ? "bg-accent" : "bg-line"}`} style={{ height: `${Math.max(4, (w.n / max) * 56)}px` }} />
              <span className="text-[11px] text-muted">{weekdayName(w.k)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Tasks completed per day.</p>
        </>}
      </Section>

      {s.settings.gamification && <p className="text-xs text-muted">Level {lvl} · {into}/{need} XP to next</p>}
    </>
  );
}
