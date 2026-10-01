"use server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { aiOn, takeAllowance } from "@/lib/ai";
import { aiPlan, cleanPlan, rulesPlan, type Answers, type Plan } from "@/lib/setup";
import { PATTERNS, addDays, today } from "@/lib/kin";
import { playbook } from "@/lib/playbooks";
import { isDemoEmail, sendInviteEmail, site } from "@/lib/notify";

export type Draft = { plan: Plan; note: string | null };

/** Turns the answers into a plan for the person to review. Nothing is saved yet. */
export async function draftSetup(a: Answers): Promise<Draft> {
  const { user } = await getUser();
  if (!user) redirect("/login");
  const base = rulesPlan(a);
  if (!aiOn()) return { plan: base, note: "KIN's AI helper isn't switched on yet, so this is a starting point from your answers. Anything you typed in your own words hasn't been read." };
  if (!(await takeAllowance(user.id, "setup"))) return { plan: base, note: "You've used the AI helper a lot today, so this is a starting point from your answers only." };
  const ai = await aiPlan(a, base);
  if (!ai) return { plan: base, note: "The AI helper couldn't respond just now, so this is a starting point from your answers only." };
  return { plan: ai, note: null };
}

/** Creates the family or Care Circle and everything ticked on the review screen. */
export async function applySetup(raw: Plan) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const p = cleanPlan(raw);
  if (!p) redirect("/circles/new?error=" + encodeURIComponent("Something was missing. Please try again."));
  const kids = p.kind === "children";
  const { data: id, error } = await supabase.rpc("create_circle", { p_person_name: p.person_name, p_preferred_name: p.preferred_name, p_relationship: p.relationship, p_kind: p.kind });
  if (error || !id) redirect("/circles/new?error=" + encodeURIComponent("We couldn't set this up. Please try again."));

  // The people and places
  const childIds = new Map<string, string>();
  if (kids) {
    const { data: rows } = await supabase.from("children").insert(p.children.map((c, i) => ({ ...c, circle_id: id, sort: i }))).select("id, first_name");
    for (const r of rows || []) childIds.set(r.first_name, r.id);
    await supabase.from("care_circles").update({ packing_list: p.packing_list, handover_note: p.handover_note }).eq("id", id);
    if (p.homes.length === 2) {
      const { data: homes } = await supabase.from("households").insert(p.homes.map((name, i) => ({ circle_id: id, name, colour: i ? "blue" : "plum", sort: i }))).select("id, sort");
      const A = homes?.find((h) => h.sort === 0)?.id, B = homes?.find((h) => h.sort === 1)?.id;
      const pat = PATTERNS.find((x) => x.key === p.pattern);
      if (A && B && pat) await supabase.from("schedule_patterns").insert({ circle_id: id, anchor: p.anchor, days: pat.days.map((x) => (x === "A" ? A : B)), label: pat.label });
    }
  } else {
    if (p.checkin_by) await supabase.from("care_circles").update({ checkin_by: p.checkin_by, checkin_note: `Someone usually visits or calls ${p.preferred_name} by ${p.checkin_by}.` }).eq("id", id);
    if (p.address) await supabase.from("visit_info").update({ address: p.address }).eq("circle_id", id);
    if (p.date_of_birth || p.important_notes) await supabase.from("person_profiles").update({ date_of_birth: p.date_of_birth, important_notes: p.important_notes }).eq("circle_id", id);
    if (p.allergies) await supabase.from("emergency_info").update({ allergies: p.allergies, updated_by: user.id }).eq("circle_id", id);
  }

  // Invitations, emailed when there's an address
  const invitees = p.people.filter((x) => x.include);
  if (invitees.length) {
    const { data: invs } = await supabase.from("invitations").insert(invitees.map((x) => ({
      circle_id: id, name: x.name, email: x.email || null, role: x.role, relationship: x.relationship, invited_by: user.id,
    }))).select("token, email");
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
    const me = (prof?.display_name || "Someone").split(" ")[0];
    const what = kids ? "organise things for the children" : `coordinate things for ${p.preferred_name}`;
    if (!isDemoEmail(user.email)) await Promise.all((invs || []).filter((i) => i.email).map((i) => sendInviteEmail(i.email!, me, what, `${site()}/invite/${i.token}`)));
    await supabase.from("audit_log").insert({ circle_id: id, actor: user.id, action: "invitation.create", detail: { count: invitees.length, via: "guided setup" } });
  }

  // Jobs, contacts and guides
  const rows: Record<string, unknown>[] = p.tasks.filter((t) => t.include).map((t) => {
    const mine = t.who === "me";
    const note = [t.note, t.who && !mine ? `Suggested for ${t.who} once they join.` : null].filter(Boolean).join(" ");
    return {
      circle_id: id, title: t.title, category: t.category, recurrence: t.recurrence, due_date: t.due_date < today() ? today() : t.due_date, due_time: t.due_time,
      description: note || null, assignee: mine ? user.id : null, status: mine ? "accepted" : "open", created_by: user.id, source: "setup",
      child_ids: t.children.map((n) => childIds.get(n)).filter(Boolean),
    };
  });
  for (const pb of p.playbooks.filter((x) => x.include)) {
    const book = playbook(pb.slug);
    if (!book) continue;
    for (const st of book.steps) rows.push({
      circle_id: id, title: st.title, category: st.category, recurrence: "none", due_date: addDays(today(), st.offset), due_time: null,
      description: st.detail, assignee: null, status: "open", created_by: user.id, source: `playbook:${book.slug}`, child_ids: [], ...(st.private ? { private: true } : {}), link_url: st.link || book.link,
    });
  }
  if (rows.length) await supabase.from("tasks").insert(rows, { defaultToNull: false });
  const contacts = p.contacts.filter((c) => c.include);
  if (contacts.length) await supabase.from("contacts").insert(contacts.map((c) => ({ circle_id: id, name: c.name, organisation: c.organisation, category: c.category, phone: c.phone })));
  await supabase.rpc("record_activity", { p_circle: id, p_verb: p.source === "ai" ? "set things up with the guided setup and AI helper" : "set things up with the guided setup", p_subject: null });
  redirect(`/c/${id}/welcome`);
}
