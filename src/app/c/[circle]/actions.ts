"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCircle } from "@/lib/data";
import { letterReadingOn, readLetter, sampleLetterLines, sampleResult, sampleSchoolLines, sampleSchoolResult, SAMPLE_LETTER_NAME, SAMPLE_SCHOOL_LETTER_NAME, type LetterResult } from "@/lib/letters";
import { makePdf } from "@/lib/pdf";
import { playbook } from "@/lib/playbooks";
import { addDays, today } from "@/lib/kin";
import { after } from "next/server";
import { takeAllowance } from "@/lib/ai";
import { isDemoEmail, notify, sendInviteEmail, site, type Level } from "@/lib/notify";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => s(f, k) || null;
const back: (c: string, path?: string, msg?: string) => never = (c, path = "", msg) =>
  redirect(`/c/${c}${path}${msg ? (path.includes("?") ? "&" : "?") + "notice=" + encodeURIComponent(msg) : ""}`);
const fail: (c: string, path: string, msg: string) => never = (c, path, msg) =>
  redirect(`/c/${c}${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}`);

const ids = (f: FormData, k: string) => f.getAll(k).map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));

async function ctx(f: FormData) {
  const circleId = s(f, "circle");
  const c = await getCircle(circleId);
  return { ...c, circleId };
}
async function activity(c: Awaited<ReturnType<typeof ctx>>, verb: string, subject: string | null = null) {
  await c.supabase.rpc("record_activity", { p_circle: c.circleId, p_verb: verb, p_subject: subject });
}

// ---------------------------------------------------------------- alerts
type C = Awaited<ReturnType<typeof ctx>>;
const myName = (c: C) => (c.me.profiles?.display_name || "Someone").split(" ")[0];
const parents = (c: C) => c.members.filter((m) => m.status === "active" && (m.role === "admin" || m.role === "family")).map((m) => m.user_id);
const circleName = (c: C) => (c.circle.kind === "children" ? c.circle.person_name : `${c.circle.preferred_name}'s Care Circle`);
const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const range = (a: string, b: string) => (a === b ? day(a) : `${day(a)} to ${day(b)}`);
const money = (p: number) => "£" + (p / 100).toFixed(2);
/** Sends the alert after the page has responded, so nobody waits for email or text. */
function alert(c: C, level: Level, to: (string | null | undefined)[], title: string, body: string | null, path: string) {
  after(() => notify({ circleId: c.circleId, circleName: circleName(c), actor: c.user.id, to, level, title, body, path }));
}

// ---------------------------------------------------------------- tasks
export async function createTask(f: FormData) {
  const c = await ctx(f);
  const assignee = n(f, "assignee");
  const row = {
    circle_id: c.circleId,
    title: s(f, "title"),
    description: n(f, "description"),
    category: s(f, "category") || "Other",
    assignee,
    due_date: n(f, "due_date"),
    due_time: n(f, "due_time"),
    recurrence: s(f, "recurrence") || "none",
    priority: s(f, "priority") || "normal",
    status: assignee ? "accepted" : "open",
    private: f.get("private") === "on",
    created_by: c.user.id,
    child_ids: ids(f, "child"),
  };
  if (!row.title) fail(c.circleId, "/tasks/new", "Give the task a title.");
  const { error } = await c.supabase.from("tasks").insert(row);
  if (error) fail(c.circleId, "/tasks/new", "You can't add that task. Contributors can only add shared tasks for themselves or anyone.");
  await activity(c, assignee && assignee !== c.user.id ? `created a task for ${c.nameOf(assignee)}:` : "created", row.title);
  if (assignee && assignee !== c.user.id) alert(c, "update", [assignee], `${myName(c)} asked you to: ${row.title}`,
    row.due_date ? `Due ${day(row.due_date)}${row.due_time ? " at " + row.due_time.slice(0, 5) : ""}.` : null, "/tasks");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/tasks", assignee ? "Task added" : "Task added. The family can see it needs someone.");
}

export async function updateTask(f: FormData) {
  const c = await ctx(f);
  const id = s(f, "id");
  const { data: prev } = await c.supabase.from("tasks").select("assignee").eq("id", id).maybeSingle();
  const { error } = await c.supabase.from("tasks").update({
    title: s(f, "title"), description: n(f, "description"), category: s(f, "category"),
    due_date: n(f, "due_date"), due_time: n(f, "due_time"), recurrence: s(f, "recurrence"),
    private: f.get("private") === "on", assignee: n(f, "assignee"),
    status: n(f, "assignee") ? "accepted" : "open", child_ids: ids(f, "child"),
  }).eq("id", id);
  if (error) fail(c.circleId, `/tasks/${id}`, "Only family members can edit tasks.");
  await activity(c, "edited", s(f, "title"));
  const newAssignee = n(f, "assignee");
  if (newAssignee && newAssignee !== prev?.assignee && newAssignee !== c.user.id)
    alert(c, "update", [newAssignee], `${myName(c)} asked you to: ${s(f, "title")}`, n(f, "due_date") ? `Due ${day(s(f, "due_date"))}.` : null, `/tasks/${id}`);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, `/tasks/${id}`, "Saved");
}

