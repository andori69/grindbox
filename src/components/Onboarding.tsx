"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import type { Habit } from "@/lib/types";
import { uid } from "@/lib/utils";
import { Button, Field, Input, NumField, Select } from "./ui";

const IMPROVE = ["Study more consistently", "Improve work productivity", "Stop procrastinating", "Build better habits", "Improve time management", "Complete personal projects", "Become more disciplined"];
const CHALLENGES = ["Overwhelm", "Not knowing where to start", "Fear of failure", "Perfectionism", "Low motivation", "Distraction", "Boredom"];
const HABITS = ["Read for 20 minutes", "Exercise", "Study for 30 minutes", "Practice programming", "Sleep before 11 PM", "Avoid social media before working"];

function Pills({ items, value, onChange }: { items: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => {
        const on = value.includes(i);
        return (
          <button key={i} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i])} className={`rounded-md border px-2.5 py-1 text-[13px] ${on ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-hover"}`}>
            {i}
          </button>
        );
      })}
    </div>
  );
}

export function Onboarding() {
  const { patch, today } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [len, setLen] = useState(25);
  const [habits, setHabits] = useState<string[]>([]);
  const [hours, setHours] = useState(6);

  const finish = (skip = false) =>
    patch((p) => {
      const newHabits: Habit[] = skip ? [] : habits.map((title) => ({ id: uid(), title, schedule: "daily", days: [], weeklyTarget: 3, paused: false, log: [], createdAt: Date.now() }));
      return {
        ...p,
        goals: skip ? p.goals : [...p.goals, ...goals.map((title) => ({ id: uid(), title, description: "", horizon: "long" as const, milestones: [], done: false, createdAt: Date.now() }))],
        habits: [...p.habits, ...newHabits],
        settings: skip
          ? { ...p.settings, onboarded: true }
          : { ...p.settings, name: name.trim(), challenges, hoursStart: start, hoursEnd: end, workMin: len, availableHours: hours, onboarded: true },
      };
    });

  const steps = [
    <Field key="0" label="What should we call you? (optional)"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>,
    <div key="1"><p className="mb-2 text-[13px]">What do you want to improve?</p><Pills items={IMPROVE} value={goals} onChange={setGoals} /></div>,
    <div key="2"><p className="mb-2 text-[13px]">What gets in your way most often?</p><Pills items={CHALLENGES} value={challenges} onChange={setChallenges} /></div>,
    <div key="3" className="grid grid-cols-2 gap-3">
      <Field label="Working hours start"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <Field label="Working hours end"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      <Field label="Focus session length"><Select value={len} onChange={(e) => setLen(Number(e.target.value))}>{[15, 25, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select></Field>
      <Field label="Realistic hours available per day"><NumField min={1} max={16} value={hours} onCommit={setHours} /></Field>
    </div>,
    <div key="4"><p className="mb-2 text-[13px]">Any habits you already want to track?</p><Pills items={HABITS} value={habits} onChange={setHabits} /></div>,
  ];
  const titles = ["Welcome to GrindBox", "Your goals", "Your obstacles", "Your schedule", "Your habits"];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-bg p-4">
      <div className="w-full max-w-lg">
        <p className="text-xs text-muted">Step {step + 1} of {steps.length} · {today}</p>
        <h1 className="mb-1 mt-1 text-xl font-semibold tracking-tight">{titles[step]}</h1>
        <p className="mb-5 text-[13px] text-muted">{step === 0 && "Starting is the hard part. This takes under a minute and every question is optional."}</p>
        <div className="mb-6">{steps[step]}</div>
        <div className="flex items-center justify-between">
          <button className="text-[13px] text-muted underline" onClick={() => finish(true)}>Skip setup</button>
          <div className="flex gap-2">
            {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
            {step < steps.length - 1 ? <Button variant="primary" onClick={() => setStep(step + 1)}>Next</Button> : <Button variant="primary" onClick={() => finish()}>Finish</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
