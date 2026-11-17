"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppProvider, MODES, useApp, useRemaining } from "@/lib/store";
import { dateKey } from "@/lib/utils";
import { DialogProvider, useDialogs } from "./dialogs";
import { Onboarding } from "./Onboarding";
import { Button } from "./ui";

export const NAV_GROUPS: { label: string; items: [string, string][] }[] = [
  { label: "Today", items: [["/", "Dashboard"], ["/tasks", "Tasks"], ["/planner", "Planner"], ["/focus", "Focus"]] },
  { label: "Grow", items: [["/habits", "Habits"], ["/goals", "Goals"]] },
  { label: "Review", items: [["/insights", "Insights"], ["/settings", "Settings"]] },
];
const FLAT = NAV_GROUPS.flatMap((g) => g.items);
const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export const mmss = (ms: number) => {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

function TimerPill() {
  const { s } = useApp();
  const left = useRemaining(s.timer);
  const path = usePathname();
  if (!s.timer || path === "/focus") return null;
  const label = s.timer.phase === "work" ? "Focus" : "Break";
  return (
    <Link href="/focus" aria-label={`${label} timer ${mmss(left)}, open Focus`} className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-xs hover:bg-hover">
      <span className={`size-1.5 rounded-full ${s.timer.endsAt ? "bg-ok" : "bg-muted"}`} />
      {label} <span className="font-mono tabular-nums">{mmss(left)}</span>
    </Link>
  );
}

/** In-app reminder banner, so reminders work without browser notification permission. */
function Reminders() {
  const { s, dismissReminder } = useApp();
  const { openTask } = useDialogs();
  const [now, setNow] = useState(() => dateKey(Date.now()) + "T" + new Date().toTimeString().slice(0, 5));
  useEffect(() => {
    const id = setInterval(() => setNow(dateKey(Date.now()) + "T" + new Date().toTimeString().slice(0, 5)), 10000);
    return () => clearInterval(id);
  }, []);
  const due = s.tasks.filter((t) => t.remind && !t.reminded && t.remind <= now && t.status !== "done" && t.status !== "archived");
  if (!due.length) return null;
  return (
    <div className="border-b border-line bg-accent-soft px-4 py-2 md:px-8" role="status">
      {due.map((t) => (
        <div key={t.id} className="flex items-center gap-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate">Reminder: <b>{t.title}</b></span>
          <Button variant="ghost" onClick={() => openTask(t)}>Open</Button>
          <Button variant="ghost" onClick={() => dismissReminder(t.id)}>Dismiss</Button>
        </div>
      ))}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { s, ready } = useApp();
  const { openTask } = useDialogs();
  const path = usePathname();
  const strip = useRef<HTMLElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,select,[contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        openTask(null);
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [openTask]);

  // Tab title: timer while one exists, otherwise the current page.
  useEffect(() => {
    const page = FLAT.find(([h]) => isActive(path, h))?.[1] ?? "GrindBox";
    const base = page === "Dashboard" ? "GrindBox" : `${page} · GrindBox`;
    const t = s.timer;
    if (!t) {
      document.title = base;
      return;
    }
    const paint = () => {
      const left = t.endsAt ? Math.max(0, t.endsAt - Date.now()) : t.remainingMs;
      document.title = `${mmss(left)} · ${t.phase === "work" ? MODES[t.mode].label : "Break"}`;
    };
    paint();
    const id = setInterval(paint, 500);
    return () => clearInterval(id);
  }, [s.timer, path]);

  // Keep the active tab of the mobile strip in view.
  useEffect(() => {
    strip.current?.querySelector("[aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [path, ready]);

  if (!ready) return <div className="p-8 text-muted" role="status">Loading…</div>;
  if (!s.settings.onboarded) return <Onboarding />;

  const focusing = path === "/focus" && s.timer?.phase === "work" && s.timer.endsAt !== null;

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-1.5 focus:shadow">Skip to content</a>
      {!focusing && (
        <aside className="hidden w-52 shrink-0 flex-col border-r border-line p-3 md:flex">
          <Link href="/" className="mb-5 block rounded-md px-2.5 pt-1 text-sm font-semibold tracking-tight hover:text-accent" aria-label="GrindBox, go to dashboard">GrindBox</Link>
          <nav aria-label="Primary" className="space-y-5">
            {NAV_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.label}</p>
                <div className="space-y-0.5">
                  {g.items.map(([href, label]) => {
                    const on = isActive(path, href);
                    return (
                      <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`block rounded-md px-2.5 py-1.5 text-[13px] ${on ? "bg-hover font-medium" : "text-muted hover:bg-hover hover:text-ink"}`}>
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <p className="mt-auto px-2.5 pt-6 text-xs text-muted">Press <kbd className="rounded border border-line px-1">n</kbd> for a new task</p>
        </aside>
      )}
      <div className="min-w-0 flex-1">
        <header className="flex h-12 items-center justify-between border-b border-line px-4 md:px-8">
          {focusing ? (
            <Link href="/" className="text-[13px] text-muted hover:text-ink">← Leave focus view (timer keeps running)</Link>
          ) : (
            <Link href="/" className="text-sm font-semibold tracking-tight md:invisible" aria-label="GrindBox, go to dashboard">GrindBox</Link>
          )}
          <div className="flex items-center gap-2">
            <TimerPill />
            {!focusing && <Button variant="primary" onClick={() => openTask(null)} title="Shortcut: n">+ New task</Button>}
          </div>
        </header>
        {!focusing && (
          <nav ref={strip} aria-label="Primary" className="flex gap-1 overflow-x-auto border-b border-line px-3 py-1.5 md:hidden">
            {FLAT.map(([href, label]) => {
              const on = isActive(path, href);
              return (
                <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] ${on ? "bg-hover font-medium" : "text-muted"}`}>
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
        <Reminders />
        <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-6 outline-none md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <DialogProvider>
        <Frame>{children}</Frame>
      </DialogProvider>
    </AppProvider>
  );
}
