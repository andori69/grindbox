"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { isOpen, smallestStep, uid } from "@/lib/utils";
import { useDialogs } from "./dialogs";
import { Button, Input, Modal, Textarea } from "./ui";

const REASONS = [
  ["overwhelmed", "The task feels overwhelming."],
  ["begin", "I don't know where to begin."],
  ["fear", "I'm afraid of failing."],
  ["perfect", "I want everything to be perfect."],
  ["motivation", "I'm not motivated."],
  ["tired", "I'm tired or mentally exhausted."],
  ["distracted", "I'm distracted."],
  ["boring", "The task feels boring."],
  ["unclear", "I don't understand the task."],
  ["other", "Something else."],
] as const;

const CHALLENGE_TO_REASON: Record<string, string> = {
  Overwhelm: "overwhelmed",
  "Not knowing where to start": "begin",
  "Fear of failure": "fear",
  Perfectionism: "perfect",
  "Low motivation": "motivation",
  Distraction: "distracted",
  Boredom: "boring",
};

export function Countdown({ onDone, label }: { onDone: () => void; label: string }) {
  const [n, setN] = useState(5);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (n === 0) {
      done.current();
      return;
    }
    const id = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(id);
  }, [n]);
  return (
    <div className="py-8 text-center" aria-live="polite">
      <div className="font-mono text-6xl tabular-nums">{n || "Go"}</div>
      <p className="mt-3 text-[13px] text-muted">{label}</p>
    </div>
  );
}

/** Starts a short timer after a 5-4-3-2-1 countdown (five-second rule). */
function StartButton({ taskId, minutes, label, onStarted }: { taskId: string; minutes: number; label: string; onStarted: () => void }) {
  const { focus } = useDialogs();
  const [counting, setCounting] = useState(false);
  if (counting)
    return (
      <Countdown
        label={`${minutes}-minute timer starts. Just begin.`}
        onDone={() => {
          onStarted();
          focus({ taskId, mode: "quick", minutes });
        }}
      />
    );
  return <Button variant="primary" onClick={() => setCounting(true)}>{label}</Button>;
}

export function StartSmallModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { s, saveTask } = useApp();
  const task = s.tasks.find((t) => t.id === taskId);
  const [step, setStep] = useState(() => (task ? smallestStep(task.title) : ""));
  if (!task) return null;
  const addStep = () => {
    if (step.trim()) saveTask({ ...task, subtasks: [{ id: uid(), title: step.trim(), done: false }, ...task.subtasks] });
  };
  return (
    <Modal title="Start small" onClose={onClose}>
      <p className="mb-3 text-[13px]">What is the smallest action on <b>{task.title}</b> that takes 1–5 minutes? Edit this suggestion to fit.</p>
      <Input value={step} onChange={(e) => setStep(e.target.value)} aria-label="Smallest first action" />
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button onClick={() => { addStep(); onClose(); }}>Add as first step</Button>
        {step.trim() && <StartButton taskId={taskId} minutes={5} label="Add & start 5 min" onStarted={() => { addStep(); onClose(); }} />}
      </div>
    </Modal>
  );
}

