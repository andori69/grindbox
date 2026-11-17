"use client";
import { useState } from "react";
import { useDialogs } from "@/components/dialogs";
import { Bar, Button, Chip, Empty, Input, PageHeader, PriorityDot, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import type { Task } from "@/lib/types";
import { PRIORITY_RANK, addDays, fmtDate, fmtMin, isOpen, isOverdue } from "@/lib/utils";

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const DEFAULT_EST = 30;
const est = (t: Task) => t.estimateMin ?? DEFAULT_EST;

export default function Planner() {
  const { s, today, saveTask, setTop } = useApp();
  const { openTask } = useDialogs();
  const [day, setDay] = useState(today);

  const open = s.tasks.filter(isOpen);
  const forDay = open.filter((t) => t.due === day || t.topFor === day);
  const scheduled = forDay.filter((t) => t.time).sort((a, b) => a.time!.localeCompare(b.time!));
  const unscheduled = forDay.filter((t) => !t.time);
  const tops = open.filter((t) => t.topFor === day);
  const frog = tops[0] ?? [...forDay].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || est(b) - est(a))[0];
  const candidates = open.filter((t) => t.topFor !== day).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]).slice(0, 30);
  const overdue = open.filter((t) => isOverdue(t, today) && t.due !== day);

  const load = forDay.reduce((a, t) => a + est(t), 0);
  const cap = s.settings.availableHours * 60;
  const pct = cap ? Math.round((load / cap) * 100) : 0;
  const conflicts = new Set<string>();
  scheduled.forEach((a, i) =>
    scheduled.slice(i + 1).forEach((b) => {
      if (toMin(b.time!) < toMin(a.time!) + est(a)) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }),
  );
  const outside = (t: Task) => toMin(t.time!) < toMin(s.settings.hoursStart) || toMin(t.time!) + est(t) > toMin(s.settings.hoursEnd);
  const guessed = forDay.some((t) => t.estimateMin === undefined);

  return (
    <>
      <PageHeader
        title="Planner"
        sub={fmtDate(day, today, s.settings.dateFormat) + " · " + new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}
        action={
          <div className="flex gap-1.5">
            <Button aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>←</Button>
            <Button onClick={() => setDay(today)} disabled={day === today}>Today</Button>
            <Button aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>→</Button>
          </div>
        }
      />

      <Section title="Workload">
        <div className="mb-1 flex justify-between text-[13px]">
          <span>{fmtMin(load)} planned of {fmtMin(cap)} available</span>
          <span className={pct > 100 ? "text-bad" : pct > 80 ? "text-warn" : "text-muted"}>{pct}%</span>
        </div>
        <Bar pct={pct} label="Planned workload versus available time" tone={pct > 100 ? "bad" : "ok"} />
        {pct > 100 && <p className="mt-2 text-[13px] text-bad">That is {fmtMin(load - cap)} more than you have. Move something to another day.</p>}
        {pct > 80 && pct <= 100 && <p className="mt-2 text-[13px] text-warn">Nearly full. Leave room for the unexpected.</p>}
        {guessed && <p className="mt-2 text-xs text-muted">Tasks without an estimate count as {DEFAULT_EST} minutes.</p>}
      </Section>

      <Section title="Eat the frog">
        {frog ? (
          <p className="text-[13px]">Do <b>{frog.title}</b> first. The hardest task is easiest before the day fills up.</p>
        ) : (
          <Empty>Nothing planned yet. Choose your top three below.</Empty>
        )}
      </Section>

      <Section title={`Top 3 priorities (${tops.length}/3)`}>
        <ul>
          {tops.map((t) => (
            <li key={t.id} className="flex items-center gap-2 border-b border-line py-1.5 last:border-0">
              <PriorityDot p={t.priority} />
              <span className="flex-1 truncate">{t.title}</span>
              <Button variant="ghost" onClick={() => setTop(t.id, undefined)}>Remove</Button>
            </li>
          ))}
        </ul>
        {tops.length < 3 && (
          <select
            aria-label="Add a top priority"
            className="mt-2 h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px]"
            value=""
            onChange={(e) => e.target.value && setTop(e.target.value, day)}
          >
            <option value="">+ Add a top priority…</option>
            {candidates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        )}
      </Section>

      <Section title="Schedule">
        {scheduled.length ? (
          <ul>
            {scheduled.map((t) => (
              <li key={t.id} className="flex items-center gap-2 border-b border-line py-1.5 last:border-0">
                <Input type="time" aria-label={`Time for ${t.title}`} className="w-32!" value={t.time} onChange={(e) => saveTask({ ...t, time: e.target.value || undefined })} />
                <PriorityDot p={t.priority} />
                <button className="flex-1 truncate text-left" onClick={() => openTask(t)}>{t.title}</button>
                <span className="text-xs text-muted">{fmtMin(est(t))}</span>
                {conflicts.has(t.id) && <Chip tone="bad">Overlaps</Chip>}
                {outside(t) && <Chip tone="warn">Outside {s.settings.hoursStart}–{s.settings.hoursEnd}</Chip>}
                <Button variant="ghost" aria-label="Unschedule" onClick={() => saveTask({ ...t, time: undefined })}>×</Button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No timed tasks. Give a task a time below.</Empty>
        )}
      </Section>

      <Section title="Unscheduled">
        {unscheduled.length ? (
          <ul>
            {unscheduled.map((t) => (
              <li key={t.id} className="flex items-center gap-2 border-b border-line py-1.5 last:border-0">
                <PriorityDot p={t.priority} />
                <button className="flex-1 truncate text-left" onClick={() => openTask(t)}>{t.title}</button>
                <span className="text-xs text-muted">{fmtMin(est(t))}</span>
                <Input type="time" aria-label={`Set time for ${t.title}`} className="w-32!" value="" onChange={(e) => e.target.value && saveTask({ ...t, time: e.target.value, due: t.due ?? day })} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Everything for this day has a time.</Empty>
        )}
      </Section>

      {overdue.length > 0 && (
        <Section title="Review unfinished">
          <ul>
            {overdue.map((t) => (
              <li key={t.id} className="flex items-center gap-2 border-b border-line py-1.5 last:border-0">
                <PriorityDot p={t.priority} />
                <span className="flex-1 truncate">{t.title}</span>
                <span className="text-xs text-bad">{fmtDate(t.due, today, s.settings.dateFormat)}</span>
                <Button onClick={() => saveTask({ ...t, due: day })}>Move here</Button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
