"use client";
import { useState } from "react";
import { Bar, Button, Empty, PageHeader, Section, Select, Textarea } from "@/components/ui";
import { useApp } from "@/lib/store";
import { addDays, dateKey, doneKey, fmtMin, goalProgress, habitStats, isOverdue, levelOf, weekStartKey, weekdayName, xpOf } from "@/lib/utils";

const QUESTIONS = ["What did I accomplish?", "What did I postpone?", "What distracted me?", "What worked well?", "What should I improve next week?"];

function Bars({ data, unit }: { data: { k: string; v: number }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  if (!data.some((d) => d.v)) return <Empty>No {unit} recorded in this period yet.</Empty>;
  return (
    <div className="flex h-28 items-end gap-1" role="img" aria-label={`Bar chart of ${unit} per day`}>
      {data.map((d) => (
        <div key={d.k} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.k}: ${d.v} ${unit}`}>
          <div className="w-full rounded-sm bg-accent/70" style={{ height: `${Math.max(d.v ? 4 : 1, (d.v / max) * 80)}px` }} />
          <span className="text-[10px] text-muted">{data.length <= 8 ? weekdayName(d.k) : d.k.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const { s, today, saveReflection } = useApp();
  const [range, setRange] = useState<7 | 30>(7);
  const tz = s.settings.timeZone;
  const from = addDays(today, -(range - 1));
  const days = Array.from({ length: range }, (_, i) => addDays(from, i));
  const inRange = (k?: string) => !!k && k >= from && k <= today;

  const tasks = s.tasks.filter((t) => t.status !== "archived");
  const doneIn = tasks.filter((t) => inRange(doneKey(t, tz)));
  const scope = tasks.filter((t) => inRange(doneKey(t, tz)) || inRange(t.due));
  const rate = scope.length ? Math.round((doneIn.length / scope.length) * 100) : 0;
  const sessions = s.sessions.filter((x) => inRange(dateKey(x.finishedAt, tz)));
  const focusMin = sessions.reduce((a, x) => a + x.minutes, 0);
  const allFocus = s.sessions.reduce((a, x) => a + x.minutes, 0);
  const active = s.habits.filter((h) => !h.paused);
  const consistency = active.length ? Math.round(active.reduce((a, h) => a + habitStats(h, today, s.settings.weekStart).weekPct, 0) / active.length) : 0;
  const byDow = Array.from({ length: 7 }, (_, d) => s.tasks.filter((t) => t.completedAt && new Date(doneKey(t, tz)! + "T12:00:00").getDay() === d).length);
  const bestDow = Math.max(...byDow);
  const postponed = s.tasks.filter((t) => t.postponed > 0 || t.procLog.length > 0).sort((a, b) => b.postponed + b.procLog.length - (a.postponed + a.procLog.length)).slice(0, 5);

  const week = weekStartKey(today, s.settings.weekStart);
  const existing = s.reflections.find((r) => r.week === week);
  const [answers, setAnswers] = useState<string[]>(existing?.answers ?? QUESTIONS.map(() => ""));
  const [saved, setSaved] = useState(false);

  const xp = xpOf(s.tasks, s.sessions, s.habits);
  const { lvl, into, need } = levelOf(xp);
  const doneCount = s.tasks.filter((t) => t.status === "done").length;
  const bestStreak = Math.max(0, ...s.habits.map((h) => habitStats(h, today, s.settings.weekStart).best));
  const achievements: [string, boolean][] = [
    ["First task completed", doneCount >= 1],
    ["10 tasks completed", doneCount >= 10],
    ["50 tasks completed", doneCount >= 50],
    ["First focus session", s.sessions.length >= 1],
    ["10 focus sessions", s.sessions.length >= 10],
    ["10 hours of focus", allFocus >= 600],
    ["Habit streak of 7", bestStreak >= 7],
    ["Habit streak of 30", bestStreak >= 30],
    ["A goal reached 100%", s.goals.some((g) => goalProgress(g, s.tasks) === 100)],
  ];

  const empty = s.tasks.length === 0 && s.sessions.length === 0 && s.habits.length === 0;

  return (
    <>
      <PageHeader title="Insights" sub="For self-awareness, not judgment." action={<Select aria-label="Range" className="w-36!" value={range} onChange={(e) => setRange(Number(e.target.value) as 7 | 30)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></Select>} />
      {empty && <Empty>Nothing to show yet. Complete a task, a focus session or a habit and your numbers appear here.</Empty>}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Tasks completed", doneIn.length],
          ["Completion rate", `${rate}%`],
          ["Focus time", fmtMin(focusMin)],
          ["Avg session", sessions.length ? fmtMin(focusMin / sessions.length) : "–"],
          ["Overdue now", s.tasks.filter((t) => isOverdue(t, today)).length],
          ["Postponements", s.tasks.reduce((a, t) => a + t.postponed, 0)],
                    ["Habit consistency", active.length ? `${consistency}%` : "–"],
          ["Total focus", `${(allFocus / 60).toFixed(1)}h`],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-muted">{k}</p>
            <p className="text-lg font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <Section title="Tasks completed per day"><Bars unit="tasks" data={days.map((k) => ({ k, v: tasks.filter((t) => doneKey(t, tz) === k).length }))} /></Section>
      <Section title="Focus minutes per day"><Bars unit="minutes" data={days.map((k) => ({ k, v: s.sessions.filter((x) => dateKey(x.finishedAt, tz) === k).reduce((a, x) => a + x.minutes, 0) }))} /></Section>

      <Section title="Most productive weekdays">
        {bestDow ? (
          <ul className="space-y-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <li key={d} className="flex items-center gap-3 text-[13px]">
                <span className="w-9 text-muted">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]}</span>
                <div className="flex-1"><Bar pct={(byDow[d] / bestDow) * 100} label={`Tasks completed on ${["Sundays","Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays"][d]}`} /></div>
                <span className="w-6 text-right tabular-nums text-muted">{byDow[d]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Complete a few tasks to see which days you finish the most.</Empty>
        )}
      </Section>

      <Section title="Often postponed">
        {postponed.length ? (
          <ul>
            {postponed.map((t) => (
              <li key={t.id} className="flex justify-between border-b border-line py-1.5 text-[13px] last:border-0">
                <span className="truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-muted">postponed {t.postponed}× · stuck {t.procLog.length}×</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nothing has been postponed.</Empty>
        )}
      </Section>

      <Section title={`Weekly reflection · week of ${week}`}>
        <div className="space-y-3">
          {QUESTIONS.map((q, i) => (
            <label key={q} className="block">
              <span className="mb-1 block text-[13px]">{q}</span>
              <Textarea rows={2} value={answers[i] ?? ""} onChange={(e) => { setSaved(false); setAnswers(answers.map((a, j) => (j === i ? e.target.value : a))); }} />
            </label>
          ))}
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={() => { saveReflection({ week, answers }); setSaved(true); }}>Save reflection</Button>
            {saved && <span className="text-xs text-ok">Saved.</span>}
          </div>
        </div>
        {s.reflections.filter((r) => r.week !== week).length > 0 && (
          <details className="mt-4 text-[13px]">
            <summary className="cursor-pointer text-muted">Past reflections</summary>
            {[...s.reflections].filter((r) => r.week !== week).sort((a, b) => b.week.localeCompare(a.week)).map((r) => (
              <div key={r.week} className="mt-3 border-t border-line pt-2">
                <p className="text-xs text-muted">Week of {r.week}</p>
                {QUESTIONS.map((q, i) => r.answers[i] && <p key={q}><span className="text-muted">{q}</span> {r.answers[i]}</p>)}
              </div>
            ))}
          </details>
        )}
      </Section>

      {s.settings.gamification && (
        <Section title="Milestones">
          <p className="mb-2 text-[13px]">Level {lvl} · {xp} XP total · {need - into} to next level</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {achievements.map(([label, got]) => (
              <li key={label} className={`text-[13px] ${got ? "" : "text-muted"}`}>{got ? "✓" : "○"} {label}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">XP is private and optional. Turn it off in Settings.</p>
        </Section>
      )}
    </>
  );
}
