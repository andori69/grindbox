"use client";
import { useState } from "react";
import { useApp, newTask } from "@/lib/store";
import type { Priority, Recurrence, Status, Task } from "@/lib/types";
import { suggestSteps, uid } from "@/lib/utils";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";

export function TaskModal({ task, suggest, onClose }: { task: Task | null; suggest?: boolean; onClose: () => void }) {
  const { s, saveTask, today } = useApp();
  const [t, setT] = useState<Task>(() => {
    const base = task ?? newTask({ title: "", category: s.settings.categories[0] ?? "Personal" });
    return suggest && base.title && !base.subtasks.length
      ? { ...base, subtasks: suggestSteps(base.title).map((title) => ({ id: uid(), title, done: false })) }
      : base;
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setT((p) => ({ ...p, [k]: v }));

  const save = () => {
    const e: Record<string, string> = {};
    if (!t.title.trim()) e.title = "Give the task a name.";
    if (t.estimateMin !== undefined && (!Number.isFinite(t.estimateMin) || t.estimateMin < 0)) e.estimate = "Use a positive number.";
    if (t.spentMin < 0 || !Number.isFinite(t.spentMin)) e.spent = "Use a positive number.";
    setErr(e);
    if (Object.keys(e).length) return;
    const done = t.status === "done";
    saveTask({
      ...t,
      title: t.title.trim(),
      category: t.category.trim() || "Other",
      subtasks: t.subtasks.filter((x) => x.title.trim()),
      completedAt: done ? t.completedAt ?? Date.now() : undefined,
      reminded: task && task.remind === t.remind ? t.reminded : false,
    });
    onClose();
  };

  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Title" error={err.title} className="sm:col-span-2">
          <Input value={t.title} onChange={(e) => set("title", e.target.value)} placeholder="What needs to get done?" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={t.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Field label="Priority">
          <Select value={t.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
            {["critical", "high", "medium", "low"].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={t.status} onChange={(e) => set("status", e.target.value as Status)}>
            <option value="todo">Not started</option>
            <option value="doing">In progress</option>
            <option value="done">Completed</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
        <Field label="Category">
          <Input list="cats" value={t.category} onChange={(e) => set("category", e.target.value)} />
          <datalist id="cats">{s.settings.categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Goal">
          <Select value={t.goalId ?? ""} onChange={(e) => set("goalId", e.target.value || undefined)}>
            <option value="">None</option>
            {s.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </Select>
        </Field>
        <Field label="Deadline">
          <Input type="date" value={t.due ?? ""} onChange={(e) => set("due", e.target.value || undefined)} />
        </Field>
        <Field label="Scheduled time (planner)">
          <Input type="time" value={t.time ?? ""} onChange={(e) => set("time", e.target.value || undefined)} />
        </Field>
        <Field label="Estimate (minutes)" error={err.estimate}>
          <Input type="number" min={0} value={t.estimateMin ?? ""} onChange={(e) => set("estimateMin", e.target.value === "" ? undefined : Number(e.target.value))} />
        </Field>
        <Field label="Time spent (minutes)" error={err.spent}>
          <Input type="number" min={0} value={t.spentMin} onChange={(e) => set("spentMin", Number(e.target.value))} />
        </Field>
        <Field label="Repeats">
          <Select value={t.recurring} onChange={(e) => set("recurring", e.target.value as Recurrence)}>
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </Field>
        <Field label="Reminder">
          <Input type="datetime-local" value={t.remind ?? ""} min={today + "T00:00"} onChange={(e) => set("remind", e.target.value || undefined)} />
        </Field>

        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-muted">Subtasks</span>
            <Button
              variant="ghost"
              disabled={!t.title.trim()}
              title="Template steps, not AI. Edit or remove any before saving."
              onClick={() => set("subtasks", [...t.subtasks, ...suggestSteps(t.title.trim()).map((title) => ({ id: uid(), title, done: false }))])}
            >
              Suggest steps
            </Button>
          </div>
          <div className="space-y-1.5">
            {t.subtasks.map((x, i) => (
              <div key={x.id} className="flex gap-1.5">
                <Input value={x.title} aria-label={`Subtask ${i + 1}`} onChange={(e) => set("subtasks", t.subtasks.map((y) => (y.id === x.id ? { ...y, title: e.target.value } : y)))} />
                <Button variant="ghost" aria-label="Remove subtask" onClick={() => set("subtasks", t.subtasks.filter((y) => y.id !== x.id))}>×</Button>
              </div>
            ))}
            <Button onClick={() => set("subtasks", [...t.subtasks, { id: uid(), title: "", done: false }])}>+ Add subtask</Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">Save task</Button>
        </div>
      </form>
    </Modal>
  );
}
