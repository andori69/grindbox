"use client";
import { useEffect, useRef, useState } from "react";
import type { Priority } from "@/lib/types";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

export function Button({ variant = "default", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" }) {
  const v = {
    default: "border border-line bg-surface hover:bg-hover",
    primary: "bg-accent text-bg hover:opacity-90 border border-transparent",
    ghost: "hover:bg-hover border border-transparent text-muted hover:text-ink",
    danger: "border border-line text-bad hover:bg-hover",
  }[variant];
  return <button type="button" {...p} className={cx("inline-flex h-9 items-center md:h-8 justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium disabled:opacity-40", v, className)} />;
}

const field = "w-full rounded-md border border-line bg-surface px-2.5 h-9 md:h-8 text-[13px] placeholder:text-muted";
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(field, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(field, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(field, "h-auto py-1.5", p.className)} />;

export function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    (body.current?.querySelector<HTMLElement>("input,textarea,select,button") ?? ref.current)?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only the top-most dialog reacts.
        const all = document.querySelectorAll("[role=dialog]");
        if (all[all.length - 1] === ref.current) close.current();
      }
      if (e.key === "Tab" && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>("input,textarea,select,button,[href]")].filter((x) => !x.hasAttribute("disabled"));
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keys);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:py-12" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cx("w-full rounded-lg border border-line bg-surface shadow-lg outline-none", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded px-1.5 text-lg leading-none text-muted hover:text-ink">×</button>
        </div>
        <div ref={body} className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ message, onYes, onNo, action = "Delete" }: { message: string; onYes: () => void; onNo: () => void; action?: string }) {
  return (
    <Modal title="Are you sure?" onClose={onNo}>
      <p className="mb-4 text-sm">{message}</p>
      <div className="flex justify-end gap-2">
        <Button onClick={onNo}>Cancel</Button>
        <Button variant="primary" className="bg-bad!" onClick={onYes}>{action}</Button>
      </div>
    </Modal>
  );
}

export const PRIORITY_COLOR: Record<Priority, string> = { critical: "bg-bad", high: "bg-warn", medium: "bg-accent", low: "bg-muted" };

export const PriorityDot = ({ p }: { p: Priority }) => <span title={p} className={cx("inline-block size-2 shrink-0 rounded-full", PRIORITY_COLOR[p])} />;

export const Chip = ({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "bad" | "warn" | "ok" | "accent" }) => (
  <span className={cx("inline-flex items-center rounded px-1.5 py-0.5 text-xs", { muted: "bg-hover text-muted", bad: "bg-hover text-bad", warn: "bg-hover text-warn", ok: "bg-hover text-ok", accent: "bg-accent-soft text-accent" }[tone])}>{children}</span>
);

export const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="mb-8">
    <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

export const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-4 text-[13px] text-muted">{children}</p>;

export const Bar = ({ pct, label, tone = "accent" }: { pct: number; label: string; tone?: "accent" | "ok" | "bad" }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover" role="progressbar" aria-label={label} aria-valuenow={Math.round(Math.min(100, pct))} aria-valuemin={0} aria-valuemax={100}>
    <div className={cx("h-full rounded-full", tone === "ok" ? "bg-ok" : tone === "bad" ? "bg-bad" : "bg-accent")} style={{ width: `${Math.min(100, pct)}%` }} />
  </div>
);

export const Check = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={cx("flex size-5 shrink-0 items-center justify-center rounded border md:size-4", checked ? "border-ok bg-ok text-bg" : "border-muted hover:border-ink")}
  >
    {checked && <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>}
  </button>
);

export const PageHeader = ({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {sub && <p className="text-[13px] text-muted">{sub}</p>}
    </div>
    {action}
  </div>
);

/** Number input that lets you clear and retype; commits valid values live and clamps on blur. */
export function NumField({ value, min, max, onCommit, ...rest }: { value: number; min: number; max: number; onCommit: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(String(value));
  }
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  return (
    <Input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(n) && n >= min && n <= max) onCommit(Math.round(n));
      }}
      onBlur={() => {
        const n = clamp(Number(text) || min);
        setText(String(n));
        onCommit(n);
      }}
    />
  );
}
