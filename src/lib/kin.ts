// Shared types, labels and date helpers for KIN.

export type Role = "admin" | "family" | "contributor" | "helper" | "supported";
export type TaskStatus = "open" | "accepted" | "done" | "cancelled";
export type Recurrence = "none" | "daily" | "weekly" | "fortnightly" | "monthly" | "annually";

export type Circle = {
  id: string;
  person_name: string;
  preferred_name: string;
  checkin_by: string | null;
  checkin_note: string | null;
  checkin_dismissed_on?: string | null;
};
export type Member = {
  circle_id: string;
  user_id: string;
  role: Role;
  relationship: string;
  status: "active" | "paused";
  last_active_at: string | null;
  profiles?: { display_name: string; phone: string | null } | null;
};
export type Task = {
  id: string;
  circle_id: string;
  title: string;
  description: string | null;
  category: string;
  assignee: string | null;
  due_date: string | null;
  due_time: string | null;
  recurrence: Recurrence;
  priority: string;
  status: TaskStatus;
  private: boolean;
  appointment_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  source?: string | null;
  link_url?: string | null;
};
export type Appointment = {
  id: string;
  circle_id: string;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  attending: string | null;
  needs_transport: boolean;
  driver: string | null;
  notes: string | null;
};
export type Checkin = {
  id: string;
  circle_id: string;
  user_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  mood: string | null;
  note: string | null;
};
export type Activity = { id: number; actor: string | null; verb: string; subject: string | null; created_at: string };

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  family: "Family member",
  contributor: "Contributor",
  helper: "Helper",
  supported: "Supported person",
};
export const ROLE_DESC: Record<Role, string> = {
  admin: "Full access. Manages the circle, invitations and permissions.",
  family: "Sees everything shared with family. Creates, takes and completes tasks.",
  contributor: "Sees their own tasks, open tasks and appointments. No documents or personal details.",
  helper: "Sees only their own visits, the address, access notes and one contact.",
  supported: "Sees their own day in a simple view.",
};
export const CATEGORIES = [
  "Shopping", "Visit", "Household", "Maintenance", "Transport", "Medication reminder", "Administration", "Other",
];
export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Does not repeat", daily: "Daily", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", annually: "Annually",
};
export const DOC_CATEGORIES = ["Medical", "Insurance", "Property", "Utilities", "Legal", "Financial", "Care", "Warranties", "Other"];
export const CONTACT_CATEGORIES = ["Family", "GP", "Pharmacy", "Hospital", "Care provider", "Neighbour", "Cleaner", "Gardener", "Handyman", "Electrician", "Plumber", "Other"];

// ---- dates (KIN is UK-first: all "today" logic runs in Europe/London)
export const TZ = "Europe/London";
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const today = () => ymd(new Date());
export const nowHM = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
export const addDays = (s: string, n: number) => {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dayLabel = (s: string | null) => {
  if (!s) return "No date";
  const t = today();
  if (s === t) return "Today";
  if (s === addDays(t, 1)) return "Tomorrow";
  if (s === addDays(t, -1)) return "Yesterday";
  return new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};
export const longDate = (s: string) =>
  new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const hm = (t: string | null) => (t ? t.slice(0, 5) : "");
export const dateOf = (ts: string) => ymd(new Date(ts));
export const timeOf = (ts: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
export const when = (ts: string) => `${dayLabel(dateOf(ts))} at ${timeOf(ts)}`;

export const isOverdue = (t: Task) => t.status !== "done" && t.status !== "cancelled" && !!t.due_date && t.due_date < today();
export const kindOf = (t: Pick<Task, "category">) =>
  t.category === "Visit" ? "visit" : t.category === "Transport" ? "transport" : t.category === "Maintenance" ? "maintenance" : "task";

export const isInner = (r: Role | null) => r === "admin" || r === "family" || r === "supported";
export const canEdit = (r: Role | null) => r === "admin" || r === "family";

/** Coordination status only. Never a health or safety assessment. */
export function circleStatus(opts: { tasks: Task[]; appts: Appointment[]; checkins: Checkin[]; circle: Circle; dismissedToday?: boolean }) {
  const t = today();
  const reasons: string[] = [];
  let level = 0;
  for (const a of opts.appts) {
    if (a.needs_transport && !a.driver && a.date >= t && a.date <= addDays(t, 2)) {
      level = 2;
      reasons.push(`No driver yet for ${a.title} ${dayLabel(a.date).toLowerCase()}${a.time ? ` at ${hm(a.time)}` : ""}`);
    }
  }
  if (missedCheckin(opts.circle, opts.checkins) && !opts.dismissedToday) {
    level = 2;
    reasons.push(`No recorded check-in today (usually by ${hm(opts.circle.checkin_by)})`);
  }
  for (const x of opts.tasks) {
    if (isOverdue(x)) {
      level = Math.max(level, 1);
      reasons.push(`${x.title} is overdue`);
    } else if (!x.assignee && x.status === "open" && !x.appointment_id && x.due_date && x.due_date <= addDays(t, 3)) {
      level = Math.max(level, 1);
      reasons.push(`${x.title} needs someone`);
    }
  }
  const labels = ["All good", "Attention needed", "Urgent family action"] as const;
  return { level, reasons, label: labels[level], cls: ["good", "attn", "urgent"][level] };
}

export function missedCheckin(circle: Circle, checkins: Checkin[]) {
  if (!circle.checkin_by) return false;
  const t = today();
  if (checkins.some((c) => dateOf(c.checked_in_at) === t)) return false;
  return nowHM() >= hm(circle.checkin_by);
}

export const firstName = (m: Member | undefined | null) => (m?.profiles?.display_name || "Someone").split(" ")[0];

// ---- shared costs
export type Expense = { id: string; description: string; category: string; amount_pence: number; paid_by: string; split_between: string[]; spent_on: string; created_by: string | null };
export type Settlement = { id: string; from_user: string; to_user: string; amount_pence: number; paid_on: string; note: string | null; created_by: string | null };
export const EXPENSE_CATEGORIES = ["Shopping", "Travel", "Household", "Bills", "Care and support", "Gifts", "Other"];
export const money = (p: number) => (p < 0 ? "-" : "") + "£" + (Math.abs(p) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Net position per person in pence: positive = owed money, negative = owes. */
export function balances(expenses: Expense[], settlements: Settlement[]) {
  const net: Record<string, number> = {};
  const add = (id: string, v: number) => (net[id] = (net[id] || 0) + v);
  for (const e of expenses) {
    add(e.paid_by, e.amount_pence);
    const n = e.split_between.length;
    const share = Math.floor(e.amount_pence / n);
    let rem = e.amount_pence - share * n;
    for (const id of e.split_between) { add(id, -(share + (rem > 0 ? 1 : 0))); rem--; }
  }
  for (const s of settlements) { add(s.from_user, s.amount_pence); add(s.to_user, -s.amount_pence); }
  return net;
}

/** Fewest payments to settle up. */
export function settleUp(net: Record<string, number>) {
  const cred = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const debt = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    if (amt > 0) out.push({ from: debt[i].id, to: cred[j].id, amount: amt });
    debt[i].v -= amt; cred[j].v -= amt;
    if (debt[i].v === 0) i++;
    if (cred[j].v === 0) j++;
  }
  return out;
}
