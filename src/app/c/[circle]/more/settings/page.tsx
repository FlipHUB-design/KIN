import Link from "next/link";
import { getCircle } from "@/lib/data";
import { hm } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import { saveSettings } from "../../actions";

export default async function Settings({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, members } = await getCircle(id);
  const [{ data: p }, { data: v }] = await Promise.all([
    supabase.from("person_profiles").select("*").eq("circle_id", id).maybeSingle(),
    supabase.from("visit_info").select("*").eq("circle_id", id).maybeSingle(),
  ]);
  const admin = role === "admin";
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>{circle.preferred_name}&apos;s details</h1>
      <Notice sp={sp} />
      {!admin && <p className="note">Only administrators can change these details.</p>}
      <form action={saveSettings} className="form">
        <Hidden circle={id} />
        <fieldset disabled={!admin} className="form" style={{ border: 0, padding: 0, margin: 0 }}>
          <h2>Profile</h2>
          <div className="two">
            <label className="fl">Full name<input name="person_name" defaultValue={circle.person_name} required /></label>
            <label className="fl">Preferred name<input name="preferred_name" defaultValue={circle.preferred_name} required /></label>
          </div>
          <div className="two">
            <label className="fl">Date of birth<input type="date" name="date_of_birth" defaultValue={p?.date_of_birth || ""} /></label>
            <label className="fl">Phone<input type="tel" name="phone" defaultValue={p?.phone || ""} /></label>
          </div>
          <div className="two">
            <label className="fl">Email<input type="email" name="email" defaultValue={p?.email || ""} /></label>
            <label className="fl">Preferred contact<input name="preferred_contact" defaultValue={p?.preferred_contact || ""} placeholder="e.g. Phone call, mornings" /></label>
          </div>
          <label className="fl">Important notes<textarea name="important_notes" defaultValue={p?.important_notes || ""} /></label>
          <label className="fl">Accessibility preferences<textarea name="accessibility_notes" defaultValue={p?.accessibility_notes || ""} placeholder="e.g. Large print, hard of hearing on the left" /></label>
          <p className="note">Only add what the family needs. Visible to administrators, family and {circle.preferred_name}.</p>

          <h2>For visitors</h2>
          <label className="fl">Address<textarea name="address" defaultValue={v?.address || ""} /></label>
          <label className="fl">Getting in<textarea name="access_instructions" defaultValue={v?.access_instructions || ""} placeholder="e.g. Key safe by the back door. Ask Sarah for the code." /></label>
          <label className="fl">Main contact for helpers<select name="key_contact_user" defaultValue={v?.key_contact_user || ""}>
            <option value="">Not set</option>
            {members.filter((m) => ["admin", "family"].includes(m.role)).map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name}</option>)}
          </select></label>
          <p className="note">Everyone in the circle can see this section, including helpers.</p>

          <h2>Check-in routine</h2>
          <label className="fl">Someone usually checks in by<input type="time" name="checkin_by" defaultValue={hm(circle.checkin_by)} />
            <span className="note">Leave empty for no expected check-in.</span></label>
          <label className="fl">Describe the routine<input name="checkin_note" defaultValue={circle.checkin_note || ""} placeholder="e.g. Someone visits or calls before midday every day." /></label>
          <p className="note">If nobody checks in, KIN shows it to the family. It never contacts emergency services or judges anyone&apos;s health.</p>
          {admin && <button className="btn primary block">Save</button>}
        </fieldset>
      </form>
    </main>
  );
}
