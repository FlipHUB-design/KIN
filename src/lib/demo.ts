import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, today, TZ } from "@/lib/kin";
import { makePdf } from "@/lib/pdf";
import { sampleLetterLines, sampleResult } from "@/lib/letters";
import { playbook } from "@/lib/playbooks";

/**
 * Demo mode: a shared, clearly fictional Care Circle for trying KIN.
 * Everything here runs on the server with the service-role key. Demo users
 * sign in with a one-time link generated server-side, so they have no usable
 * password. Data is rebuilt once a day so dates stay relative to today.
 */

export const DEMO_ENABLED = process.env.DEMO_MODE !== "off";

export const PERSONAS = {
  sarah: { name: "Sarah Hale", phone: "07700 900112", blurb: "Daughter and organiser. Sees everything and manages the circle.", role: "Administrator" },
  anthony: { name: "Anthony Hale", phone: "07700 900245", blurb: "Son. Takes on shopping and lifts.", role: "Family member" },
  lucy: { name: "Lucy Hale", phone: "07700 900417", blurb: "Granddaughter. Sees her own tasks and shared ones only.", role: "Contributor" },
  helen: { name: "Helen Price", phone: "07700 900678", blurb: "Cleaner. Sees only her visits, the address and how to get in.", role: "Helper" },
  margaret: { name: "Margaret Hale", phone: "07700 900790", blurb: "The person being supported. A simple large-text view of her day.", role: "Supported person" },
  david: { name: "David Hale", phone: "07700 900381", blurb: "Son. Does the Sunday phone call.", role: "Family member" },
  mary: { name: "Mary Okafor", phone: "07700 900563", blurb: "Neighbour. Puts the bins out.", role: "Helper" },
} as const;
export type Persona = keyof typeof PERSONAS;
export const PICKABLE: Persona[] = ["sarah", "anthony", "lucy", "helen", "margaret"];
export const demoEmail = (p: Persona) => `${p}.demo@kin-demo.example.com`;

type Admin = SupabaseClient;

/** ISO timestamp for a London wall-clock date and time. */
function londonISO(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(guess);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const wall = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  return new Date(guess.getTime() - (wall - guess.getTime())).toISOString();
}

async function ensureUsers(admin: Admin) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const ids = {} as Record<Persona, string>;
  for (const p of Object.keys(PERSONAS) as Persona[]) {
    const found = data.users.find((u) => u.email === demoEmail(p));
    if (found) { ids[p] = found.id; continue; }
    const created = await admin.auth.admin.createUser({
      email: demoEmail(p),
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(), // never used or shown
      user_metadata: { display_name: PERSONAS[p].name, demo: true },
    });
    if (created.error || !created.data.user) throw created.error || new Error("Could not create demo user");
    ids[p] = created.data.user.id;
  }
  for (const p of Object.keys(PERSONAS) as Persona[]) {
    await admin.from("profiles").upsert({ id: ids[p], display_name: PERSONAS[p].name, phone: PERSONAS[p].phone });
  }
  return ids;
}

/** Makes sure demo users exist and the data was built today. Returns Margaret's circle id. */
export async function ensureDemo(admin: Admin, force = false): Promise<string> {
  const ids = await ensureUsers(admin);
  const { data: s } = await admin.auth.admin.getUserById(ids.sarah);
  const meta = (s.user?.user_metadata || {}) as { demo_seeded_on?: string; demo_circle?: string };
  if (!force && meta.demo_seeded_on === today() && meta.demo_circle) {
    const { data: still } = await admin.from("care_circles").select("id").eq("id", meta.demo_circle).maybeSingle();
    if (still) return meta.demo_circle;
  }
  const circle = await seed(admin, ids);
  await admin.auth.admin.updateUserById(ids.sarah, { user_metadata: { ...meta, demo_seeded_on: today(), demo_circle: circle } });
  return circle;
}