async function taskRpc(f: FormData, fn: string, msg: string) {
  const c = await ctx(f);
  const id = s(f, "id");
  const { error } = await c.supabase.rpc(fn, { p_task: id });
  if (error) fail(c.circleId, `/tasks/${id}`, error.message);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, s(f, "return") || `/tasks/${id}`, msg);
}
export async function claimTask(f: FormData) { return taskRpc(f, "claim_task", "You're responsible. The family can see it."); }
export async function declineTask(f: FormData) { return taskRpc(f, "decline_task", "Handed back to the family"); }
export async function completeTask(f: FormData) { return taskRpc(f, "complete_task", "Marked done"); }

export async function cancelTask(f: FormData) {
  const c = await ctx(f);
  const id = s(f, "id");
  const { data: t } = await c.supabase.from("tasks").update({ status: "cancelled" }).eq("id", id).select("title").single();
  if (t) await activity(c, "cancelled", t.title);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/tasks", "Task cancelled");
}

export async function addComment(f: FormData) {
  const c = await ctx(f);
  const id = s(f, "id");
  const body = s(f, "body");
  if (!body) back(c.circleId, `/tasks/${id}`);
  const { data: t } = await c.supabase.from("tasks").select("title, assignee, created_by").eq("id", id).single();
  const { error } = await c.supabase.from("task_comments").insert({ task_id: id, circle_id: c.circleId, author: c.user.id, body });
  if (error) fail(c.circleId, `/tasks/${id}`, "You can't comment on this task.");
  await activity(c, "commented on", t?.title || "a task");
  if (t) alert(c, "update", [t.assignee, t.created_by], `${myName(c)} commented on "${t.title}"`, body.slice(0, 200), `/tasks/${id}#comments`);
  revalidatePath(`/c/${c.circleId}/tasks/${id}`);
  back(c.circleId, `/tasks/${id}#comments`);
}

// ---------------------------------------------------------------- appointments
export async function createAppointment(f: FormData) {
  const c = await ctx(f);
  const kids = c.circle.kind === "children";
  const transport = f.get("needs_transport") === "yes";
  const childIds = ids(f, "child");
  const { data: a, error } = await c.supabase.from("appointments").insert({
    circle_id: c.circleId, title: s(f, "title"), date: s(f, "date"), time: n(f, "time"),
    location: n(f, "location"), attending: n(f, "attending"), needs_transport: transport,
    notes: n(f, "notes"), created_by: c.user.id, child_ids: childIds,
    end_date: n(f, "end_date") && s(f, "end_date") > s(f, "date") ? s(f, "end_date") : null,
    private: f.get("private") === "on", share_with_helpers: f.get("share_with_helpers") === "on",
  }).select().single();
  if (error || !a) fail(c.circleId, "/appointments/new", "Only family members can add appointments.");
  let who = c.circle.preferred_name;
  if (kids) {
    const { data: ks } = await c.supabase.from("children").select("id, first_name").in("id", childIds.length ? childIds : ["00000000-0000-0000-0000-000000000000"]);
    const names = (ks || []).map((k) => k.first_name);
    who = names.length ? (names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]) : "the children";
  }
  if (transport) {
    let t: string | null = null;
    if (a.time) {
      const [h, m] = a.time.split(":").map(Number);
      const mins = Math.max(0, h * 60 + m - (kids ? 30 : 45));
      t = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    }
    await c.supabase.from("tasks").insert({
      circle_id: c.circleId, title: kids ? `Take ${who} to ${a.title}` : `Drive ${who} to ${a.title}`, category: kids ? "Pick-up or drop-off" : "Transport",
      description: [a.title, a.time?.slice(0, 5), a.location].filter(Boolean).join(", "), child_ids: childIds,
      due_date: a.date, due_time: t, priority: "high", status: "open", appointment_id: a.id, created_by: c.user.id, private: a.private,
    });
  }
  await activity(c, transport ? (kids ? "added an event and asked who can take them:" : "added an appointment and asked for a driver:") : (kids ? "added an event:" : "added an appointment:"), a.title);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, `/appointments/${a.id}`, transport ? (kids ? `Added. The family has been asked who can take ${who}.` : `Added. The family has been asked who can drive ${who}.`) : (kids ? "Event added" : "Appointment added"));
}

export async function deleteAppointment(f: FormData) {
  const c = await ctx(f);
  const { data: a } = await c.supabase.from("appointments").delete().eq("id", s(f, "id")).select("title").single();
  if (a) await activity(c, "removed an appointment:", a.title);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/calendar", "Appointment removed");
}

// ---------------------------------------------------------------- check-ins
export async function checkIn(f: FormData) {
  const c = await ctx(f);
  const mood = n(f, "mood");
  const { error } = await c.supabase.from("checkins").insert({ circle_id: c.circleId, user_id: c.user.id, mood, note: n(f, "note") });
  if (error) fail(c.circleId, "/checkin", "Couldn't record your check-in. Please try again.");
  await activity(c, mood === "Needs attention" ? "checked in and flagged that something needs attention" : "checked in", null);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "", "Checked in. The family can see it.");
}

