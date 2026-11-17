"use client";
import { useMemo, useState } from "react";
import { TaskRow } from "@/components/TaskRow";
import { Empty, Input, PageHeader, Select } from "@/components/ui";
import { useApp } from "@/lib/store";
import type { Priority, Task } from "@/lib/types";
import { PRIORITY_RANK, isOpen, isOverdue } from "@/lib/utils";

const VIEWS = ["Inbox", "Today", "Upcoming", "Overdue", "Completed", "All tasks"] as const;
type View = (typeof VIEWS)[number];

export default function Tasks() {
  const { s, today } = useApp();
  const [view, setView] = useState<View>("Today");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [pri, setPri] = useState<"" | Priority>("");
  const [sort, setSort] = useState<"priority" | "deadline" | "created" | "category">("priority");

  const match: Record<View, (t: Task) => boolean> = {
    Inbox: (t) => isOpen(t) && !t.due,
    Today: (t) => isOpen(t) && t.due === today,
    Upcoming: (t) => isOpen(t) && !!t.due && t.due > today,
    Overdue: (t) => isOverdue(t, today),
    Completed: (t) => t.status === "done",
    "All tasks": () => true,
  };
  const counts = Object.fromEntries(VIEWS.map((v) => [v, s.tasks.filter(match[v]).length]));

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cmp: Record<typeof sort, (a: Task, b: Task) => number> = {
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due ?? "9999").localeCompare(b.due ?? "9999"),
      deadline: (a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      created: (a, b) => b.createdAt - a.createdAt,
      category: (a, b) => a.category.localeCompare(b.category) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    };
    const order = view === "Completed" ? (a: Task, b: Task) => (b.completedAt ?? 0) - (a.completedAt ?? 0) : cmp[sort];
    return s.tasks
      .filter(match[view])
      .filter((t) => (!cat || t.category === cat) && (!pri || t.priority === pri))
      .filter((t) => !needle || `${t.title} ${t.notes} ${t.subtasks.map((x) => x.title).join(" ")}`.toLowerCase().includes(needle))
      .sort(order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tasks, view, q, cat, pri, sort, today]);

  return (
    <>
      <PageHeader title="Tasks" sub="Click a task to see its steps and actions." />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line pb-2" role="tablist">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 text-[13px] ${view === v ? "bg-hover font-medium" : "text-muted hover:bg-hover"}`}>
            {v} <span className="text-xs text-muted">{counts[v]}</span>
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input className="col-span-2 sm:col-span-1" placeholder="Search tasks" aria-label="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {[...new Set([...s.settings.categories, ...s.tasks.map((t) => t.category)])].map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select aria-label="Filter by priority" value={pri} onChange={(e) => setPri(e.target.value as Priority | "")}>
          <option value="">All priorities</option>
          {["critical", "high", "medium", "low"].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
        </Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="priority">Sort: priority</option>
          <option value="deadline">Sort: deadline</option>
          <option value="created">Sort: newest</option>
          <option value="category">Sort: category</option>
        </Select>
      </div>
      {list.length ? (
        <ul>{list.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
      ) : (
        <Empty>
          {s.tasks.length === 0 ? "No tasks yet. Press n or use New task to add your first one." : q || cat || pri ? "No tasks match these filters." : `Nothing in ${view}.`}
        </Empty>
      )}
    </>
  );
}