export function ProcrastinateModal({ taskId, onClose, onBreakdown }: { taskId: string; onClose: () => void; onBreakdown: () => void }) {
  const { s, saveTask, logProcrastination, postpone } = useApp();
  const { focus } = useDialogs();
  const task = s.tasks.find((t) => t.id === taskId);
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState("");
  if (!task) return null;

  const first = REASONS.find(([k]) => s.settings.challenges.some((c) => CHALLENGE_TO_REASON[c] === k))?.[0];
  const ordered = [...REASONS].sort((a, b) => (a[0] === first ? -1 : b[0] === first ? 1 : 0));
  const pick = (k: string, label: string) => {
    logProcrastination(task.id, label);
    setReason(k);
  };
  const go = (minutes: number, mode: "quick" | "deep" | "study" = "quick") => {
    onClose();
    focus({ taskId, mode, minutes });
  };
  const easier = s.tasks.filter((t) => isOpen(t) && t.id !== taskId && (t.estimateMin ?? 999) <= 15).sort((a, b) => (a.estimateMin ?? 999) - (b.estimateMin ?? 999))[0];

  const body: Record<string, React.ReactNode> = {
    overwhelmed: (
      <>
        <p>Big tasks stall. Break it into steps and do only the first one.</p>
        <Button variant="primary" onClick={() => { onClose(); onBreakdown(); }}>Break it into steps</Button>
      </>
    ),
    begin: (
      <>
        <p>Your first action: <b>{task.subtasks.find((x) => !x.done)?.title ?? smallestStep(task.title)}</b></p>
        <p className="text-muted">Try it for 5 minutes. You can stop after.</p>
        <StartButton taskId={taskId} minutes={5} label="Five-minute rule: start" onStarted={onClose} />
      </>
    ),
    fear: (
      <>
        <p>The first version is allowed to be bad. Its only job is to exist.</p>
        <p className="text-muted">Write an imperfect first attempt for 5 minutes.</p>
        <StartButton taskId={taskId} minutes={5} label="Start an imperfect draft" onStarted={onClose} />
      </>
    ),
    perfect: (
      <>
        <p><b>Done is better than perfect.</b> Set a 10-minute limit. Ship something rough, then improve it only if time remains.</p>
        <StartButton taskId={taskId} minutes={10} label="Start 10-minute challenge" onStarted={onClose} />
      </>
    ),
    motivation: (
      <>
        <p>Name why this matters and what finishing gives your future self.</p>
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Finishing this means…" />
        <StartButton
          taskId={taskId}
          minutes={5}
          label="Save and start 5 min"
          onStarted={() => {
            if (text.trim()) saveTask({ ...task, notes: `${task.notes ? task.notes + "\n\n" : ""}Why it matters: ${text.trim()}` });
            onClose();
          }}
        />
      </>
    ),
    tired: (
      <>
        <p>Resting is a valid move. Take a short break, or pick something lighter.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => go(5)}>Start a 5-min timer</Button>
          <Button onClick={() => { postpone(taskId); onClose(); }}>Push to tomorrow</Button>
        </div>
        {easier && <p className="text-muted">Lighter option: <b>{easier.title}</b> ({easier.estimateMin} min)</p>}
      </>
    ),
    distracted: (
      <>
        <p>Close other tabs, silence your phone, then run one focus session on this task.</p>
        <Button variant="primary" onClick={() => go(s.settings.workMin, "study")}>Start {s.settings.workMin}-min focus session</Button>
      </>
    ),
    boring: (
      <>
        <p>Turn it into a race: how much can you finish in 10 minutes? Changing rooms or music also helps.</p>
        <StartButton taskId={taskId} minutes={10} label="Start 10-minute challenge" onStarted={onClose} />
      </>
    ),
    unclear: (
      <>
        <p>Write the one question that would make this clear. Answering it is your first step.</p>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="What exactly do I not understand?" />
        <Button variant="primary" disabled={!text.trim()} onClick={() => { saveTask({ ...task, subtasks: [{ id: uid(), title: `Clarify: ${text.trim()}`, done: false }, ...task.subtasks] }); onClose(); }}>Add as first step</Button>
      </>
    ),
    other: (
      <>
        <p>Use the five-minute rule: work for 5 minutes, then decide whether to continue. Starting is the hard part.</p>
        <StartButton taskId={taskId} minutes={5} label="Start 5 minutes" onStarted={onClose} />
      </>
    ),
  };

  return (
    <Modal title="I'm procrastinating" onClose={onClose}>
      <p className="mb-3 text-[13px] text-muted">{task.title}</p>
      {!reason ? (
        <>
          <p className="mb-2 font-medium">What&apos;s stopping you from starting?</p>
          <div className="space-y-1">
            {ordered.map(([k, label]) => (
              <button key={k} onClick={() => pick(k, label)} className="block w-full rounded-md border border-line px-3 py-1.5 text-left text-[13px] hover:bg-hover">{label}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3 text-[13px]">
          {body[reason]}
          <button className="block text-xs text-muted underline" onClick={() => setReason(null)}>Pick a different reason</button>
        </div>
      )}
    </Modal>
  );
}