export async function checkOut(f: FormData) {
  const c = await ctx(f);
  const { data: open } = await c.supabase.from("checkins").select("*").eq("circle_id", c.circleId).eq("user_id", c.user.id)
    .is("checked_out_at", null).order("checked_in_at", { ascending: false }).limit(1).maybeSingle();
  if (open) {
    const now = new Date();
    await c.supabase.from("checkins").update({ checked_out_at: now.toISOString() }).eq("id", open.id);
    const mins = Math.max(1, Math.round((now.getTime() - new Date(open.checked_in_at).getTime()) / 60000));
    await activity(c, `checked out after ${mins >= 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`}`);
  }
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "", "Checked out");
}

export async function dismissMissed(f: FormData) {
  const c = await ctx(f);
  await c.supabase.rpc("dismiss_missed_checkin", { p_circle: c.circleId });
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId);
}

export async function askFamily(f: FormData) {
  const c = await ctx(f);
  await activity(c, `asked the family to check on ${c.circle.preferred_name}`);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "", "Added to the family's activity");
}

// Supported person's own actions
export async function wellbeing(f: FormData) {
  const c = await ctx(f);
  await activity(c, `said they're feeling ${s(f, "mood").toLowerCase()} today`, n(f, "note"));
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "", "Thank you. Your family can see this.");
}
export async function needHelp(f: FormData) {
  const c = await ctx(f);
  await activity(c, 'pressed "I need help"');
  alert(c, "urgent", parents(c), `${myName(c)} pressed "I need help" in KIN`,
    `Please call or go to ${myName(c)} now. KIN does not contact emergency services. In an emergency, call 999.`, "");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/help");
}

// ---------------------------------------------------------------- circle & people
export async function invite(f: FormData) {
  const c = await ctx(f);
  const { data, error } = await c.supabase.from("invitations").insert({
    circle_id: c.circleId, name: s(f, "name"), email: n(f, "email"), role: s(f, "role"),
    relationship: s(f, "relationship"), invited_by: c.user.id,
  }).select("id, token").single();
  if (error || !data) fail(c.circleId, "/people/invite", "Only administrators can invite people.");
  const to = n(f, "email");
  let emailed = false;
  if (to && !isDemoEmail(c.user.email)) {
    const url = `${site()}/invite/${data.token}`;
    const what = c.circle.kind === "children" ? "organise things for the children" : `coordinate things for ${c.circle.preferred_name}`;
    emailed = await sendInviteEmail(to, myName(c), what, url);
  }
  back(c.circleId, `/people/invite?sent=${data.id}${emailed ? "&emailed=1" : ""}`);
}

export async function revokeInvite(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("invitations").update({ revoked: true }).eq("id", s(f, "id"));
  back(c.circleId, "/people", "Invitation cancelled");
}

export async function changeMember(f: FormData) {
  const c = await ctx(f);
  const uid = s(f, "user");
  const op = s(f, "op");
  const who = c.nameOf(uid);
  let error;
  if (op === "role") {
    ({ error } = await c.supabase.from("memberships").update({ role: s(f, "role") }).eq("circle_id", c.circleId).eq("user_id", uid));
    if (!error) await activity(c, `changed ${who}'s access to`, s(f, "role"));
  } else if (op === "pause" || op === "restore") {
    ({ error } = await c.supabase.from("memberships").update({ status: op === "pause" ? "paused" : "active" }).eq("circle_id", c.circleId).eq("user_id", uid));
    if (!error) await activity(c, `${op === "pause" ? "paused" : "restored"} access for`, who);
  } else if (op === "remove") {
    ({ error } = await c.supabase.from("memberships").delete().eq("circle_id", c.circleId).eq("user_id", uid));
    if (!error) await activity(c, "removed from the circle:", who);
  }
  if (error) fail(c.circleId, "/people", "Only administrators can change access.");
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: `member.${op}`, detail: { user: uid, role: s(f, "role") || null } });
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/people", "Access updated");
}

export async function saveSettings(f: FormData) {
  const c = await ctx(f);
  const r1 = await c.supabase.from("care_circles").update({
    person_name: s(f, "person_name"), preferred_name: s(f, "preferred_name"),
    checkin_by: n(f, "checkin_by"), checkin_note: n(f, "checkin_note"),
  }).eq("id", c.circleId);
  const r2 = await c.supabase.from("person_profiles").update({
    date_of_birth: n(f, "date_of_birth"), phone: n(f, "phone"), email: n(f, "email"),
    preferred_contact: n(f, "preferred_contact"), important_notes: n(f, "important_notes"),
    accessibility_notes: n(f, "accessibility_notes"), updated_at: new Date().toISOString(),
  }).eq("circle_id", c.circleId);
  const r3 = await c.supabase.from("visit_info").update({
    address: n(f, "address"), access_instructions: n(f, "access_instructions"), key_contact_user: n(f, "key_contact_user"),
    updated_at: new Date().toISOString(),
  }).eq("circle_id", c.circleId);
  if (r1.error || r2.error || r3.error) fail(c.circleId, "/more/settings", "Only administrators can change these details.");
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "profile.update" });
  await activity(c, "updated", `${c.circle.preferred_name}'s details`);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/more/settings", "Saved");
}

export async function saveEmergency(f: FormData) {
  const c = await ctx(f);
  const { error } = await c.supabase.from("emergency_info").update({
    allergies: n(f, "allergies"), important_info: n(f, "important_info"), preferred_hospital: n(f, "preferred_hospital"),
    power_of_attorney: n(f, "power_of_attorney"), other_notes: n(f, "other_notes"), updated_by: c.user.id, updated_at: new Date().toISOString(),
  }).eq("circle_id", c.circleId);
  if (error) fail(c.circleId, "/more/emergency?edit=1", "Only family members can change emergency information.");
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "emergency.update" });
  await activity(c, "updated the emergency information");
  back(c.circleId, "/more/emergency", "Saved");
}

