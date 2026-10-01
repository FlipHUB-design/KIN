// Shared types, labels and date helpers for KIN.

export type Role = "admin" | "family" | "contributor" | "helper" | "supported";
export type TaskStatus = "open" | "accepted" | "done" | "cancelled";
export type Recurrence = "none" | "daily" | "weekly" | "fortnightly" | "monthly" | "annually";

export type Kind = "care" | "children";
export type Circle = {
  id: string;
  person_name: string;
  preferred_name: string;
  checkin_by: string | null;
  checkin_note: string | null;
  checkin_dismissed_on?: string | null;
  kind?: Kind;
  packing_list?: string[];
  handover_note?: string | null;
  default_split?: Record<string, number> | null;
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
  child_ids?: string[];
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
  child_ids?: string[];
  end_date?: string | null;
  private?: boolean;
  share_with_helpers?: boolean;
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
export const KID_CATEGORIES = [
  "School", "Club or activity", "Pick-up or drop-off", "Appointment", "Shopping", "Birthday or party", "Childcare", "Administration", "Household", "Other",
];
export const categoriesFor = (k?: Kind) => (k === "children" ? KID_CATEGORIES : CATEGORIES);

const KID_ROLE_LABEL: Record<Role, string> = {
  admin: "Parent (administrator)",
  family: "Parent or step-parent",
  contributor: "Grandparent or relative",
  helper: "Childminder, nanny or club",
  supported: "Young person (13+)",
};
const KID_ROLE_DESC: Record<Role, string> = {
  admin: "Full access. Manages the family, invitations and permissions. Answers swap requests and shared costs.",
  family: "Sees everything shared between parents, including money. Can ask for swaps and answer requests.",
  contributor: "Sees where the children are, their own tasks, shared tasks and events. No money or private notes.",
  helper: "Sees their own pick-ups, which home the children go to, allergies, school details and events shared with them.",
  supported: "Their own simple view: where they're sleeping, what to pack and what's on. No money or adult notes.",
};
export const roleLabel = (r: Role, k?: Kind) => (k === "children" ? KID_ROLE_LABEL[r] : ROLE_LABEL[r]);
export const roleDesc = (r: Role, k?: Kind) => (k === "children" ? KID_ROLE_DESC[r] : ROLE_DESC[r]);
export const circleNoun = (k?: Kind) => (k === "children" ? "Family" : "Care Circle");
export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Does not repeat", daily: "Daily", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", annually: "Annually",
};
export const DOC_CATEGORIES = ["Medical", "Insurance", "Property", "Utilities", "Legal", "Financial", "Care", "Warranties", "Other"];
export const CONTACT_CATEGORIES = ["Family", "GP", "Pharmacy", "Hospital", "Care provider", "Neighbour", "Cleaner", "Gardener", "Handyman", "Electrician", "Plumber", "Other"];
export const KID_CONTACT_CATEGORIES = ["Family", "School", "Authorised to collect", "Childminder", "Club or coach", "GP", "Dentist", "Friend's parent", "Mediator", "Solicitor", "Other"];

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
export const isLift = (t: Pick<Task, "category">) => t.category === "Transport" || t.category === "Pick-up or drop-off";
export const kindOf = (t: Pick<Task, "category">) =>
  t.category === "Visit" || t.category === "Club or activity" ? "visit" : isLift(t) ? "transport" : t.category === "Maintenance" ? "maintenance" : t.category === "School" ? "appointment" : "task";

export const isInner = (r: Role | null, k?: Kind) => r === "admin" || r === "family" || (r === "supported" && k !== "children");
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
export type Expense = {
  id: string; description: string; category: string; amount_pence: number; paid_by: string; split_between: string[]; spent_on: string; created_by: string | null;
  shares?: Record<string, number> | null; status?: "pending" | "approved" | "disputed"; child_ids?: string[]; receipt_document_id?: string | null;
  responded_by?: string | null; responded_at?: string | null; response_note?: string | null;
};
export type Settlement = { id: string; from_user: string; to_user: string; amount_pence: number; paid_on: string; note: string | null; created_by: string | null; kind?: "settle" | "maintenance" };
export const EXPENSE_CATEGORIES = ["Shopping", "Travel", "Household", "Bills", "Care and support", "Gifts", "Other"];
export const KID_EXPENSE_CATEGORIES = ["School", "Uniform and clothes", "Clubs and activities", "Childcare", "Health and dental", "Trips and holidays", "Birthdays and gifts", "Phone and tech", "Other"];
export const expenseCategoriesFor = (k?: Kind) => (k === "children" ? KID_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES);

