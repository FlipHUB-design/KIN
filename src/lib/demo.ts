import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, today, TZ } from "@/lib/kin";
import { makePdf } from "@/lib/pdf";
import { sampleLetterLines, sampleResult, sampleSchoolLines, sampleSchoolResult } from "@/lib/letters";
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
  leah: { name: "Leah Carter", phone: "07700 900811", blurb: "Mum. Answers Dan's swap request, approves costs and reads the school trip letter.", role: "Parent" },
  dan: { name: "Dan Carter", phone: "07700 900812", blurb: "Dad. Has the children tonight. Asked to swap a weekend.", role: "Parent" },
  jean: { name: "Jean Walsh", phone: "07700 900813", blurb: "Grandma. Does Wednesday tea. Sees where the children are, not the money.", role: "Grandparent" },
  kelly: { name: "Kelly Brooks", phone: "07700 900801", blurb: "Childminder. Sees her pick-ups, which home to drop off at, and allergies.", role: "Childminder" },
  ruby: { name: "Ruby Carter", phone: "07700 900814", blurb: "Age 13. Her own simple view: where she's sleeping, what to pack, what's on.", role: "Young person" },
  priya: { name: "Priya Shah", phone: "07700 900803", blurb: "Dan's partner.", role: "Step-parent" },
} as const;
export type Persona = keyof typeof PERSONAS;
export const PICKABLE: Persona[] = ["sarah", "anthony", "lucy", "helen", "margaret"];
export const KIDS_PICKABLE: Persona[] = ["leah", "dan", "jean", "kelly", "ruby"];
export const isKidsPersona = (p: Persona) => (KIDS_PICKABLE as string[]).includes(p) || p === "priya";
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