export async function saveContact(f: FormData) {
  const c = await ctx(f);
  const row = { circle_id: c.circleId, name: s(f, "name"), organisation: n(f, "organisation"), category: s(f, "category"),
    phone: n(f, "phone"), email: n(f, "email"), notes: n(f, "notes"), visibility: s(f, "visibility") || "family" };
  const id = n(f, "id");
  const { error } = id ? await c.supabase.from("contacts").update(row).eq("id", id) : await c.supabase.from("contacts").insert(row);
  if (error) fail(c.circleId, "/more/contacts", "Only family members can change contacts.");
  if (!id) await activity(c, "added a contact:", row.name);
  back(c.circleId, "/more/contacts", "Saved");
}
export async function deleteContact(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("contacts").delete().eq("id", s(f, "id"));
  back(c.circleId, "/more/contacts", "Contact removed");
}

export async function saveAsset(f: FormData) {
  const c = await ctx(f);
  const row = { circle_id: c.circleId, name: s(f, "name"), details: n(f, "details"), last_service: n(f, "last_service"),
    next_service: n(f, "next_service"), warranty_expiry: n(f, "warranty_expiry"), supplier: n(f, "supplier"), notes: n(f, "notes") };
  const id = n(f, "id");
  const { error } = id ? await c.supabase.from("home_assets").update(row).eq("id", id) : await c.supabase.from("home_assets").insert(row);
  if (error) fail(c.circleId, "/more/home", "Only family members can change home details.");
  if (!id) await activity(c, "added to the home record:", row.name);
  if (f.get("make_task") === "on" && row.next_service) {
    await c.supabase.from("tasks").insert({ circle_id: c.circleId, title: `${row.name} service`, category: "Maintenance",
      due_date: row.next_service, recurrence: "annually", status: "open", created_by: c.user.id });
  }
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/more/home", "Saved");
}
export async function deleteAsset(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("home_assets").delete().eq("id", s(f, "id"));
  back(c.circleId, "/more/home", "Removed");
}

export async function registerDocument(f: FormData) {
  const c = await ctx(f);
  const path = s(f, "path");
  if (!path.startsWith(`${c.circleId}/`) || path.includes("..")) fail(c.circleId, "/more/documents", "Upload failed. Please try again.");
  const name = s(f, "name").slice(0, 200);
  const { error } = await c.supabase.from("documents").insert({
    circle_id: c.circleId, name, category: s(f, "category") || "Other", storage_path: path,
    expiry_date: n(f, "expiry_date"), access: c.role === "admin" ? (s(f, "access") || "family") : "family", notes: n(f, "notes"), uploaded_by: c.user.id,
  });
  if (error) { await c.supabase.storage.from("documents").remove([path]); fail(c.circleId, "/more/documents", "Couldn't save the document."); }
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "document.upload", detail: { name } });
  await activity(c, "uploaded", name);
  back(c.circleId, "/more/documents", "Uploaded");
}

export async function deleteDocument(f: FormData) {
  const c = await ctx(f);
  const { data: d } = await c.supabase.from("documents").select("*").eq("id", s(f, "id")).single();
  if (!d) fail(c.circleId, "/more/documents", "Document not found.");
  const { error } = await c.supabase.from("documents").delete().eq("id", d.id);
  if (error) fail(c.circleId, "/more/documents", "Only administrators or the uploader can delete this.");
  await c.supabase.storage.from("documents").remove([d.storage_path]);
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "document.delete", detail: { name: d.name } });
  back(c.circleId, "/more/documents", "Deleted");
}


// ---------------------------------------------------------------- letters

async function saveScan(c: Awaited<ReturnType<typeof ctx>>, documentId: string | null, result: LetterResult, source: "ai" | "sample") {
  const { data, error } = await c.supabase.from("letter_scans").insert({
    circle_id: c.circleId, document_id: documentId, result, source, created_by: c.user.id,
  }).select("id").single();
  if (error || !data) fail(c.circleId, "/letters", "Couldn't save what KIN found.");
  if (documentId) await c.supabase.from("documents").update({ category: result.doc_category, name: `${result.organisation}: ${result.document_type}`.slice(0, 200) }).eq("id", documentId);
  await activity(c, "read a letter from", result.organisation);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, `/letters/${data!.id}`);
}

/** The browser has already uploaded the file to private storage. */
export async function scanLetter(f: FormData) {
  const c = await ctx(f);
  const path = s(f, "path");
  if (!path.startsWith(`${c.circleId}/`) || path.includes("..")) fail(c.circleId, "/letters", "Upload failed. Please try again.");
  const type = s(f, "type");
  const { data: doc, error } = await c.supabase.from("documents").insert({
    circle_id: c.circleId, name: s(f, "name") || "Letter", category: "Other", storage_path: path, access: "family",
    notes: "Read by KIN", uploaded_by: c.user.id,
  }).select("id").single();
  if (error || !doc) { await c.supabase.storage.from("documents").remove([path]); fail(c.circleId, "/letters", "Only family members can add letters."); }
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "document.upload", detail: { name: s(f, "name") || "Letter" } });
  if (!letterReadingOn()) back(c.circleId, "/letters", "Letter saved to Documents. Automatic reading isn't switched on yet.");
  if (!(await takeAllowance(c.user.id, "letter"))) back(c.circleId, "/letters", "Letter saved to Documents. You've reached today's limit for reading letters, so try again tomorrow.");
  const file = await c.supabase.storage.from("documents").download(path);
  if (file.error || !file.data) fail(c.circleId, "/letters", "Couldn't open the letter.");
  let result: LetterResult;
  try {
    result = await readLetter(await file.data!.arrayBuffer(), type || file.data!.type, c.circle.kind || "care");
  } catch (e) {
    console.error("letter read failed", e);
    return fail(c.circleId, "/letters", "KIN couldn't read that letter. It's saved in Documents. Try a clearer, flatter photo.");
  }
  await saveScan(c, doc!.id, result, "ai");
}