/** Each person's share of a cost in pence, using weights if set, otherwise equal. Shares always add up to the total. */
export function sharesOf(e: Pick<Expense, "amount_pence" | "split_between" | "shares">) {
  const ids = e.split_between;
  let w = ids.map((id) => Math.max(0, Number(e.shares?.[id] ?? 1)) || 0);
  if (w.reduce((a, b) => a + b, 0) === 0) w = ids.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const raw = w.map((x) => (e.amount_pence * x) / total);
  const out = raw.map(Math.floor);
  let rem = e.amount_pence - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f);
  for (const { i } of order) { if (rem <= 0) break; out[i]++; rem--; }
  return Object.fromEntries(ids.map((id, i) => [id, out[i]])) as Record<string, number>;
}
export const money = (p: number) => (p < 0 ? "-" : "") + "£" + (Math.abs(p) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Net position per person in pence: positive = owed money, negative = owes. */
export function balances(expenses: Expense[], settlements: Settlement[]) {
  const net: Record<string, number> = {};
  const add = (id: string, v: number) => (net[id] = (net[id] || 0) + v);
  for (const e of expenses) {
    if (e.status && e.status !== "approved") continue;
    add(e.paid_by, e.amount_pence);
    for (const [id, v] of Object.entries(sharesOf(e))) add(id, -v);
  }
  for (const s of settlements) {
    if (s.kind === "maintenance") continue;
    add(s.from_user, s.amount_pence); add(s.to_user, -s.amount_pence);
  }
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

// ---- children and co-parenting
export type Child = {
  id: string; circle_id: string; first_name: string; last_name: string | null; date_of_birth: string | null; colour: string;
  school: string | null; year_group: string | null; class_name: string | null; teacher: string | null;
  allergies: string | null; important_notes: string | null; clothes_size: string | null; shoe_size: string | null;
  gp: string | null; dentist: string | null; passport_expiry: string | null; user_id: string | null; sort: number;
};
export type Household = { id: string; circle_id: string; name: string; colour: string; address: string | null; sort: number };
export type Night = { night: string; household_id: string | null; changed: boolean };
export type ScheduleChange = {
  id: string; start_date: string; end_date: string; household_id: string; reason: string | null; in_return: string | null;
  status: "requested" | "accepted" | "declined" | "cancelled"; requested_by: string | null; requested_at: string;
  responded_by: string | null; responded_at: string | null; response_note: string | null;
};
export type Agreement = {
  id: string; title: string; detail: string | null; category: string; share: boolean; status: "proposed" | "agreed" | "declined" | "withdrawn";
  proposed_by: string | null; proposed_at: string; decided_by: string | null; decided_at: string | null; note: string | null;
};
export type Handover = { id: string; handed_at: string; from_household: string | null; to_household: string | null; recorded_by: string | null; items_packed: string[]; items_missing: string[]; note: string | null };
export type ChildItem = { id: string; child_id: string | null; name: string; household_id: string | null; location_note: string | null; updated_by: string | null; updated_at: string };

export const COLOURS = ["blue", "plum", "amber", "coral", "accent"] as const;
export const AGREEMENT_CATEGORIES = ["Routines and bedtimes", "Screens and phones", "School", "Health", "Money", "Holidays and special days", "Handovers", "Other"];

export const ageOn = (dob: string | null, on = today()) => {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = on.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};
export const childNames = (ids: string[] | undefined, kids: Child[]) => {
  const names = (ids || []).map((id) => kids.find((k) => k.id === id)?.first_name).filter(Boolean) as string[];
  if (names.length && names.length === kids.length && kids.length > 1) return kids.length === 2 ? `${kids[0].first_name} and ${kids[1].first_name}` : "All the children";
  return names.length <= 2 ? names.join(" and ") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
};
export const kidsLabel = (kids: Child[]) => childNames(kids.map((k) => k.id), kids) || "the children";

/** Next change of home after `from` (a night where the household differs from the previous night). */
export function nextHandover(nights: Night[], from = today()) {
  for (let i = 1; i < nights.length; i++) {
    if (nights[i].night <= from) continue;
    if (nights[i].household_id && nights[i].household_id !== nights[i - 1].household_id) {
      return { date: nights[i].night, from: nights[i - 1].household_id, to: nights[i].household_id };
    }
  }
  return null;
}

/** Common patterns for children living across two homes, as 14 nights starting on a Monday. A = first home, B = second. */
export const PATTERNS: { key: string; label: string; desc: string; days: ("A" | "B")[] }[] = [
  { key: "2255", label: "2-2-5-5", desc: "Mon and Tue with one parent, Wed and Thu with the other, weekends alternate", days: ["A","A","B","B","A","A","A", "A","A","B","B","B","B","B"] },
  { key: "223", label: "2-2-3", desc: "Two nights, two nights, three nights, swapping each week", days: ["A","A","B","B","A","A","A", "B","B","A","A","B","B","B"] },
  { key: "week", label: "Week on, week off", desc: "A full week with each parent in turn", days: ["A","A","A","A","A","A","A", "B","B","B","B","B","B","B"] },
  { key: "weekends", label: "Every other weekend", desc: "Friday and Saturday nights with the second home every other week", days: ["A","A","A","A","B","B","A", "A","A","A","A","A","A","A"] },
  { key: "weekends-mid", label: "Every other weekend plus a midweek night", desc: "As above, plus every Wednesday night", days: ["A","A","B","A","B","B","A", "A","A","B","A","A","A","A"] },
];

/** What an older relative might need help with, asked during guided setup. */
export const CARE_NEEDS: { key: string; label: string }[] = [
  { key: "shopping", label: "Shopping" },
  { key: "lifts", label: "Lifts to appointments" },
  { key: "medication", label: "Prescriptions and medication" },
  { key: "cleaning", label: "Cleaning" },
  { key: "garden", label: "Garden and bins" },
  { key: "paperwork", label: "Post, bills and forms" },
  { key: "visits", label: "Regular visits or calls" },
  { key: "meals", label: "Meals" },
];