async function seed(admin: Admin, U: Record<Persona, string>) {
  const t = today();
  const D = (n: number) => addDays(t, n);
  const ts = (n: number, time: string) => londonISO(D(n), time);

  // Remove every circle a demo user created, with its files
  const { data: old } = await admin.from("care_circles").select("id").in("created_by", Object.values(U));
  for (const c of old || []) {
    const { data: files } = await admin.storage.from("documents").list(c.id);
    if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${c.id}/${f.name}`));
  }
  if (old?.length) await admin.from("care_circles").delete().in("id", old.map((c) => c.id));

  const ins = async <T = { id: string }>(table: string, rows: object | object[], sel = "id") => {
    const { data, error } = await admin.from(table).insert(rows).select(sel);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data as unknown as T[];
  };

  // ---------------------------------------------------------------- Margaret
  const [{ id: M }] = await ins("care_circles", {
    person_name: "Margaret Hale", preferred_name: "Margaret", checkin_by: "12:00",
    checkin_note: "Someone visits or calls Margaret before midday every day.", created_by: U.sarah,
  });
  await ins("memberships", [
    { circle_id: M, user_id: U.sarah, role: "admin", relationship: "Daughter", last_active_at: ts(-1, "11:40") },
    { circle_id: M, user_id: U.anthony, role: "family", relationship: "Son", last_active_at: ts(-2, "17:50") },
    { circle_id: M, user_id: U.david, role: "family", relationship: "Son", last_active_at: ts(-3, "20:12") },
    { circle_id: M, user_id: U.lucy, role: "contributor", relationship: "Granddaughter", last_active_at: ts(-4, "14:00") },
    { circle_id: M, user_id: U.mary, role: "helper", relationship: "Neighbour" },
    { circle_id: M, user_id: U.helen, role: "helper", relationship: "Cleaner" },
    { circle_id: M, user_id: U.margaret, role: "supported", relationship: "Supported person" },
  ], "circle_id");
  await ins("person_profiles", {
    circle_id: M, date_of_birth: "1948-03-14", phone: "01632 960012", preferred_contact: "Phone call, mornings",
    important_notes: "Prefers visits before 3pm.", accessibility_notes: "Hard of hearing on the left side. Large print helps.",
  }, "circle_id");
  await ins("visit_info", {
    circle_id: M, address: "14 Orchard Close\nDuston\nNorthampton NN5 0XX",
    access_instructions: "Key safe by the back door. Sarah shares the code.", key_contact_user: U.sarah,
  }, "circle_id");
  await ins("emergency_info", {
    circle_id: M, allergies: "Penicillin", important_info: "Hearing aid on the right side. Walking stick by the front door.",
    preferred_hospital: "Northampton General Hospital", power_of_attorney: "Sarah Hale holds lasting power of attorney for health and welfare. Original in the blue folder, hall cupboard.",
    updated_by: U.sarah,
  }, "circle_id");

  const [hosp] = await ins<{ id: string }>("appointments", [
    { circle_id: M, title: "Outpatient appointment", date: D(1), time: "14:30", location: "Northampton General Hospital", attending: "Margaret and Sarah", needs_transport: true, notes: "Bring the blue folder and current tablets list.", created_by: U.sarah },
  ]);
  await ins("appointments", [
    { circle_id: M, title: "GP review", date: D(9), time: "10:10", location: "Orchard Lane Surgery", attending: "Margaret", needs_transport: false, created_by: U.sarah },
    { circle_id: M, title: "Eye test", date: D(13), time: "11:00", location: "Duston opticians", attending: "Margaret and Lucy", needs_transport: false, notes: "Lucy is walking Gran there.", created_by: U.sarah },
  ]);

  const task = (o: Record<string, unknown>) => ({ circle_id: M, created_by: U.sarah, recurrence: "none", priority: "normal", private: false, status: o.assignee ? "accepted" : "open", ...o });
  const tasks = await ins<{ id: string; title: string }>("tasks", [
    task({ title: "Drive Margaret to Outpatient appointment", category: "Transport", due_date: D(1), due_time: "13:45", priority: "high", appointment_id: hosp.id, description: "Outpatient appointment, 14:30, Northampton General Hospital" }),
    task({ title: "Weekly shopping", category: "Shopping", assignee: U.anthony, due_date: D(3), due_time: "10:00", recurrence: "weekly" }),
    task({ title: "Sunday phone call", category: "Visit", assignee: U.david, due_date: D(4), due_time: "18:00", recurrence: "weekly" }),
    task({ title: "Tuesday visit", category: "Visit", assignee: U.sarah, due_date: D(6), due_time: "11:00", recurrence: "weekly" }),
    task({ title: "Collect repeat prescription", category: "Administration", due_date: D(0), due_time: "16:00", priority: "high", private: true, description: "Ready at Duston Pharmacy from today." }),
    task({ title: "Book boiler service", category: "Maintenance", due_date: D(-5), recurrence: "annually", description: "Last serviced a year ago. Engineer details in Home." }),
    task({ title: "Reply to council tax letter", category: "Administration", assignee: U.sarah, due_date: D(10), private: true, description: "Single person discount review. Reply by the date on the letter." }),
    task({ title: "Cleaning visit", category: "Household", assignee: U.helen, due_date: D(2), due_time: "10:00", recurrence: "weekly", description: "Kitchen, bathroom and change the bed." }),
    task({ title: "Put the bins out", category: "Household", assignee: U.mary, due_date: D(5), due_time: "19:00", recurrence: "weekly" }),
    task({ title: "Evening visit", category: "Visit", assignee: U.anthony, due_date: D(0), due_time: "17:30", description: "Dropping round after work." }),
    task({ title: "Call Gran after school", category: "Visit", assignee: U.lucy, due_date: D(1), due_time: "16:30" }),
    task({ title: "Change bulb in hall light", category: "Household", due_date: D(4) }),
    task({ title: "Pick up library books", category: "Shopping", assignee: U.anthony, due_date: D(-3), status: "done", completed_at: ts(-3, "15:20"), completed_by: U.anthony }),
  ], "id, title");
  const tid = (title: string) => tasks.find((x) => x.title === title)!.id;
  await ins("task_comments", [
    { task_id: tid("Weekly shopping"), circle_id: M, author: U.sarah, body: "Mum wants the smaller loaves now.", created_at: ts(-2, "19:04") },
    { task_id: tid("Weekly shopping"), circle_id: M, author: U.anthony, body: "Noted. I'll grab her lemon curd too.", created_at: ts(-2, "19:30") },
    { task_id: tid("Drive Margaret to Outpatient appointment"), circle_id: M, author: U.sarah, body: "I'm going in with her, but can't drive that day. Can anyone take her?", created_at: ts(-1, "09:20") },
  ]);
  await ins("checkins", [
    { circle_id: M, user_id: U.sarah, checked_in_at: ts(-1, "10:32"), checked_out_at: ts(-1, "11:40"), mood: "Good", note: "Mum seems well. Had breakfast and was watching the cricket." },
    { circle_id: M, user_id: U.anthony, checked_in_at: ts(-2, "17:05"), checked_out_at: ts(-2, "17:50"), mood: "OK", note: "A bit tired. Dropped off the shopping." },
    { circle_id: M, user_id: U.helen, checked_in_at: ts(-5, "10:02"), checked_out_at: ts(-5, "12:05"), note: "Kitchen and bathroom done." },
  ]);
  await ins("activity", [
    { circle_id: M, actor: U.helen, verb: "checked in", created_at: ts(-5, "10:02") },
    { circle_id: M, actor: U.lucy, verb: "uploaded", subject: "Home insurance schedule", created_at: ts(-4, "14:00") },
    { circle_id: M, actor: U.david, verb: "accepted", subject: "Sunday phone call", created_at: ts(-3, "20:12") },
    { circle_id: M, actor: U.anthony, verb: "completed", subject: "Pick up library books", created_at: ts(-3, "15:20") },
    { circle_id: M, actor: U.anthony, verb: "checked in", created_at: ts(-2, "17:05") },
    { circle_id: M, actor: U.sarah, verb: "commented on", subject: "Weekly shopping", created_at: ts(-2, "19:04") },
    { circle_id: M, actor: U.sarah, verb: "added an appointment and asked for a driver:", subject: "Outpatient appointment", created_at: ts(-1, "09:15") },
    { circle_id: M, actor: U.sarah, verb: "checked in", created_at: ts(-1, "10:32") },
    { circle_id: M, actor: U.sarah, verb: "checked out after 1 hr 8 min", created_at: ts(-1, "11:40") },
  ], "id");
  await ins("contacts", [
    { circle_id: M, name: "Dr Amina Shah", organisation: "Orchard Lane Surgery", category: "GP", phone: "01632 960101", visibility: "family" },
    { circle_id: M, name: "Dispensary", organisation: "Duston Pharmacy", category: "Pharmacy", phone: "01632 960144", visibility: "family" },
    { circle_id: M, name: "Outpatients", organisation: "Northampton General Hospital", category: "Hospital", phone: "01632 960200", visibility: "family" },
    { circle_id: M, name: "Mary Okafor", organisation: "Next door, no. 16", category: "Neighbour", phone: "07700 900563", visibility: "everyone" },
    { circle_id: M, name: "Helen Price", category: "Cleaner", phone: "07700 900678", notes: "Fridays, 10 till 12", visibility: "family" },
    { circle_id: M, name: "Gary Fielding", organisation: "Fielding Heating", category: "Plumber", phone: "01632 960333", notes: "Services the boiler", visibility: "family" },
  ]);
  await ins("home_assets", [
    { circle_id: M, name: "Boiler", details: "Worcester Greenstar 30i", last_service: D(-370), next_service: D(-5), supplier: "Fielding Heating" },
    { circle_id: M, name: "Home insurance", details: "Buildings and contents", last_service: D(-344), next_service: D(21) },
    { circle_id: M, name: "Smoke alarms", details: "Hall and landing", last_service: D(-60), next_service: D(30) },
    { circle_id: M, name: "Washing machine", details: "Bosch Serie 4", warranty_expiry: D(230) },
  ]);
  const docs = [
    { name: "Home insurance schedule", category: "Insurance", access: "family", expiry_date: D(21), by: U.lucy, lines: ["Example document for the KIN demo.", "Policy: Buildings and contents", "Renewal date shown in KIN."] },
    { name: "Lasting power of attorney (health and welfare)", category: "Legal", access: "admins", expiry_date: null, by: U.sarah, lines: ["Example document for the KIN demo.", "Visible to administrators only."] },
    { name: "Boiler warranty", category: "Warranties", access: "family", expiry_date: D(160), by: U.sarah, lines: ["Example document for the KIN demo."] },
  ];
  for (const d of docs) {
    const path = `${M}/${crypto.randomUUID()}-${d.name.replace(/[^\w]+/g, "-")}.pdf`;
    const up = await admin.storage.from("documents").upload(path, makePdf(d.name, d.lines), { contentType: "application/pdf" });
    if (up.error) throw new Error("storage: " + up.error.message);
    await ins("documents", { circle_id: M, name: d.name, category: d.category, access: d.access, expiry_date: d.expiry_date, storage_path: path, uploaded_by: d.by, notes: "Example document" });
  }
  await ins("audit_log", [
    { circle_id: M, actor: U.sarah, action: "circle.create", created_at: ts(-30, "19:00") },
    { circle_id: M, actor: U.sarah, action: "invitation.create", detail: { role: "helper" }, created_at: ts(-20, "18:00") },
    { circle_id: M, actor: U.lucy, action: "document.upload", detail: { name: "Home insurance schedule" }, created_at: ts(-4, "14:00") },
  ]);

  // Shared costs
  const fam = [U.sarah, U.anthony, U.david];
  await ins("expenses", [
    { circle_id: M, description: "Weekly shopping", category: "Shopping", amount_pence: 6420, paid_by: U.anthony, split_between: fam, spent_on: D(-4), created_by: U.anthony },
    { circle_id: M, description: "Taxi to eye clinic and back", category: "Travel", amount_pence: 2800, paid_by: U.sarah, split_between: fam, spent_on: D(-9), created_by: U.sarah },
    { circle_id: M, description: "New kettle (old one leaking)", category: "Household", amount_pence: 3499, paid_by: U.sarah, split_between: fam, spent_on: D(-12), created_by: U.sarah },
    { circle_id: M, description: "Weekly shopping", category: "Shopping", amount_pence: 5875, paid_by: U.anthony, split_between: fam, spent_on: D(-11), created_by: U.anthony },
    { circle_id: M, description: "Boiler call-out", category: "Bills", amount_pence: 9500, paid_by: U.sarah, split_between: fam, spent_on: D(-20), created_by: U.sarah },
    { circle_id: M, description: "Flowers for Mum's birthday", category: "Gifts", amount_pence: 2500, paid_by: U.david, split_between: fam, spent_on: D(-25), created_by: U.david },
  ]);
  await ins("settlements", { circle_id: M, from_user: U.david, to_user: U.sarah, amount_pence: 4000, paid_on: D(-15), note: "Bank transfer", created_by: U.david });

  // A letter KIN has read, with one suggestion already turned into a task
  const lpath = `${M}/${crypto.randomUUID()}-sample-letter.pdf`;
  await admin.storage.from("documents").upload(lpath, makePdf("Nenebridge District Council", sampleLetterLines("Margaret Hale")), { contentType: "application/pdf" });
  const [ldoc] = await ins("documents", { circle_id: M, name: "Nenebridge District Council: Council tax Single Person Discount review", category: "Property", access: "family", storage_path: lpath, uploaded_by: U.sarah, notes: "Example letter", created_at: ts(-1, "08:40") });
  const result = sampleResult("Margaret");
  const [scan] = await ins("letter_scans", { circle_id: M, document_id: ldoc.id, result, source: "sample", created_by: U.sarah, created_at: ts(-1, "08:41") });
  const [lt] = await ins("tasks", { circle_id: M, title: result.suggestions[0].title, category: "Administration", due_date: result.suggestions[0].due_date, assignee: U.sarah, status: "accepted", private: true, recurrence: "none", priority: "normal",
    description: result.suggestions[0].detail + "\n\nFrom a letter: Nenebridge District Council.", source: `letter:${scan.id}`, created_by: U.sarah });
  result.suggestions[0].task_id = lt.id;
  await admin.from("letter_scans").update({ result }).eq("id", scan.id);
  await ins("activity", { circle_id: M, actor: U.sarah, verb: "read a letter from", subject: "Nenebridge District Council", created_at: ts(-1, "08:41") }, "id");

  // Attendance Allowance playbook, started last week
  const aa = playbook("attendance-allowance")!;
  const startAA = D(-6);
  await ins("tasks", aa.steps.map((st, i) => ({
    circle_id: M, title: st.title, description: st.detail, category: st.category, due_date: addDays(startAA, st.offset),
    assignee: i === 2 ? U.anthony : U.sarah, status: i < 2 ? "done" : "accepted", completed_at: i < 2 ? ts(-5 + i, "20:00") : null, completed_by: i < 2 ? U.sarah : null,
    private: !!st.private, recurrence: "none", priority: "normal", source: "playbook:attendance-allowance", link_url: st.link || aa.link, created_by: U.sarah,
  })));
  await ins("activity", { circle_id: M, actor: U.sarah, verb: 'started the playbook "Claim Attendance Allowance" with 6 tasks', created_at: ts(-6, "19:30") }, "id");

  // ---------------------------------------------------------------- John (second circle for Sarah and Anthony)
  const [{ id: J }] = await ins("care_circles", { person_name: "John Hale", preferred_name: "Dad", created_by: U.sarah });
  await ins("memberships", [
    { circle_id: J, user_id: U.sarah, role: "admin", relationship: "Daughter" },
    { circle_id: J, user_id: U.anthony, role: "family", relationship: "Son" },
  ], "circle_id");
  await ins("person_profiles", { circle_id: J }, "circle_id");
  await ins("visit_info", { circle_id: J, address: "Flat 3, Abbey Court\nTowcester", access_instructions: "Buzz flat 3.", key_contact_user: U.anthony }, "circle_id");
  await ins("emergency_info", { circle_id: J }, "circle_id");
  await ins("tasks", [
    { circle_id: J, title: "Collect new glasses", category: "Shopping", due_date: D(2), status: "open", recurrence: "none", created_by: U.sarah, description: "Ready at the optician on Watling Street." },
    { circle_id: J, title: "Sunday visit", category: "Visit", assignee: U.anthony, due_date: D(4), due_time: "14:00", recurrence: "weekly", status: "accepted", created_by: U.anthony },
  ]);
  await ins("activity", { circle_id: J, actor: U.anthony, verb: "checked in", created_at: ts(-3, "14:05") }, "id");
  await ins("checkins", { circle_id: J, user_id: U.anthony, checked_in_at: ts(-3, "14:05"), checked_out_at: ts(-3, "16:00"), mood: "Good", note: "Watched the rugby together." });

  return M;
}