export async function scanSampleLetter(f: FormData) {
  const c = await ctx(f);
  const kids = c.circle.kind === "children";
  let child = "your child";
  if (kids) {
    const { data: ks } = await c.supabase.from("children").select("first_name, date_of_birth").eq("circle_id", c.circleId).order("date_of_birth", { ascending: false });
    child = ks?.[0]?.first_name || child;
  }
  const title = kids ? "Orchard Primary School" : "Nenebridge District Council";
  const lines = kids ? sampleSchoolLines(child) : sampleLetterLines(c.circle.person_name);
  const path = `${c.circleId}/${crypto.randomUUID()}-sample-letter.pdf`;
  const up = await c.supabase.storage.from("documents").upload(path, makePdf(title, lines), { contentType: "application/pdf" });
  if (up.error) fail(c.circleId, "/letters", "Only family members can add letters.");
  const { data: doc } = await c.supabase.from("documents").insert({
    circle_id: c.circleId, name: kids ? SAMPLE_SCHOOL_LETTER_NAME : SAMPLE_LETTER_NAME, category: kids ? "Other" : "Property", storage_path: path, access: "family", notes: "Example letter", uploaded_by: c.user.id,
  }).select("id").single();
  let result: LetterResult = kids ? sampleSchoolResult(child) : sampleResult(c.circle.preferred_name);
  let source: "ai" | "sample" = "sample";
  if (letterReadingOn()) {
    try {
      const bytes = await makePdf(title, lines).arrayBuffer();
      result = await readLetter(bytes, "application/pdf", c.circle.kind || "care");
      source = "ai";
    } catch (e) { console.error("sample read failed", e); }
  }
  await saveScan(c, doc?.id || null, result, source);
}

async function updateSuggestion(f: FormData, fn: (r: LetterResult, i: number, c: Awaited<ReturnType<typeof ctx>>) => Promise<string>) {
  const c = await ctx(f);
  const id = s(f, "id");
  const i = Number(s(f, "i"));
  const { data: scan } = await c.supabase.from("letter_scans").select("*").eq("id", id).eq("circle_id", c.circleId).single();
  if (!scan) fail(c.circleId, "/letters", "Letter not found.");
  const result = scan.result as LetterResult;
  if (!result.suggestions[i]) fail(c.circleId, `/letters/${id}`, "Suggestion not found.");
  const msg = await fn(result, i, c);
  await c.supabase.from("letter_scans").update({ result }).eq("id", id);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, `/letters/${id}`, msg);
}
export async function createFromLetter(f: FormData) {
  return updateSuggestion(f, async (r, i, c) => {
    const sg = r.suggestions[i];
    if (sg.task_id) return "Already added";
    const { data: t, error } = await c.supabase.from("tasks").insert({
      circle_id: c.circleId, title: s(f, "title") || sg.title, category: sg.category, due_date: n(f, "due_date"),
      description: `${sg.detail}\n\nFrom a letter: ${r.organisation}, ${r.document_type}.`, status: n(f, "assignee") ? "accepted" : "open",
      assignee: n(f, "assignee"), private: f.get("private") === "on", source: `letter:${s(f, "id")}`, created_by: c.user.id, child_ids: ids(f, "child"),
    }).select("id").single();
    if (error || !t) fail(c.circleId, `/letters/${s(f, "id")}`, "Couldn't add the task.");
    sg.task_id = t!.id;
    await activity(c, "created a task from a letter:", sg.title);
    return "Task added";
  });
}
export async function dismissSuggestion(f: FormData) {
  return updateSuggestion(f, async (r, i) => { r.suggestions[i].dismissed = true; return "Ignored"; });
}

// ---------------------------------------------------------------- playbooks
export async function startPlaybook(f: FormData) {
  const c = await ctx(f);
  const pb = playbook(s(f, "slug"));
  if (!pb) fail(c.circleId, "/playbooks", "Playbook not found.");
  const start = s(f, "start") || new Date().toISOString().slice(0, 10);
  const assignee = n(f, "assignee");
  const chosen = f.getAll("step").map(Number);
  const rows = pb!.steps.map((st, i) => ({ st, i })).filter(({ i }) => chosen.includes(i)).map(({ st }) => ({
    circle_id: c.circleId, title: st.title, description: st.detail, category: st.category, due_date: addDays(start, st.offset) < today() ? today() : addDays(start, st.offset),
    assignee, status: assignee ? "accepted" : "open", private: !!st.private, source: `playbook:${pb!.slug}`, link_url: st.link || pb!.link, created_by: c.user.id,
  }));
  if (!rows.length) fail(c.circleId, `/playbooks/${pb!.slug}`, "Choose at least one step.");
  const { error } = await c.supabase.from("tasks").insert(rows);
  if (error) fail(c.circleId, `/playbooks/${pb!.slug}`, "Only family members can start a playbook.");
  await activity(c, `started the playbook "${pb!.title}" with ${rows.length} tasks`);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/tasks", `${rows.length} tasks added from "${pb!.title}"`);
}

