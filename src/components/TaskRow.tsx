"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import type { Task } from "@/lib/types";
import { fmtDate, fmtMin, isOverdue } from "@/lib/utils";
import { useDialogs } from "./dialogs";
import { Button, Check, Chip, Confirm, PriorityDot } from "./ui";

export function TaskRow({ task: t, compact }: { task: Task; compact?: boolean }) {
  const { s, today, toggleTask, toggleSubtask, deleteTask, postpone, saveTask } = useApp();
  const { openTask, procrastinate, startSmall, focus } = useDialogs();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(false);
  const done = t.status === "done";
  const subDone = t.subtasks.filter((x) => x.done).length;

  return (
    <li className="border-b border-line py-2 last:border-0">
      <div className="flex items-center gap-2.5">
        <Check checked={done} onChange={() => toggleTask(t.id)} label={`Complete ${t.title}`} />
        <PriorityDot p={t.priority} />
        <button className="min-w-0 flex-1 truncate text-left" onClick={() => (compact ? openTask(t) : setOpen(!open))} aria-expanded={compact ? undefined : open}>
          <span className={done ? "text-muted line-through" : ""}>{t.title}</span>
        </button>
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {t.status === "doing" && <Chip tone="accent">In progress</Chip>}
          {t.status === "archived" && <Chip>Archived</Chip>}
          {t.subtasks.length > 0 && <Chip>{subDone}/{t.subtasks.length}</Chip>}
          {t.estimateMin ? <Chip>{fmtMin(t.estimateMin)}</Chip> : null}
          {t.recurring !== "none" && <Chip>↻ {t.recurring}</Chip>}
          <Chip>{t.category}</Chip>
          {t.due && <Chip tone={isOverdue(t, today) ? "bad" : "muted"}>{fmtDate(t.due, today, s.settings.dateFormat)}</Chip>}
        </div>
        {compact && !done && (
          <Button variant="ghost" onClick={() => focus({ taskId: t.id, mode: "study" })}>Focus</Button>
        )}
      </div>
      <div className="ml-9 mt-1 flex flex-wrap gap-1.5 sm:hidden">
        {t.due && <Chip tone={isOverdue(t, today) ? "bad" : "muted"}>{fmtDate(t.due, today, s.settings.dateFormat)}</Chip>}
        <Chip>{t.category}</Chip>
        {t.subtasks.length > 0 && <Chip>{subDone}/{t.subtasks.length}</Chip>}
        {t.estimateMin ? <Chip>{fmtMin(t.estimateMin)}</Chip> : null}
        {t.status === "doing" && <Chip tone="accent">In progress</Chip>}
      </div>
      {open && !compact && (
        <div className="ml-9 mt-2 space-y-2 text-[13px]">
          {t.notes && <p className="whitespace-pre-wrap text-muted">{t.notes}</p>}
          {t.subtasks.length > 0 && (
            <ul className="space-y-1">
              {t.subtasks.map((x) => (
                <li key={x.id} className="flex items-center gap-2">
                  <Check checked={x.done} onChange={() => toggleSubtask(t.id, x.id)} label={x.title} />
                  <span className={x.done ? "text-muted line-through" : ""}>{x.title}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">
            {fmtMin(t.spentMin)} spent{t.estimateMin ? ` of ${fmtMin(t.estimateMin)} estimated` : ""}
            {t.postponed > 0 && ` · postponed ${t.postponed}×`}
          </p>
          {!done && t.postponed >= 2 && (
            <p className="text-xs text-warn">You&apos;ve postponed this {t.postponed} times. <button className="underline" onClick={() => procrastinate(t.id)}>What&apos;s stopping you?</button></p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {!done && <Button onClick={() => startSmall(t.id)}>Start small</Button>}
            {!done && <Button onClick={() => focus({ taskId: t.id, mode: "study" })}>Focus</Button>}
            {!done && <Button onClick={() => procrastinate(t.id)}>I&apos;m procrastinating</Button>}
            {!done && <Button onClick={() => postpone(t.id)}>Postpone</Button>}
            <Button onClick={() => openTask(t)}>Edit</Button>
            {!done && t.subtasks.length === 0 && <Button onClick={() => openTask(t, true)}>Break down</Button>}
            {done && <Button onClick={() => saveTask({ ...t, status: "archived" })}>Archive</Button>}
            {t.status === "archived" && <Button onClick={() => saveTask({ ...t, status: "done" })}>Unarchive</Button>}
            <Button variant="danger" onClick={() => setDel(true)}>Delete</Button>
          </div>
        </div>
      )}
      {del && <Confirm message={`Delete "${t.title}"? This cannot be undone.`} onNo={() => setDel(false)} onYes={() => { deleteTask(t.id); setDel(false); }} />}
    </li>
  );
}
