"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import type { Mode, Task } from "@/lib/types";
import { ProcrastinateModal, StartSmallModal } from "./Assistant";
import { TaskModal } from "./TaskModal";
import { Button, Confirm, Modal } from "./ui";

interface Dialogs {
  openTask: (task: Task | null, suggest?: boolean) => void;
  procrastinate: (taskId: string) => void;
  startSmall: (taskId: string) => void;
  /** Start a focus session and go to the Focus page; asks first if it would replace a session in progress. */
  focus: (o: { taskId?: string; mode?: Mode; minutes?: number }) => void;
}

const Ctx = createContext<Dialogs | null>(null);
export const useDialogs = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDialogs outside provider");
  return c;
};

type Open = { kind: "task"; task: Task | null; suggest?: boolean } | { kind: "proc"; id: string } | { kind: "small"; id: string } | null;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { s, reviewSession, dismissReview, toggleTask, startTimer } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [pending, setPending] = useState<Parameters<Dialogs["focus"]>[0] | null>(null);
  const begin = (o: Parameters<Dialogs["focus"]>[0]) => {
    startTimer(o);
    setPending(null);
    router.push("/focus");
  };
  const close = useCallback(() => setOpen(null), []);
  const api: Dialogs = {
    openTask: (task, suggest) => setOpen({ kind: "task", task, suggest }),
    procrastinate: (id) => setOpen({ kind: "proc", id }),
    startSmall: (id) => setOpen({ kind: "small", id }),
    focus: (o) => {
      const t = s.timer;
      const inProgress = t?.phase === "work" && (t.endsAt !== null || t.remainingMs < t.totalMs);
      if (inProgress) setPending(o);
      else begin(o);
    },
  };
  const session = s.review ? s.sessions.find((x) => x.id === s.review) : undefined;
  const reviewTask = session?.taskId ? s.tasks.find((t) => t.id === session.taskId) : undefined;

  return (
    <Ctx.Provider value={api}>
      {children}
      {open?.kind === "task" && <TaskModal key={open.task?.id ?? "new"} task={open.task} suggest={open.suggest} onClose={close} />}
      {open?.kind === "proc" && (
        <ProcrastinateModal taskId={open.id} onClose={close} onBreakdown={() => setOpen({ kind: "task", task: s.tasks.find((t) => t.id === open.id) ?? null, suggest: true })} />
      )}
      {open?.kind === "small" && <StartSmallModal taskId={open.id} onClose={close} />}
      {pending && <Confirm action="Start new session" message="A focus session is in progress. Starting a new one discards it. Use Finish early on the Focus page to keep its time." onNo={() => setPending(null)} onYes={() => begin(pending)} />}
      {session && (
        <Modal title="Session complete" onClose={dismissReview}>
          <p className="mb-1 text-[13px]">{session.minutes} minutes of focus{reviewTask ? <> on <b>{reviewTask.title}</b></> : ""}.</p>
          <p className="mb-3 font-medium">Did you make progress?</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => reviewSession(session.id, "yes")}>Yes</Button>
            <Button onClick={() => reviewSession(session.id, "some")}>A little</Button>
            <Button onClick={() => reviewSession(session.id, "no")}>Not really</Button>
            {reviewTask && reviewTask.status !== "done" && (
              <Button onClick={() => { reviewSession(session.id, "yes"); toggleTask(reviewTask.id); }}>Yes, and the task is done</Button>
            )}
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}