// ---------------------------------------------------------------- shared costs
const pence = (v: string) => Math.round(parseFloat(v.replace(/[£,\s]/g, "")) * 100);
export async function addExpense(f: FormData) {
  const c = await ctx(f);
  const amount = pence(s(f, "amount"));
  const split = f.getAll("split").map(String);
  if (!(amount > 0)) fail(c.circleId, "/costs", "Enter an amount, like 12.50.");
  if (!split.length) fail(c.circleId, "/costs", "Choose who to split it between.");
  const shares: Record<string, number> = {};
  for (const id of split) { const w = Number(s(f, `w_${id}`)); if (w >= 0 && s(f, `w_${id}`) !== "") shares[id] = w; }
  const paidBy = s(f, "paid_by") || c.user.id;
  const kids = c.circle.kind === "children";
  const needsOk = kids && split.some((id) => id !== c.user.id && id !== paidBy) && f.get("approval") !== "skip";
  const { error } = await c.supabase.from("expenses").insert({
    circle_id: c.circleId, description: s(f, "description"), category: s(f, "category") || "Other", amount_pence: amount,
    paid_by: paidBy, split_between: split, spent_on: s(f, "spent_on") || undefined, created_by: c.user.id,
    shares: Object.keys(shares).length === split.length ? shares : null, status: needsOk ? "pending" : "approved", child_ids: ids(f, "child"),
  });
  if (error) fail(c.circleId, "/costs", "Only family members can add shared costs.");
  await activity(c, needsOk ? "asked the other parent to approve a cost:" : "added a shared cost:", s(f, "description"));
  if (needsOk) alert(c, "answer", [...split, paidBy].filter((x) => parents(c).includes(x)), `${myName(c)} added a cost to approve: ${s(f, "description")}`,
    `${money(amount)}, paid by ${paidBy === c.user.id ? myName(c) : c.nameOf(paidBy)}. It only counts in the balance once it's approved.`, "/costs");
  back(c.circleId, "/costs", needsOk ? "Sent for approval. It counts once agreed." : "Cost added");
}
export async function addSettlement(f: FormData) {
  const c = await ctx(f);
  const amount = pence(s(f, "amount"));
  if (!(amount > 0)) fail(c.circleId, "/costs", "Enter an amount, like 12.50.");
  const { error } = await c.supabase.from("settlements").insert({
    circle_id: c.circleId, from_user: s(f, "from_user"), to_user: s(f, "to_user"), amount_pence: amount, note: n(f, "note"), created_by: c.user.id,
  });
  if (error) fail(c.circleId, "/costs", "Couldn't record that payment. Check the two people are different.");
  await activity(c, `recorded a payment from ${c.nameOf(s(f, "from_user"))} to`, c.nameOf(s(f, "to_user")));
  back(c.circleId, "/costs", "Payment recorded");
}
export async function deleteCost(f: FormData) {
  const c = await ctx(f);
  const table = s(f, "kind") === "settlement" ? "settlements" : "expenses";
  const { data } = await c.supabase.from(table).delete().eq("id", s(f, "id")).select("id");
  if (!data?.length) fail(c.circleId, "/costs", "You can only remove entries you added.");
  back(c.circleId, "/costs", "Removed");
}

// ---------------------------------------------------------------- children and co-parenting
const COLOURS = ["blue", "plum", "amber", "coral", "accent"];
const colour = (v: string, fallback = "blue") => (COLOURS.includes(v) ? v : fallback);

export async function saveChild(f: FormData) {
  const c = await ctx(f);
  const id = n(f, "id");
  const row = {
    circle_id: c.circleId, first_name: s(f, "first_name"), last_name: n(f, "last_name"), date_of_birth: n(f, "date_of_birth"),
    colour: colour(s(f, "colour")), school: n(f, "school"), year_group: n(f, "year_group"), class_name: n(f, "class_name"), teacher: n(f, "teacher"),
    allergies: n(f, "allergies"), important_notes: n(f, "important_notes"), clothes_size: n(f, "clothes_size"), shoe_size: n(f, "shoe_size"),
    gp: n(f, "gp"), dentist: n(f, "dentist"), passport_expiry: n(f, "passport_expiry"),
  };
  if (!row.first_name) fail(c.circleId, "/children", "Add a first name.");
  const { error } = id ? await c.supabase.from("children").update(row).eq("id", id) : await c.supabase.from("children").insert(row);
  if (error) fail(c.circleId, "/children", "Only parents can change the children's details.");
  await activity(c, id ? "updated details for" : "added", row.first_name);
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "child.update", detail: { name: row.first_name } });
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/children", "Saved");
}

export async function saveHousehold(f: FormData) {
  const c = await ctx(f);
  const id = n(f, "id");
  const row = { circle_id: c.circleId, name: s(f, "name"), address: n(f, "address"), colour: colour(s(f, "colour"), "plum"), sort: Number(s(f, "sort") || 0) };
  if (!row.name) fail(c.circleId, "/schedule/settings", "Give the home a name, like Mum's or Dad's.");
  const { error } = id ? await c.supabase.from("households").update(row).eq("id", id) : await c.supabase.from("households").insert(row);
  if (error) fail(c.circleId, "/schedule/settings", "Only parents can change homes.");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/schedule/settings", "Saved");
}

