import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { addDays, PATTERNS, today } from "@/lib/kin";

async function create(formData: FormData) {
  "use server";
  const { supabase } = await getUser();
  const person = String(formData.get("person")).trim();
  const preferred = String(formData.get("preferred")).trim() || person.split(" ")[0];
  const { data, error } = await supabase.rpc("create_circle", {
    p_person_name: person,
    p_preferred_name: preferred,
    p_relationship: String(formData.get("relationship")).trim(),
    p_kind: "care",
  });
  if (error) redirect("/circles/new?error=" + encodeURIComponent("We couldn't create the circle. Please try again."));
  const checkin = String(formData.get("checkin_by") || "");
  if (checkin) await supabase.from("care_circles").update({ checkin_by: checkin, checkin_note: `Someone usually visits or calls ${preferred} by ${checkin}.` }).eq("id", data);
  await supabase.from("visit_info").update({ address: String(formData.get("address")).trim() || null }).eq("circle_id", data);
  redirect(`/c/${data}/people?welcome=1`);
}

const COLOURS = ["coral", "amber", "accent", "blue", "plum"];

async function createFamily(f: FormData) {
  "use server";
  const { supabase } = await getUser();
  const g = (k: string) => String(f.get(k) ?? "").trim();
  const names = [0, 1, 2, 3].map((i) => ({ first_name: g(`child${i}`), date_of_birth: g(`dob${i}`) || null })).filter((c) => c.first_name);
  if (!names.length) redirect("/circles/new?kind=children&error=" + encodeURIComponent("Add at least one child."));
  const family = g("person") || `${names.map((n) => n.first_name).join(" and ")}`;
  const { data: id, error } = await supabase.rpc("create_circle", { p_person_name: family, p_preferred_name: names.length > 1 ? "the children" : names[0].first_name, p_relationship: g("relationship") || "Parent", p_kind: "children" });
  if (error || !id) redirect("/circles/new?kind=children&error=" + encodeURIComponent("We couldn't set up the family. Please try again."));
  await supabase.from("children").insert(names.map((n, i) => ({ ...n, circle_id: id, colour: COLOURS[i], sort: i })));
  await supabase.from("care_circles").update({ packing_list: ["School uniform", "PE kit", "Reading book and homework", "Phone and charger"], handover_note: g("handover_note") || null }).eq("id", id);
  if (g("two_homes") === "yes") {
    const { data: homes } = await supabase.from("households").insert([
      { circle_id: id, name: g("home_a") || "My home", colour: "plum", sort: 0 },
      { circle_id: id, name: g("home_b") || "Other home", colour: "blue", sort: 1 },
    ]).select("id, sort");
    const A = homes?.find((h) => h.sort === 0)?.id, B = homes?.find((h) => h.sort === 1)?.id;
    const p = PATTERNS.find((x) => x.key === g("pattern"));
    if (A && B && p) await supabase.from("schedule_patterns").insert({ circle_id: id, anchor: g("anchor"), days: p.days.map((x) => (x === "A" ? A : B)), label: p.label });
  }
  redirect(`/c/${id}/people?welcome=1`);
}

export default async function NewCircle({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const t = today();
  const monday = addDays(t, -((new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7));
  if (!sp.kind) return (
    <main className="page">
      <Link href="/circles" className="link">‹ Back</Link>
      <h1>Who are you organising for?</h1>
      <p className="muted">A few easy questions, then KIN sets everything up for you to check.</p>
      <div className="stack">
        <Link href="/circles/new/guided?kind=care" className="card pad" style={{ textDecoration: "none", color: "inherit" }}>
          <b>An older parent or relative</b><span className="small muted">Visits, lifts to appointments, household jobs, paperwork and who&apos;s doing what.</span></Link>
        <Link href="/circles/new/guided?kind=children" className="card pad" style={{ textDecoration: "none", color: "inherit" }}>
          <b>Children</b><span className="small muted">School, clubs, pick-ups and costs, in one home or across two. Built for co-parents, grandparents and childminders too.</span></Link>
      </div>
    </main>
  );
  if (sp.kind === "children") return (
    <main className="page">
      <Link href="/circles/new" className="link">‹ Back</Link>
      <h1>Set up your family</h1>
      <p className="muted">You can add more detail, and invite the other parent, grandparents or a childminder, straight after.</p>
      {sp.error && <p className="error">{sp.error}</p>}
      <form action={createFamily} className="form">
        <div className="two">
          <label className="fl">Family name<input name="person" placeholder="e.g. The Carter family" /></label>
          <label className="fl">You are their…<input name="relationship" placeholder="e.g. Mum" required /></label>
        </div>
        <span className="label">Children</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="two">
            <label className="fl">First name<input name={`child${i}`} required={i === 0} /></label>
            <label className="fl">Date of birth<input type="date" name={`dob${i}`} /></label>
          </div>
        ))}
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>Do the children live across two homes?</legend>
          <div className="choice">
            <label><input type="radio" name="two_homes" value="yes" defaultChecked /><span>Yes</span></label>
            <label><input type="radio" name="two_homes" value="no" /><span>No, one home</span></label>
          </div>
        </fieldset>
        <div className="two">
          <label className="fl">Your home<input name="home_a" placeholder="e.g. Mum's" /></label>
          <label className="fl">The other home<input name="home_b" placeholder="e.g. Dad's" /></label>
        </div>
        <label className="fl">Usual pattern<select name="pattern" defaultValue="2255">{PATTERNS.map((p) => <option key={p.key} value={p.key}>{p.label}: {p.desc}</option>)}</select>
          <span className="note">Your home counts as the first home. You can fine-tune every night later.</span></label>
        <label className="fl">Week 1 starts on (a Monday)<input type="date" name="anchor" defaultValue={monday} /></label>
        <label className="fl">Usual handover (optional)<input name="handover_note" placeholder="e.g. School pick-up, or 5:30pm at Mum's on non-school days" /></label>
        <p className="note">Children&apos;s details are personal data. Only add what the family needs.</p>
        <button className="btn primary block">Set up family</button>
      </form>
    </main>
  );
  return (
    <main className="page">
      <Link href="/circles/new" className="link">‹ Back</Link>
      <h1>Start a Care Circle</h1>
      <p className="muted">A Care Circle is a private space around one person. You can add more detail later.</p>
      {sp.error && <p className="error">{sp.error}</p>}
      <form action={create} className="form">
        <label className="fl">Who are you helping?<input name="person" placeholder="Full name, e.g. Margaret Hale" required /></label>
        <div className="two">
          <label className="fl">What do you call them?<input name="preferred" placeholder="e.g. Mum" /></label>
          <label className="fl">You are their…<input name="relationship" placeholder="e.g. Daughter" required /></label>
        </div>
        <label className="fl">Their address<textarea name="address" placeholder="Shown to anyone who visits, including helpers" /></label>
        <label className="fl">Does someone usually check in by a certain time?
          <input name="checkin_by" type="time" />
          <span className="note">Optional. KIN will show when nobody has checked in by then. It never contacts emergency services.</span>
        </label>
        <button className="btn primary block">Create Care Circle</button>
      </form>
    </main>
  );
}