/** Makes sure demo users exist and the data was built today. Returns both demo circle ids. */
export async function ensureDemo(admin: Admin, force = false): Promise<{ care: string; kids: string }> {
  const ids = await ensureUsers(admin);
  const { data: s } = await admin.auth.admin.getUserById(ids.sarah);
  const meta = (s.user?.user_metadata || {}) as { demo_seeded_on?: string; demo_circle?: string; demo_kids_circle?: string; demo_version?: number };
  if (!force && meta.demo_seeded_on === today() && meta.demo_circle && meta.demo_kids_circle && meta.demo_version === 2) {
    const { data: still } = await admin.from("care_circles").select("id").in("id", [meta.demo_circle, meta.demo_kids_circle]);
    if (still?.length === 2) return { care: meta.demo_circle, kids: meta.demo_kids_circle };
  }
  const care = await seed(admin, ids);
  const kids = await seedKids(admin, ids);
  await admin.auth.admin.updateUserById(ids.sarah, { user_metadata: { ...meta, demo_seeded_on: today(), demo_circle: care, demo_kids_circle: kids, demo_version: 2 } });
  return { care, kids };
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

// ---------------------------------------------------------------- The Carter family (children, two homes)
async function seedKids(admin: Admin, U: Record<Persona, string>) {
  const t = today();
  const D = (n: number) => addDays(t, n);
  const ts = (n: number, time: string) => londonISO(D(n), time);
  const dow = (new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(t, -dow);
  const next = (wd: number) => addDays(t, (wd - dow + 7) % 7); // next Mon..Sun (today counts)
  const ins = async <T = { id: string }>(table: string, rows: object | object[], sel = "id") => {
    const { data, error } = await admin.from(table).insert(rows).select(sel);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data as unknown as T[];
  };
  const split = { [U.leah]: 50, [U.dan]: 50 };

  const [{ id: K }] = await ins("care_circles", {
    person_name: "The Carter family", preferred_name: "the children", kind: "children", created_by: U.leah,
    handover_note: "School pick-up, or 5:30pm at the other home on non-school days",
    packing_list: ["School uniform", "PE kit (Tue and Thu)", "Reading book and record", "Homework folder", "Ruby's phone charger", "Alfie's swimming bag (Tue)", "Water bottles"],
    default_split: split,
  });
  await ins("memberships", [
    { circle_id: K, user_id: U.leah, role: "admin", relationship: "Mum", last_active_at: ts(-1, "20:40") },
    { circle_id: K, user_id: U.dan, role: "admin", relationship: "Dad", last_active_at: ts(-1, "21:15") },
    { circle_id: K, user_id: U.jean, role: "contributor", relationship: "Grandma (Leah's mum)", last_active_at: ts(-2, "16:20") },
    { circle_id: K, user_id: U.priya, role: "contributor", relationship: "Dan's partner", last_active_at: ts(-6, "18:00") },
    { circle_id: K, user_id: U.kelly, role: "helper", relationship: "Childminder", last_active_at: ts(-3, "17:45") },
    { circle_id: K, user_id: U.ruby, role: "supported", relationship: "Ruby (13)", last_active_at: ts(-1, "19:02") },
  ], "circle_id");
  await ins("person_profiles", { circle_id: K }, "circle_id");
  await ins("visit_info", { circle_id: K, key_contact_user: U.leah }, "circle_id");
  await ins("emergency_info", { circle_id: K }, "circle_id");

  const homeRows = await ins<{ id: string; sort: number }>("households", [
    { circle_id: K, name: "Mum's", colour: "plum", address: "22 Willow Way\nKingsthorpe\nNorthampton NN2 0XX", sort: 0 },
    { circle_id: K, name: "Dad's", colour: "blue", address: "Flat 5, Riverside Court\nNorthampton NN1 0XX", sort: 1 },
  ], "id, sort");
  const mum = homeRows.find((h) => h.sort === 0)!, dad = homeRows.find((h) => h.sort === 1)!;
  const y = Number(t.slice(0, 4));
  const kidRows = await ins<{ id: string; first_name: string }>("children", [
    { circle_id: K, first_name: "Ruby", last_name: "Carter", date_of_birth: `${y - 13}-03-09`, colour: "coral", school: "Northfield Academy", year_group: "Year 9", class_name: "Form 9R", teacher: "Mr Hughes (form tutor)",
      allergies: null, important_notes: "Walks home with friends on Mondays (agreed by both parents).", clothes_size: "Women's 8", shoe_size: "5", gp: "Kingsthorpe Medical Centre", dentist: "Smile Dental, Kingsthorpe",
      passport_expiry: D(150), user_id: U.ruby, sort: 0 },
    { circle_id: K, first_name: "Alfie", last_name: "Carter", date_of_birth: `${y - 8}-06-21`, colour: "amber", school: "Orchard Primary School", year_group: "Year 4", class_name: "Oak class", teacher: "Mrs Okafor",
      allergies: "Peanuts and tree nuts. His auto-injector is in his school bag.", important_notes: "Only collected by people on the authorised list in Contacts.", clothes_size: "Age 8-9", shoe_size: "1", gp: "Kingsthorpe Medical Centre", dentist: "Smile Dental, Kingsthorpe",
      passport_expiry: D(900), sort: 1 },
  ], "id, first_name");
  const ruby = kidRows.find((k) => k.first_name === "Ruby")!, alfie = kidRows.find((k) => k.first_name === "Alfie")!;
  const both = [ruby.id, alfie.id];

  // 2-2-5-5 starting this Monday: Mon-Tue Mum's, Wed-Thu Dad's, weekends alternate
  const A = mum.id, B = dad.id;
  await ins("schedule_patterns", { circle_id: K, anchor: monday, days: [A, A, B, B, A, A, A, A, A, B, B, B, B, B], label: "2-2-5-5", updated_by: U.leah }, "circle_id");
  const chg = (o: Record<string, unknown>) => ({ circle_id: K, ...o });
  await ins("schedule_changes", [
    chg({ start_date: addDays(monday, 11), end_date: addDays(monday, 13), household_id: A, reason: "I'm at a work conference in Manchester that weekend, back Sunday night.", in_return: "I'll have them the weekend after instead (Fri to Sun).", status: "requested", requested_by: U.dan, requested_at: ts(-1, "21:10") }),
    chg({ start_date: addDays(monday, 9), end_date: addDays(monday, 9), household_id: A, reason: "Ruby's drama show finishes late. Can they stay at mine that night so I can take her?", status: "accepted", requested_by: U.leah, requested_at: ts(-4, "19:00"), responded_by: U.dan, responded_at: ts(-4, "20:30"), response_note: "Of course. I'll come to the show." }),
    chg({ start_date: D(-10), end_date: D(-10), household_id: A, reason: "Gran's 70th birthday lunch.", status: "accepted", requested_by: U.leah, requested_at: ts(-18, "18:00"), responded_by: U.dan, responded_at: ts(-18, "19:12"), response_note: "No problem." }),
    chg({ start_date: D(-20), end_date: D(-20), household_id: B, reason: "Extra night so I can take Alfie to the match.", status: "declined", requested_by: U.dan, requested_at: ts(-24, "17:30"), responded_by: U.leah, responded_at: ts(-24, "18:05"), response_note: "Alfie has the dentist that morning. Could we do the week after?" }),
  ]);

  const apptRows = await ins<{ id: string; title: string }>("appointments", [
    { circle_id: K, title: "Football tournament", date: D(2), time: "09:00", location: "Kingsthorpe Rec", attending: "Alfie", needs_transport: true, child_ids: [alfie.id], notes: "Bring boots and shin pads. Finishes around 1pm.", created_by: U.dan },
    { circle_id: K, title: "Parents' evening", date: D(6), time: "17:30", location: "Orchard Primary School", attending: "Mum and Dad", child_ids: [alfie.id], notes: "Booked a joint 10-minute slot with Mrs Okafor.", created_by: U.leah },
    { circle_id: K, title: "Dentist check-ups", date: D(8), time: "16:10", location: "Smile Dental, Kingsthorpe", attending: "Ruby and Alfie", needs_transport: false, child_ids: both, created_by: U.leah },
    { circle_id: K, title: "INSET day (no school)", date: D(15), child_ids: both, share_with_helpers: true, notes: "Kelly has Alfie 8am to 5pm.", created_by: U.leah },
    { circle_id: K, title: "Drama club show", date: addDays(monday, 9), time: "18:30", location: "Northfield Academy hall", attending: "Ruby, Mum and Dad", child_ids: [ruby.id], created_by: U.leah },
    { circle_id: K, title: "Year 9 options evening", date: D(20), time: "18:00", location: "Northfield Academy", attending: "Ruby, Mum and Dad", child_ids: [ruby.id], created_by: U.dan },
    { circle_id: K, title: "October half term", date: D(25), end_date: D(29), child_ids: both, share_with_helpers: true, notes: "Usual pattern applies. Holiday club booked for Alfie on the Tuesday.", created_by: U.leah },
    { circle_id: K, title: "Oscar's birthday party", date: D(2), time: "14:00", location: "Jump Zone, Northampton", child_ids: [alfie.id], notes: "Pick up at 4pm.", created_by: U.leah },
    { circle_id: K, title: "Mediation session (parents only)", date: D(12), time: "10:00", location: "Nene Family Mediation", attending: "Leah and Dan", private: true, notes: "Agenda: Christmas arrangements.", created_by: U.leah },
  ], "id, title");
  const football = apptRows.find((a) => a.title === "Football tournament")!;

  const task = (o: Record<string, unknown>) => ({ circle_id: K, created_by: U.leah, recurrence: "none", priority: "normal", private: false, status: o.assignee ? "accepted" : "open", child_ids: [], ...o });
  const tasks = await ins<{ id: string; title: string }>("tasks", [
    task({ title: "Take Alfie to Football tournament", category: "Pick-up or drop-off", due_date: D(2), due_time: "08:30", priority: "high", appointment_id: football.id, child_ids: [alfie.id], description: "Football tournament, 09:00, Kingsthorpe Rec", created_by: U.dan }),
    task({ title: "RSVP to Oscar's party", category: "Birthday or party", due_date: D(1), child_ids: [alfie.id], description: "Text Hannah (Oscar's mum). Number in Contacts." }),
    task({ title: "Buy a present for Oscar (about £10)", category: "Birthday or party", due_date: D(1), child_ids: [alfie.id] }),
    task({ title: "Collect Alfie from school", category: "Pick-up or drop-off", assignee: U.kelly, due_date: next(0), due_time: "15:15", recurrence: "weekly", child_ids: [alfie.id], description: "Drop at Mum's by 5:30pm." }),
    task({ title: "Collect Alfie from school (Tuesday)", category: "Pick-up or drop-off", assignee: U.kelly, due_date: next(1), due_time: "15:15", recurrence: "weekly", child_ids: [alfie.id], description: "Straight to swimming at 4:30pm. Mum collects from the pool." }),
    task({ title: "Swimming lesson", category: "Club or activity", assignee: U.leah, due_date: next(1), due_time: "16:30", recurrence: "weekly", child_ids: [alfie.id], description: "Mounts Baths. Stage 5." }),
    task({ title: "Tea at Grandma's after school", category: "Childcare", assignee: U.jean, due_date: next(2), due_time: "15:15", recurrence: "weekly", child_ids: [alfie.id], description: "Jean collects Alfie and drops him at Dad's by 6pm." }),
    task({ title: "Football training", category: "Club or activity", assignee: U.dan, due_date: next(3), due_time: "17:30", recurrence: "weekly", child_ids: [alfie.id], created_by: U.dan }),
    task({ title: "Pick Ruby up from drama club", category: "Pick-up or drop-off", assignee: U.dan, due_date: next(2), due_time: "17:30", recurrence: "weekly", child_ids: [ruby.id], created_by: U.dan }),
    task({ title: "Return library books", category: "School", assignee: U.ruby, due_date: D(1), child_ids: [ruby.id] }),
    task({ title: "Read the Year 9 options booklet", category: "School", assignee: U.ruby, due_date: D(18), child_ids: [ruby.id], description: "Bring questions to options evening." }),
    task({ title: "Update school contact details for both homes", category: "Administration", assignee: U.dan, due_date: D(-3), child_ids: both, created_by: U.dan, description: "Ask both schools to send letters to both parents." }),
    task({ title: "Agree Christmas arrangements", category: "Administration", assignee: U.leah, due_date: D(12), private: true, child_ids: both, description: "Dan's proposal is in Agreements. Discuss at mediation." }),
    task({ title: "Buy Alfie new school shoes", category: "Shopping", assignee: U.leah, due_date: D(-6), status: "done", completed_at: ts(-6, "12:30"), completed_by: U.leah, child_ids: [alfie.id] }),
  ], "id, title");
  void tasks;

  // Letter Leah read yesterday: two suggestions already tasks, two waiting
  const lpath = `${K}/${crypto.randomUUID()}-school-letter.pdf`;
  await admin.storage.from("documents").upload(lpath, makePdf("Orchard Primary School", sampleSchoolLines("Alfie")), { contentType: "application/pdf" });
  const [ldoc] = await ins("documents", { circle_id: K, name: "Orchard Primary School: Year 4 trip letter", category: "Other", access: "family", storage_path: lpath, uploaded_by: U.leah, notes: "Example letter", created_at: ts(-1, "18:20") });
  const result = sampleSchoolResult("Alfie");
  const [scan] = await ins("letter_scans", { circle_id: K, document_id: ldoc.id, result, source: "sample", created_by: U.leah, created_at: ts(-1, "18:21") });
  const letterTasks = await ins<{ id: string; title: string }>("tasks", [
    task({ title: result.suggestions[0].title, category: "School", due_date: result.suggestions[0].due_date, assignee: U.dan, child_ids: [alfie.id], source: `letter:${scan.id}`, description: result.suggestions[0].detail + "\n\nFrom a letter: Orchard Primary School. Alfie's at Dad's tonight, so Dan's signing it." }),
    task({ title: result.suggestions[1].title, category: "School", due_date: result.suggestions[1].due_date, assignee: U.leah, child_ids: [alfie.id], source: `letter:${scan.id}`, description: result.suggestions[1].detail }),
  ], "id, title");
  result.suggestions[0].task_id = letterTasks.find((x) => x.title === result.suggestions[0].title)!.id;
  result.suggestions[1].task_id = letterTasks.find((x) => x.title === result.suggestions[1].title)!.id;
  await admin.from("letter_scans").update({ result }).eq("id", scan.id);

  // Ruby's passport playbook, started this week
  const pp = playbook("child-passport")!;
  const startPP = D(-4);
  await ins("tasks", pp.steps.map((st, i) => task({
    title: st.title, description: st.detail, category: st.category, due_date: addDays(startPP, st.offset) < t && i > 1 ? t : addDays(startPP, st.offset),
    assignee: U.leah, status: i < 2 ? "done" : "accepted", completed_at: i < 2 ? ts(-3 + i, "20:00") : null, completed_by: i < 2 ? U.leah : null,
    private: !!st.private, child_ids: [ruby.id], source: "playbook:child-passport", link_url: st.link || pp.link,
  })));

  // Handovers
  await ins("handovers", [
    { circle_id: K, handed_at: londonISO(monday, "15:20"), from_household: B, to_household: A, recorded_by: U.dan, items_packed: ["School uniform", "PE kit (Tue and Thu)", "Reading book and record", "Homework folder", "Ruby's phone charger", "Alfie's swimming bag (Tue)", "Water bottles"], items_missing: [], note: "Good weekend. Alfie scored at football." },
    { circle_id: K, handed_at: ts(-1, "15:25"), from_household: A, to_household: B, recorded_by: U.leah, items_packed: ["School uniform", "PE kit (Tue and Thu)", "Reading book and record", "Homework folder", "Ruby's phone charger", "Water bottles"], items_missing: ["Alfie's swimming bag (Tue)"], note: "Alfie has a spelling test on Friday. Ruby needs £3 for non-uniform day." },
  ]);

  // Agreements
  const ag = (o: Record<string, unknown>) => ({ circle_id: K, share: false, ...o });
  await ins("agreements", [
    ag({ title: "Bedtime on school nights: 8pm for Alfie, 9:30pm for Ruby", category: "Routines and bedtimes", share: true, status: "agreed", proposed_by: U.leah, proposed_at: ts(-60, "20:00"), decided_by: U.dan, decided_at: ts(-60, "21:00") }),
    ag({ title: "Phones out of bedrooms at 9pm on school nights", detail: "Both homes. Ruby charges hers in the kitchen.", category: "Screens and phones", share: true, status: "agreed", proposed_by: U.dan, proposed_at: ts(-45, "19:00"), decided_by: U.leah, decided_at: ts(-45, "19:40") }),
    ag({ title: "Ruby can walk home from school with friends on Mondays", category: "Routines and bedtimes", share: true, status: "agreed", proposed_by: U.leah, proposed_at: ts(-30, "18:00"), decided_by: U.dan, decided_at: ts(-29, "08:15") }),
    ag({ title: "Shared costs are split 50/50", detail: "Counts as shared: school costs and uniform, clubs and lessons, school trips, childcare, health and dental.\nNot shared: everyday clothes, toys and food, which each home buys for itself.", category: "Money", status: "agreed", proposed_by: U.dan, proposed_at: ts(-90, "20:00"), decided_by: U.leah, decided_at: ts(-89, "09:00") }),
    ag({ title: "Summer holidays: two weeks each, dates agreed by 31 March", category: "Holidays and special days", status: "agreed", proposed_by: U.leah, proposed_at: ts(-80, "20:00"), decided_by: U.dan, decided_at: ts(-79, "12:00") }),
    ag({ title: "Christmas: Christmas Eve and Christmas morning at Mum's, then Dad's from 2pm Christmas Day to 29 December", detail: "Swap next year.", category: "Holidays and special days", status: "proposed", proposed_by: U.dan, proposed_at: ts(-2, "20:45") }),
    ag({ title: "Alfie starts Saturday drama club", category: "Routines and bedtimes", status: "declined", proposed_by: U.leah, proposed_at: ts(-15, "18:00"), decided_by: U.dan, decided_at: ts(-14, "19:30"), note: "Clashes with football. Can we look again in January?" }),
  ]);

  // Where is it?
  await ins("child_items", [
    { circle_id: K, child_id: null, name: "Passports", household_id: A, location_note: "Filing box in the study", updated_by: U.leah, updated_at: ts(-4, "20:00") },
    { circle_id: K, child_id: alfie.id, name: "Red book", household_id: A, location_note: "Same filing box", updated_by: U.leah, updated_at: ts(-40, "20:00") },
    { circle_id: K, child_id: ruby.id, name: "School blazer", household_id: B, location_note: "Back of her bedroom door", updated_by: U.dan, updated_at: ts(-1, "19:00") },
    { circle_id: K, child_id: alfie.id, name: "Football boots and shin pads", household_id: B, updated_by: U.dan, updated_at: ts(-1, "19:05") },
    { circle_id: K, child_id: alfie.id, name: "Swimming bag", household_id: B, location_note: "Left in Dad's car", updated_by: U.dan, updated_at: ts(-1, "19:10") },
    { circle_id: K, child_id: ruby.id, name: "Tablet charger", household_id: A, updated_by: U.leah, updated_at: ts(-2, "21:00") },
  ]);

  // Money
  const ex = (o: Record<string, unknown>) => ({ circle_id: K, split_between: [U.leah, U.dan], shares: split, status: "approved", ...o });
  await ins("expenses", [
    ex({ description: "Swimming lessons (autumn term)", category: "Clubs and activities", amount_pence: 9600, paid_by: U.dan, created_by: U.dan, spent_on: D(-24), child_ids: [alfie.id], responded_by: U.leah, responded_at: ts(-24, "20:00") }),
    ex({ description: "Football club subs (autumn)", category: "Clubs and activities", amount_pence: 4500, paid_by: U.dan, created_by: U.dan, spent_on: D(-20), child_ids: [alfie.id], responded_by: U.leah, responded_at: ts(-20, "18:30") }),
    ex({ description: "Year 9 maths revision guide", category: "School", amount_pence: 799, paid_by: U.leah, created_by: U.leah, spent_on: D(-9), child_ids: [ruby.id], responded_by: U.dan, responded_at: ts(-9, "21:00") }),
    ex({ description: "School shoes", category: "Uniform and clothes", amount_pence: 4200, paid_by: U.leah, created_by: U.leah, spent_on: D(-6), child_ids: [alfie.id], responded_by: U.dan, responded_at: ts(-6, "19:20"), response_note: "Thanks for sorting." }),
    ex({ description: "Hoodie", category: "Uniform and clothes", amount_pence: 2000, paid_by: U.leah, created_by: U.leah, spent_on: D(-5), child_ids: [ruby.id], status: "disputed", responded_by: U.dan, responded_at: ts(-5, "20:10"), response_note: "We agreed everyday clothes are each home's own. See Agreements." }),
    ex({ description: "School blazer", category: "Uniform and clothes", amount_pence: 3250, paid_by: U.dan, created_by: U.dan, spent_on: D(-2), child_ids: [ruby.id], status: "pending" }),
    ex({ description: "Year 4 farm trip", category: "School", amount_pence: 1450, paid_by: U.leah, created_by: U.leah, spent_on: D(0), child_ids: [alfie.id], status: "pending" }),
  ]);
  await ins("settlements", [
    { circle_id: K, from_user: U.leah, to_user: U.dan, amount_pence: 3000, paid_on: D(-12), note: "Bank transfer", created_by: U.leah, kind: "settle" },
    ...[0, 1, 2].map((m) => ({ circle_id: K, from_user: U.dan, to_user: U.leah, amount_pence: 32000, paid_on: D(-m * 30 - 1), note: "Standing order (family-based arrangement)", created_by: U.dan, kind: "maintenance" })),
  ]);

  // Contacts
  const ct = (o: Record<string, unknown>) => ({ circle_id: K, visibility: "everyone", ...o });
  await ins("contacts", [
    ct({ name: "School office", organisation: "Orchard Primary School", category: "School", phone: "01632 960410", notes: "Alfie, Oak class" }),
    ct({ name: "Reception", organisation: "Northfield Academy", category: "School", phone: "01632 960420", notes: "Ruby, Form 9R" }),
    ct({ name: "Jean Walsh", organisation: "Grandma", category: "Authorised to collect", phone: "07700 900813" }),
    ct({ name: "Priya Shah", organisation: "Dan's partner", category: "Authorised to collect", phone: "07700 900803" }),
    ct({ name: "Kelly Brooks", organisation: "Registered childminder", category: "Childminder", phone: "07700 900801", notes: "Mondays and Tuesdays after school" }),
    ct({ name: "Coach Mike", organisation: "Kingsthorpe Juniors FC", category: "Club or coach", phone: "07700 900804" }),
    ct({ name: "Kingsthorpe Medical Centre", category: "GP", phone: "01632 960430", visibility: "family" }),
    ct({ name: "Smile Dental", organisation: "Kingsthorpe", category: "Dentist", phone: "01632 960440", visibility: "family" }),
    ct({ name: "Hannah (Oscar's mum)", category: "Friend's parent", phone: "07700 900805", visibility: "family" }),
    ct({ name: "Nene Family Mediation", category: "Mediator", phone: "01632 960450", visibility: "family" }),
  ]);

  const docs = [
    { name: "Alfie's birth certificate (copy)", category: "Legal", access: "admins", lines: ["Example document for the KIN demo."] },
    { name: "Ruby's Year 8 school report", category: "Other", access: "family", lines: ["Example document for the KIN demo.", "Northfield Academy, summer term."] },
    { name: "Swimming lessons receipt (autumn term)", category: "Financial", access: "family", lines: ["Example document for the KIN demo.", "Mounts Baths, Stage 5, GBP 96.00"] },
  ];
  for (const d of docs) {
    const path = `${K}/${crypto.randomUUID()}-${d.name.replace(/[^\w]+/g, "-")}.pdf`;
    await admin.storage.from("documents").upload(path, makePdf(d.name, d.lines), { contentType: "application/pdf" });
    await ins("documents", { circle_id: K, name: d.name, category: d.category, access: d.access, storage_path: path, uploaded_by: U.leah, notes: "Example document" });
  }

  await ins("checkins", [
    { circle_id: K, user_id: U.kelly, checked_in_at: londonISO(monday, "15:15"), checked_out_at: londonISO(monday, "17:25"), note: "Collected Alfie. Homework done, dropped at Mum's." },
  ]);
  await ins("activity", [
    { circle_id: K, actor: U.kelly, verb: "checked in", subject: null, created_at: londonISO(monday, "15:15") },
    { circle_id: K, actor: U.dan, verb: "recorded a handover", created_at: londonISO(monday, "15:20") },
    { circle_id: K, actor: U.leah, verb: 'started the playbook "Get or renew a child\'s passport" with 5 tasks', created_at: ts(-4, "20:05") },
    { circle_id: K, actor: U.dan, verb: "agreed a schedule change for", subject: "Ruby's drama show night", created_at: ts(-4, "20:30") },
    { circle_id: K, actor: U.dan, verb: "queried a shared cost:", subject: "Hoodie", created_at: ts(-5, "20:10") },
    { circle_id: K, actor: U.dan, verb: "asked the other parent to approve a cost:", subject: "School blazer", created_at: ts(-2, "18:00") },
    { circle_id: K, actor: U.dan, verb: "proposed an agreement:", subject: "Christmas arrangements", created_at: ts(-2, "20:45") },
    { circle_id: K, actor: U.leah, verb: "recorded a handover (missing: Alfie's swimming bag (Tue))", created_at: ts(-1, "15:25") },
    { circle_id: K, actor: U.leah, verb: "read a letter from", subject: "Orchard Primary School", created_at: ts(-1, "18:21") },
    { circle_id: K, actor: U.ruby, verb: "asked:", subject: "Can I go to Maya's on Saturday afternoon?", created_at: ts(-1, "19:02") },
    { circle_id: K, actor: U.dan, verb: "asked for a schedule change", created_at: ts(-1, "21:10") },
    { circle_id: K, actor: U.leah, verb: "asked the other parent to approve a cost:", subject: "Year 4 farm trip", created_at: ts(0, "07:45") },
  ], "id");
  await ins("audit_log", [
    { circle_id: K, actor: U.leah, action: "circle.create", created_at: ts(-120, "20:00") },
    { circle_id: K, actor: U.leah, action: "schedule.pattern", detail: { label: "2-2-5-5" }, created_at: ts(-100, "20:00") },
    { circle_id: K, actor: U.leah, action: "invitation.create", detail: { role: "helper" }, created_at: ts(-90, "18:00") },
  ]);
  return K;
}