export async function setPattern(f: FormData) {
  const c = await ctx(f);
  const { data: homes } = await c.supabase.from("households").select("id").eq("circle_id", c.circleId).order("sort");
  const H = (homes || []).map((h) => h.id);
  if (H.length < 2) fail(c.circleId, "/schedule/settings", "Add both homes first.");
  const days = Array.from({ length: 14 }, (_, i) => s(f, `d${i}`)).filter((x) => H.includes(x));
  if (days.length !== 14) fail(c.circleId, "/schedule/settings", "Choose a home for every night.");
  const anchor = s(f, "anchor");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) fail(c.circleId, "/schedule/settings", "Choose the first Monday of the pattern.");
  const { error } = await c.supabase.from("schedule_patterns").upsert({ circle_id: c.circleId, anchor, days, label: n(f, "label"), updated_by: c.user.id, updated_at: new Date().toISOString() });
  if (error) fail(c.circleId, "/schedule/settings", "Only parents can change the regular schedule.");
  await activity(c, "changed the regular schedule", n(f, "label"));
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "schedule.pattern", detail: { label: n(f, "label"), anchor } });
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/schedule", "Regular schedule saved. Everyone in the family can see it.");
}

export async function requestChange(f: FormData) {
  const c = await ctx(f);
  const start = s(f, "start_date"), end = s(f, "end_date") || s(f, "start_date");
  if (!start || end < start) fail(c.circleId, "/schedule", "Check the dates.");
  const { error } = await c.supabase.from("schedule_changes").insert({
    circle_id: c.circleId, start_date: start, end_date: end, household_id: s(f, "household_id"),
    reason: n(f, "reason"), in_return: n(f, "in_return"), requested_by: c.user.id, status: "requested",
  });
  if (error) fail(c.circleId, "/schedule", "Couldn't send the request. Changes can cover up to 60 nights.");
  await activity(c, "asked for a schedule change", null);
  const { data: home } = await c.supabase.from("households").select("name").eq("id", s(f, "household_id")).maybeSingle();
  alert(c, "answer", parents(c), `${myName(c)} asked to change the schedule`,
    `${range(start, end)} at ${home?.name || "the other home"}.${n(f, "reason") ? ` "${s(f, "reason")}"` : ""}${n(f, "in_return") ? ` In return: ${s(f, "in_return")}` : ""}`, "/schedule");
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "schedule.request", detail: { start, end } });
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/schedule", "Request sent. Nothing changes until it's agreed.");
}

export async function respondChange(f: FormData) {
  const c = await ctx(f);
  const accept = s(f, "answer") === "yes";
  const { error } = await c.supabase.rpc("respond_schedule_change", { p_id: s(f, "id"), p_accept: accept, p_note: n(f, "note") });
  if (error) fail(c.circleId, s(f, "return") || "/schedule", error.message);
  const { data: r } = await c.supabase.from("schedule_changes").select("requested_by, start_date, end_date").eq("id", s(f, "id")).maybeSingle();
  if (r) alert(c, "update", [r.requested_by], `${myName(c)} ${accept ? "agreed to" : "said no to"} your schedule change`,
    `${range(r.start_date, r.end_date)}.${n(f, "note") ? ` "${s(f, "note")}".` : ""}${accept ? " The schedule has been updated for everyone." : " The schedule stays as it was."}`, "/schedule");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, s(f, "return") || "/schedule", accept ? "Agreed. The schedule has been updated for everyone." : "Answer sent. The schedule stays as it was.");
}

export async function cancelChange(f: FormData) {
  const c = await ctx(f);
  const { error } = await c.supabase.rpc("cancel_schedule_change", { p_id: s(f, "id") });
  if (error) fail(c.circleId, "/schedule", error.message);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/schedule", "Request withdrawn");
}

export async function recordHandover(f: FormData) {
  const c = await ctx(f);
  const all = f.getAll("all_items").map(String);
  const packed = f.getAll("packed").map(String);
  const { error } = await c.supabase.from("handovers").insert({
    circle_id: c.circleId, from_household: n(f, "from_household"), to_household: n(f, "to_household"), recorded_by: c.user.id,
    items_packed: packed, items_missing: all.filter((x) => !packed.includes(x)), note: n(f, "note"),
  });
  if (error) fail(c.circleId, "/handover", "Couldn't record the handover.");
  const missing = all.filter((x) => !packed.includes(x));
  await activity(c, missing.length ? `recorded a handover (missing: ${missing.join(", ")})` : "recorded a handover", null);
  if (missing.length) alert(c, "update", parents(c), `Handover: ${missing.join(", ")} not packed`, `Recorded by ${myName(c)}.${n(f, "note") ? ` "${s(f, "note")}"` : ""}`, "/handover");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/handover", "Handover recorded");
}

export async function proposeAgreement(f: FormData) {
  const c = await ctx(f);
  const { error } = await c.supabase.from("agreements").insert({
    circle_id: c.circleId, title: s(f, "title"), detail: n(f, "detail"), category: s(f, "category") || "Other",
    share: f.get("share") === "on", proposed_by: c.user.id, status: "proposed",
  });
  if (error) fail(c.circleId, "/agreements", "Only parents can propose agreements.");
  await activity(c, "proposed an agreement:", s(f, "title"));
  alert(c, "answer", parents(c), `${myName(c)} proposed an agreement`, s(f, "title"), "/agreements");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/agreements", "Proposed. It becomes an agreement once another parent agrees.");
}

