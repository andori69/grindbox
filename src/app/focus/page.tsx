"use client";
import { useEffect, useRef, useState } from "react";
import { mmss } from "@/components/Shell";
import { Button, Empty, Field, NumField, PageHeader, Section, Select } from "@/components/ui";
import { MODES, useApp, useRemaining } from "@/lib/store";
import type { Mode } from "@/lib/types";
import { dateKey, fmtMin, isOpen, pickNext } from "@/lib/utils";

/** Brown noise through WebAudio; no audio files needed. */
function useNoise(on: boolean) {
  const ref = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);
  useEffect(() => {
    if (!on) return;
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    src.connect(gain).connect(ctx.destination);
    src.start();
    ref.current = { ctx, src };
    return () => {
      src.stop();
      ctx.close();
      ref.current = null;
    };
  }, [on]);
}

export default function Focus() {
  const { s, today, startTimer, pauseTimer, resumeTimer, resetTimer, finishTimerEarly, updateSettings } = useApp();
  const t = s.timer;
  const left = useRemaining(t);
  const [mode, setMode] = useState<Mode>("study");
  const [taskId, setTaskId] = useState<string | null>(null); // null = suggested task, "" = no task
  const [sound, setSound] = useState(false);
  useNoise(sound);

  const open = s.tasks.filter(isOpen);
  const chosen = t ? t.taskId ?? "" : taskId ?? pickNext(s.tasks, today)?.id ?? "";
  const task = s.tasks.find((x) => x.id === chosen);
  const tz = s.settings.timeZone;
  const todays = s.sessions.filter((x) => dateKey(x.finishedAt, tz) === today);
  const todayMin = todays.reduce((a, x) => a + x.minutes, 0);
  const running = t?.endsAt != null;
  const working = t?.phase === "work";
  const pct = t ? 1 - left / t.totalMs : 0;
  const label = !t ? MODES[mode].label : working ? MODES[t.mode].label : t.phase === "short" ? "Short break" : "Long break";
  const minutes = MODES[mode].min ?? s.settings.workMin;

  return (
    <>
      <PageHeader title="Focus" sub={running && working ? "Focusing. Stay with one thing." : "One task, one timer."} />

      <div className="mx-auto max-w-sm text-center">
        <p className="text-[13px] text-muted">{label}</p>
        <div className="my-2 font-mono text-7xl font-light tabular-nums" aria-live="off" role="timer">{mmss(t ? left : minutes * 60000)}</div>
        <div className="mx-auto mb-4 h-1 w-full overflow-hidden rounded-full bg-hover">
          <div className="h-full bg-accent" style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="mb-5 min-h-5 text-[15px] font-medium">{task ? task.title : <span className="font-normal text-muted">No task selected</span>}</p>

        <div className="flex justify-center gap-2">
          {!t && <Button variant="primary" onClick={() => startTimer({ taskId: chosen || undefined, mode })}>Start</Button>}
          {t && running && <Button onClick={pauseTimer}>Pause</Button>}
          {t && !running && <Button variant="primary" onClick={resumeTimer}>{left === t.totalMs ? "Start" : "Resume"}</Button>}
          {t && working && <Button onClick={finishTimerEarly}>Finish early</Button>}
          {t && <Button variant={working ? "danger" : "default"} onClick={resetTimer}>{working ? "Discard" : "Skip break"}</Button>}
        </div>
        {t && working && <p className="mt-3 text-xs text-muted">Finish early logs the time you worked. Discard throws it away. Neither marks the task done.</p>}
      </div>

      {!(running && working) && (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Field label="Mode">
            <Select value={mode} disabled={!!t} onChange={(e) => setMode(e.target.value as Mode)}>
              {(Object.keys(MODES) as Mode[]).map((m) => <option key={m} value={m}>{MODES[m].label} ({MODES[m].min ?? s.settings.workMin} min)</option>)}
            </Select>
          </Field>
          <Field label="Task">
            <Select value={chosen} disabled={!!t} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No task</option>
              {open.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </Select>
          </Field>
          <Field label="Sound">
            <Select value={sound ? "on" : "off"} onChange={(e) => setSound(e.target.value === "on")}>
              <option value="off">Silent</option>
              <option value="on">Brown noise</option>
            </Select>
          </Field>
          {mode === "custom" && !t && (
            <>
              <Field label="Work minutes"><NumField min={1} max={180} value={s.settings.workMin} onCommit={(n) => updateSettings({ workMin: n })} /></Field>
              <Field label="Short break"><NumField min={1} max={60} value={s.settings.shortMin} onCommit={(n) => updateSettings({ shortMin: n })} /></Field>
              <Field label="Long break"><NumField min={1} max={90} value={s.settings.longMin} onCommit={(n) => updateSettings({ longMin: n })} /></Field>
            </>
          )}
        </div>
      )}

      <div className="mt-10">
        <Section title={`Today · ${todays.length} session${todays.length === 1 ? "" : "s"} · ${fmtMin(todayMin)}`}>
          {s.sessions.length ? (
            <ul>
              {[...s.sessions].reverse().slice(0, 20).map((x) => (
                <li key={x.id} className="flex items-center justify-between border-b border-line py-1.5 text-[13px] last:border-0">
                  <span className="truncate">{s.tasks.find((y) => y.id === x.taskId)?.title ?? "No task"}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {MODES[x.mode].label} · {x.minutes}m · {x.progress ? { yes: "progress", some: "a little", no: "no progress" }[x.progress] : "unreviewed"} · {dateKey(x.finishedAt, tz)} {new Date(x.finishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: tz || undefined })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No sessions yet. Your history appears here.</Empty>
          )}
        </Section>
      </div>
    </>
  );
}
