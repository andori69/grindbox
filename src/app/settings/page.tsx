"use client";
import { useState } from "react";
import { Button, Confirm, Field, Input, NumField, PageHeader, Section, Select } from "@/components/ui";
import { useApp } from "@/lib/store";

export default function Settings() {
  const { s, updateSettings: set, exportData, resetAll, today } = useApp();
  const c = s.settings;
  const [cat, setCat] = useState("");
  const [wipe, setWipe] = useState(false);
  const [perm, setPerm] = useState("");
  const zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const toggleNotify = async () => {
    if (c.notifications) return set({ notifications: false });
    if (typeof Notification === "undefined") return setPerm("This browser does not support notifications.");
    const r = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setPerm(r === "granted" ? "" : "Permission denied. Allow notifications in your browser settings.");
    set({ notifications: r === "granted" });
  };

  return (
    <>
      <PageHeader title="Settings" />
      <Section title="Profile">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Time zone">
            <Select value={c.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
              <option value="">Browser ({local})</option>
              {zones.map((z) => <option key={z}>{z}</option>)}
            </Select>
          </Field>
          <Field label="Date format">
            <Select value={c.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as typeof c.dateFormat })}>
              <option value="ISO">2026-11-17</option><option value="DMY">17/11/2026</option><option value="MDY">11/17/2026</option>
            </Select>
          </Field>
          <Field label="Theme">
            <Select value={c.theme} onChange={(e) => set({ theme: e.target.value as typeof c.theme })}>
              <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
            </Select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted">Today is {today} in your selected time zone.</p>
      </Section>

      <Section title="Focus timer">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Work (min)"><NumField min={1} max={180} value={c.workMin} onCommit={(n) => set({ workMin: n })} /></Field>
          <Field label="Short break"><NumField min={1} max={60} value={c.shortMin} onCommit={(n) => set({ shortMin: n })} /></Field>
          <Field label="Long break"><NumField min={1} max={90} value={c.longMin} onCommit={(n) => set({ longMin: n })} /></Field>
          <Field label="Long break every"><NumField min={2} max={10} value={c.longEvery} onCommit={(n) => set({ longEvery: n })} /></Field>
        </div>
      </Section>

      <Section title="Planning and habits">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Realistic hours available per day"><NumField min={1} max={16} value={c.availableHours} onCommit={(n) => set({ availableHours: n })} /></Field>
          <Field label="Working hours start"><Input type="time" value={c.hoursStart} onChange={(e) => e.target.value && set({ hoursStart: e.target.value })} /></Field>
          <Field label="Working hours end"><Input type="time" value={c.hoursEnd} onChange={(e) => e.target.value && set({ hoursEnd: e.target.value })} /></Field>
          <Field label="Week starts on">
            <Select value={c.weekStart} onChange={(e) => set({ weekStart: Number(e.target.value) as 0 | 1 })}><option value={1}>Monday</option><option value={0}>Sunday</option></Select>
          </Field>
        </div>
      </Section>

      <Section title="Preferences">
        <label className="mb-2 flex items-center gap-2"><input type="checkbox" checked={c.notifications} onChange={toggleNotify} /> Browser notifications for reminders and timers</label>
        {perm && <p className="mb-2 text-xs text-bad">{perm}</p>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={c.gamification} onChange={(e) => set({ gamification: e.target.checked })} /> Show XP and milestones</label>
      </Section>

      <Section title="Categories">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {c.categories.map((x) => (
            <span key={x} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[13px]">
              {x}
              <button aria-label={`Remove ${x}`} className="text-muted hover:text-bad" onClick={() => set({ categories: c.categories.filter((y) => y !== x) })}>×</button>
            </span>
          ))}
        </div>
        <form className="flex max-w-xs gap-2" onSubmit={(e) => { e.preventDefault(); const v = cat.trim(); if (v && !c.categories.includes(v)) set({ categories: [...c.categories, v] }); setCat(""); }}>
          <Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="New category" aria-label="New category" />
          <Button type="submit">Add</Button>
        </form>
      </Section>

      <Section title="Data and account">
        <p className="mb-3 text-[13px] text-muted">Everything is stored in this browser only. There is no account or sync yet, so clearing site data erases it. Export a backup now and then.</p>
        <div className="flex gap-2">
          <Button onClick={exportData}>Export data (JSON)</Button>
          <Button variant="danger" onClick={() => setWipe(true)}>Delete all data</Button>
        </div>
      </Section>
      {wipe && <Confirm action="Delete everything" message="This permanently deletes all tasks, habits, goals, sessions and settings in this browser." onNo={() => setWipe(false)} onYes={() => { resetAll(); setWipe(false); }} />}
    </>
  );
}
