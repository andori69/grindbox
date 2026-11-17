"use client";
import { useState } from "react";
import { Bar, Button, Check, Confirm, Empty, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { useApp } from "@/lib/store";
import type { Habit } from "@/lib/types";
import { addDays, dow, habitStats, isScheduled, uid, weekdayLabels } from "@/lib/utils";

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const dayName = (d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d];

function HabitModal({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const { s, saveHabit } = useApp();
  const [h, setH] = useState<Habit>(() => habit ?? { id: uid(), title: "", schedule: "daily", days: [1, 2, 3, 4, 5], weeklyTarget: 3, paused: false, log: [], createdAt: Date.now() });
  const [err, setErr] = useState("");
  const save = () => {
    if (!h.title.trim()) return setErr("Give the habit a name.");
    if (h.schedule === "days" && !h.days.length) return setErr("Pick at least one day.");
    saveHabit({ ...h, title: h.title.trim() });
    onClose();
  };
  return (
    <Modal title={habit ? "Edit habit" : "New habit"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Habit" error={err}><Input value={h.title} onChange={(e) => setH({ ...h, title: e.target.value })} placeholder="e.g. Read for 20 minutes" /></Field>
        <Field label="Schedule">
          <Select value={h.schedule} onChange={(e) => setH({ ...h, schedule: e.target.value as Habit["schedule"] })}>
            <option value="daily">Every day</option>
            <option value="days">Selected days</option>
            <option value="weekly">Times per week</option>
          </Select>
        </Field>
        {h.schedule === "days" && (
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button key={d} type="button" aria-pressed={h.days.includes(d)} onClick={() => setH({ ...h, days: h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d] })} className={`rounded-md border px-2.5 py-1 text-[13px] ${h.days.includes(d) ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>{dayName(d)}</button>
            ))}
          </div>
        )}
        {h.schedule === "weekly" && (
          <Field label="Goal: times per week"><Input type="number" min={1} max={7} value={h.weeklyTarget} onChange={(e) => setH({ ...h, weeklyTarget: Math.min(7, Math.max(1, Number(e.target.value) || 1)) })} /></Field>
        )}
        <Field label="Linked goal">
          <Select value={h.goalId ?? ""} onChange={(e) => setH({ ...h, goalId: e.target.value || undefined })}>
            <option value="">None</option>
            {s.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save habit</Button></div>
      </form>
    </Modal>
  );
}

function Month({ h, month, today, ws, onToggle }: { h: Habit; month: string; today: string; ws: 0 | 1; onToggle: (d: string) => void }) {
  const first = month + "-01";
  const lead = (dow(first) - ws + 7) % 7;
  const n = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(first, i))];
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {weekdayLabels(ws).map((d) => <span key={d} className="text-muted">{dayName(d)[0]}</span>)}
      {cells.map((k, i) =>
        k ? (
          <button
            key={k}
            disabled={k > today}
            aria-label={`${Number(k.slice(8))}, ${k}, ${h.log.includes(k) ? "done" : "not done"}`}
            aria-pressed={h.log.includes(k)}
            onClick={() => onToggle(k)}
            className={`h-7 rounded ${h.log.includes(k) ? "bg-ok text-bg" : isScheduled(h, k) ? "bg-hover" : "border border-line text-muted"} ${k === today ? "ring-1 ring-accent" : ""} disabled:opacity-30`}
          >
            {Number(k.slice(8))}
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  );
}

export default function Habits() {
  const { s, today, toggleHabitDay, saveHabit, deleteHabit } = useApp();
  const [edit, setEdit] = useState<Habit | null | undefined>(undefined);
  const [del, setDel] = useState<Habit | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const shift = (n: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <>
      <PageHeader title="Habits" sub="Missing a day is fine. Pick it back up." action={<Button variant="primary" onClick={() => setEdit(null)}>+ New habit</Button>} />
      {s.habits.length === 0 && <Empty>No habits yet. Add one small thing you want to do regularly.</Empty>}
      <ul>
        {s.habits.map((h) => {
          const st = habitStats(h, today, s.settings.weekStart);
          const open = sel === h.id;
          const goal = s.goals.find((g) => g.id === h.goalId);
          return (
            <li key={h.id} className="border-b border-line py-3 last:border-0">
              <div className="flex items-center gap-3">
                <Check checked={h.log.includes(today)} onChange={() => toggleHabitDay(h.id, today)} label={`Mark ${h.title} done today`} />
                <button className="min-w-0 flex-1 text-left" onClick={() => setSel(open ? null : h.id)} aria-expanded={open}>
                  <span className={h.paused ? "text-muted" : ""}>{h.title}</span>
                  {h.paused && <span className="ml-2 text-xs text-muted">paused</span>}
                  <span className="block text-xs text-muted">
                    {h.schedule === "daily" ? "Every day" : h.schedule === "days" ? h.days.map(dayName).join(", ") : `${h.weeklyTarget}× per week`}
                    {goal && ` · ${goal.title}`}
                  </span>
                </button>
                <div className="hidden w-40 shrink-0 sm:block">
                  <div className="mb-1 flex justify-between text-xs text-muted"><span>This week</span><span>{st.weekPct}%</span></div>
                  <Bar pct={st.weekPct} label={`${h.title}: this week`} tone="ok" />
                </div>
                <div className="w-20 shrink-0 text-right text-xs text-muted">
                  <div>Streak {st.current}</div>
                  <div>Best {st.best}</div>
                </div>
              </div>
              {!h.paused && st.missed >= 2 && !h.log.includes(today) && (
                <p className="ml-7 mt-1 text-xs text-muted">{st.lastDone ? `Last done ${st.missed} days ago.` : "Not started yet."} Today is a good day to resume.</p>
              )}
              {open && (
                <div className="ml-7 mt-3 max-w-sm space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <Button variant="ghost" aria-label="Previous month" onClick={() => shift(-1)}>←</Button>
                    <span>{new Date(month + "-01T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                    <Button variant="ghost" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => shift(1)}>→</Button>
                  </div>
                  <Month h={h} month={month} today={today} ws={s.settings.weekStart} onToggle={(d) => toggleHabitDay(h.id, d)} />
                  <p className="text-xs text-muted">{h.log.length} completions in total · tap a day to correct it.</p>
                  <div className="flex gap-1.5">
                    <Button onClick={() => setEdit(h)}>Edit</Button>
                    <Button onClick={() => saveHabit({ ...h, paused: !h.paused })}>{h.paused ? "Resume" : "Pause"}</Button>
                    <Button variant="danger" onClick={() => setDel(h)}>Delete</Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {edit !== undefined && <HabitModal key={edit?.id ?? "new"} habit={edit} onClose={() => setEdit(undefined)} />}
      {del && <Confirm message={`Delete "${del.title}" and its history?`} onNo={() => setDel(null)} onYes={() => { deleteHabit(del.id); setDel(null); }} />}
    </>
  );
}
