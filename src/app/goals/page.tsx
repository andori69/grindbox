"use client";
import { useState } from "react";
import { Bar, Button, Chip, Confirm, Empty, Field, Input, Modal, PageHeader, Select, Textarea, Check } from "@/components/ui";
import { useApp } from "@/lib/store";
import type { Goal } from "@/lib/types";
import { fmtDate, goalProgress, uid } from "@/lib/utils";

const HORIZON = { long: "Long-term", monthly: "Monthly", weekly: "Weekly" } as const;

function GoalModal({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { saveGoal } = useApp();
  const [g, setG] = useState<Goal>(() => goal ?? { id: uid(), title: "", description: "", horizon: "long", milestones: [], done: false, createdAt: Date.now() });
  const [err, setErr] = useState("");
  const save = () => {
    if (!g.title.trim()) return setErr("Give the goal a title.");
    saveGoal({ ...g, title: g.title.trim(), milestones: g.milestones.filter((m) => m.title.trim()) });
    onClose();
  };
  return (
    <Modal title={goal ? "Edit goal" : "New goal"} onClose={onClose} wide>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Title" error={err}><Input value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea rows={2} value={g.description} onChange={(e) => setG({ ...g, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horizon">
            <Select value={g.horizon} onChange={(e) => setG({ ...g, horizon: e.target.value as Goal["horizon"] })}>
              {Object.entries(HORIZON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Target date"><Input type="date" value={g.target ?? ""} onChange={(e) => setG({ ...g, target: e.target.value || undefined })} /></Field>
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted">Milestones</span>
          <div className="space-y-1.5">
            {g.milestones.map((m, i) => (
              <div key={m.id} className="flex gap-1.5">
                <Input aria-label={`Milestone ${i + 1}`} value={m.title} onChange={(e) => setG({ ...g, milestones: g.milestones.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)) })} />
                <Button variant="ghost" aria-label="Remove milestone" onClick={() => setG({ ...g, milestones: g.milestones.filter((x) => x.id !== m.id) })}>×</Button>
              </div>
            ))}
            <Button onClick={() => setG({ ...g, milestones: [...g.milestones, { id: uid(), title: "", done: false }] })}>+ Add milestone</Button>
          </div>
        </div>
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save goal</Button></div>
      </form>
    </Modal>
  );
}

export default function Goals() {
  const { s, today, saveGoal, deleteGoal } = useApp();
  const [edit, setEdit] = useState<Goal | null | undefined>(undefined);
  const [del, setDel] = useState<Goal | null>(null);

  return (
    <>
      <PageHeader title="Goals" sub="Link tasks and habits to a goal to see daily actions add up." action={<Button variant="primary" onClick={() => setEdit(null)}>+ New goal</Button>} />
      {s.goals.length === 0 && <Empty>No goals yet. Add one, then link tasks and habits to it.</Empty>}
      {(Object.keys(HORIZON) as (keyof typeof HORIZON)[]).map((hz) => {
        const list = s.goals.filter((g) => g.horizon === hz);
        if (!list.length) return null;
        return (
          <section key={hz} className="mb-8">
            <h2 className="mb-2 border-b border-line pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{HORIZON[hz]}</h2>
            {list.map((g) => {
              const pct = goalProgress(g, s.tasks);
              const tasks = s.tasks.filter((t) => t.goalId === g.id && t.status !== "archived");
              const habits = s.habits.filter((h) => h.goalId === g.id);
              return (
                <div key={g.id} className="mb-5 rounded-lg border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{g.title} {g.done && <Chip tone="ok">Complete</Chip>}</p>
                      {g.description && <p className="text-[13px] text-muted">{g.description}</p>}
                      {g.target && <p className="text-xs text-muted">Target {fmtDate(g.target, today, s.settings.dateFormat)}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button onClick={() => saveGoal({ ...g, done: !g.done })}>{g.done ? "Reopen" : "Complete"}</Button>
                      <Button onClick={() => setEdit(g)}>Edit</Button>
                      <Button variant="danger" onClick={() => setDel(g)}>Delete</Button>
                    </div>
                  </div>
                  <div className="my-3 flex items-center gap-3"><Bar pct={pct} label={`Progress on ${g.title}`} tone="ok" /><span className="w-10 text-right text-xs tabular-nums text-muted">{pct}%</span></div>
                  {g.milestones.length > 0 && (
                    <ul className="mb-2 space-y-1">
                      {g.milestones.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 text-[13px]">
                          <Check checked={m.done} label={m.title} onChange={() => saveGoal({ ...g, milestones: g.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })} />
                          <span className={m.done ? "text-muted line-through" : ""}>{m.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(tasks.length > 0 || habits.length > 0) && (
                    <p className="text-xs text-muted">
                      Linked: {tasks.filter((t) => t.status === "done").length}/{tasks.length} tasks done
                      {habits.length > 0 && ` · ${habits.length} habit${habits.length > 1 ? "s" : ""} (${habits.map((h) => h.title).join(", ")})`}
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      {edit !== undefined && <GoalModal key={edit?.id ?? "new"} goal={edit} onClose={() => setEdit(undefined)} />}
      {del && <Confirm message={`Delete "${del.title}"? Linked tasks and habits are kept.`} onNo={() => setDel(null)} onYes={() => { deleteGoal(del.id); setDel(null); }} />}
    </>
  );
}
