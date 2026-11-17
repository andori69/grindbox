export type Priority = "critical" | "high" | "medium" | "low";
export type Status = "todo" | "doing" | "done" | "archived";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";
export type Mode = "deep" | "study" | "creative" | "quick" | "custom";
export type Phase = "work" | "short" | "long";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  status: Status;
  category: string;
  due?: string; // YYYY-MM-DD
  time?: string; // HH:MM, planner slot
  estimateMin?: number;
  spentMin: number;
  subtasks: Subtask[];
  recurring: Recurrence;
  remind?: string; // YYYY-MM-DDTHH:MM
  reminded?: boolean;
  goalId?: string;
  topFor?: string; // date this task is a top-3 priority
  postponed: number;
  procLog: { at: number; reason: string }[];
  createdAt: number;
  completedAt?: number;
}

export interface Habit {
  id: string;
  title: string;
  schedule: "daily" | "days" | "weekly";
  days: number[]; // 0=Sun..6=Sat, for "days"
  weeklyTarget: number; // for "weekly"
  paused: boolean;
  goalId?: string;
  log: string[]; // completed dates
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  horizon: "long" | "monthly" | "weekly";
  target?: string;
  milestones: { id: string; title: string; done: boolean }[];
  done: boolean;
  createdAt: number;
}

export interface Session {
  id: string;
  taskId?: string;
  mode: Mode;
  minutes: number;
  finishedAt: number;
  progress?: "yes" | "some" | "no";
}

export interface Reflection {
  week: string; // week start date
  answers: string[];
}

export interface Settings {
  name: string;
  theme: "light" | "dark" | "system";
  timeZone: string; // "" = browser local
  dateFormat: "ISO" | "DMY" | "MDY";
  weekStart: 0 | 1;
  notifications: boolean;
  workMin: number;
  shortMin: number;
  longMin: number;
  longEvery: number;
  availableHours: number;
  hoursStart: string;
  hoursEnd: string;
  gamification: boolean;
  categories: string[];
  challenges: string[];
  onboarded: boolean;
}

export interface Timer {
  phase: Phase;
  mode: Mode;
  taskId?: string;
  totalMs: number;
  remainingMs: number;
  endsAt: number | null; // null = paused / not started
}

export interface State {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  sessions: Session[];
  reflections: Reflection[];
  settings: Settings;
  timer: Timer | null;
  review: string | null; // session id awaiting "did you make progress?"
}