export async function respondAgreementAction(f: FormData) {
  const c = await ctx(f);
  const yes = s(f, "answer") === "yes";
  const { error } = await c.supabase.rpc("respond_agreement", { p_id: s(f, "id"), p_agree: yes, p_note: n(f, "note") });
  if (error) fail(c.circleId, s(f, "return") || "/agreements", error.message);
  const { data: ag } = await c.supabase.from("agreements").select("proposed_by, title").eq("id", s(f, "id")).maybeSingle();
  if (ag) alert(c, "update", [ag.proposed_by], `${myName(c)} ${yes ? "agreed to" : "didn't agree to"} your proposal`, `${ag.title}${n(f, "note") ? ` - "${s(f, "note")}"` : ""}`, "/agreements");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, s(f, "return") || "/agreements", yes ? "Agreed" : "Answer sent");
}

export async function withdrawAgreementAction(f: FormData) {
  const c = await ctx(f);
  const { error } = await c.supabase.rpc("withdraw_agreement", { p_id: s(f, "id") });
  if (error) fail(c.circleId, "/agreements", error.message);
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/agreements", "Withdrawn");
}

export async function saveItem(f: FormData) {
  const c = await ctx(f);
  const id = n(f, "id");
  const row = { circle_id: c.circleId, child_id: n(f, "child_id"), name: s(f, "name"), household_id: n(f, "household_id"), location_note: n(f, "location_note"), updated_by: c.user.id, updated_at: new Date().toISOString() };
  if (!row.name) fail(c.circleId, "/children#where", "What's the item?");
  const { error } = id ? await c.supabase.from("child_items").update(row).eq("id", id) : await c.supabase.from("child_items").insert(row);
  if (error) fail(c.circleId, "/children#where", "Only parents can update this list.");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/children?saved=1#where", "Updated");
}

export async function deleteItem(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("child_items").delete().eq("id", s(f, "id"));
  back(c.circleId, "/children#where", "Removed");
}

export async function respondExpenseAction(f: FormData) {
  const c = await ctx(f);
  const yes = s(f, "answer") === "yes";
  const { error } = await c.supabase.rpc("respond_expense", { p_id: s(f, "id"), p_approve: yes, p_note: n(f, "note") });
  if (error) fail(c.circleId, s(f, "return") || "/costs", error.message);
  const { data: ex } = await c.supabase.from("expenses").select("created_by, description, amount_pence").eq("id", s(f, "id")).maybeSingle();
  if (ex) alert(c, "update", [ex.created_by], `${myName(c)} ${yes ? "approved" : "queried"} ${ex.description} (${money(ex.amount_pence)})`,
    `${n(f, "note") ? `"${s(f, "note")}". ` : ""}${yes ? "It now counts in the balance." : "It won't count until it's sorted out."}`, "/costs");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, s(f, "return") || "/costs", yes ? "Approved. It now counts in the balance." : "Queried. It won't count until it's sorted out.");
}

export async function addMaintenance(f: FormData) {
  const c = await ctx(f);
  const amount = Math.round(parseFloat(s(f, "amount").replace(/[£,\s]/g, "")) * 100);
  if (!(amount > 0)) fail(c.circleId, "/costs#maintenance", "Enter an amount, like 250.00.");
  const { error } = await c.supabase.from("settlements").insert({
    circle_id: c.circleId, from_user: s(f, "from_user"), to_user: s(f, "to_user"), amount_pence: amount, paid_on: s(f, "paid_on") || undefined,
    note: n(f, "note"), kind: "maintenance", created_by: c.user.id,
  });
  if (error) fail(c.circleId, "/costs#maintenance", "Couldn't record that payment. Check the two people are different.");
  await activity(c, "recorded a child maintenance payment", null);
  back(c.circleId, "/costs#maintenance", "Maintenance payment recorded");
}

export async function saveFamily(f: FormData) {
  const c = await ctx(f);
  const packing = s(f, "packing_list").split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 30);
  const split: Record<string, number> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("split_") && Number(v) >= 0) split[k.slice(6)] = Number(v);
  const { error } = await c.supabase.from("care_circles").update({
    person_name: s(f, "person_name") || c.circle.person_name, preferred_name: s(f, "preferred_name") || c.circle.preferred_name,
    packing_list: packing, handover_note: n(f, "handover_note"), default_split: Object.keys(split).length ? split : null,
  }).eq("id", c.circleId);
  if (error) fail(c.circleId, "/schedule/settings", "Only administrators can change family settings.");
  await c.supabase.from("audit_log").insert({ circle_id: c.circleId, actor: c.user.id, action: "family.settings" });
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "/schedule/settings", "Saved");
}

export async function youngPersonAsk(f: FormData) {
  const c = await ctx(f);
  const msg = s(f, "message").slice(0, 200);
  if (!msg) back(c.circleId);
  await activity(c, "asked:", msg);
  alert(c, "answer", parents(c), `${myName(c)} asked: ${msg}`, null, "");
  revalidatePath(`/c/${c.circleId}`, "layout");
  back(c.circleId, "", "Sent to your parents");
}

// Separate actions for yes/no buttons, so the choice never depends on which button the browser reports
const withAnswer = (f: FormData, a: "yes" | "no") => { f.set("answer", a); return f; };
export async function agreeChange(f: FormData) { return respondChange(withAnswer(f, "yes")); }
export async function declineChange(f: FormData) { return respondChange(withAnswer(f, "no")); }
export async function agreeAgreement(f: FormData) { return respondAgreementAction(withAnswer(f, "yes")); }
export async function declineAgreement(f: FormData) { return respondAgreementAction(withAnswer(f, "no")); }
export async function approveExpense(f: FormData) { return respondExpenseAction(withAnswer(f, "yes")); }
export async function queryExpense(f: FormData) { return respondExpenseAction(withAnswer(f, "no")); }
