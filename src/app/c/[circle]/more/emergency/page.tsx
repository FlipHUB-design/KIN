import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, isInner, when } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import { saveEmergency } from "../../actions";

export default async function Emergency({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, members, nameOf } = await getCircle(id);
  if (circle.kind === "children") return <KidsEmergency id={id} />;
  const inner = isInner(role);
  const [{ data: e }, { data: visit }, { data: contacts }] = await Promise.all([
    supabase.from("emergency_info").select("*").eq("circle_id", id).maybeSingle(),
    supabase.from("visit_info").select("address").eq("circle_id", id).maybeSingle(),
    supabase.from("contacts").select("*").eq("circle_id", id).in("category", ["GP", "Pharmacy"]),
  ]);
  const fam = members.filter((m) => ["admin", "family"].includes(m.role) && m.status === "active");
  const gp = contacts?.find((c) => c.category === "GP"), ph = contacts?.find((c) => c.category === "Pharmacy");
  if (sp.edit && canEdit(role)) return (
    <main className="page">
      <Link href={`/c/${id}/more/emergency`} className="link">‹ Cancel</Link>
      <h1>Emergency information</h1>
      <Notice sp={sp} />
      <form action={saveEmergency} className="form">
        <Hidden circle={id} />
        <label className="fl">Allergies<textarea name="allergies" defaultValue={e?.allergies || ""} /></label>
        <label className="fl">Important information for responders<textarea name="important_info" defaultValue={e?.important_info || ""} placeholder="e.g. Hearing aid on the right side" /></label>
        <label className="fl">Preferred hospital<input name="preferred_hospital" defaultValue={e?.preferred_hospital || ""} /></label>
        <label className="fl">Power of attorney (optional)<textarea name="power_of_attorney" defaultValue={e?.power_of_attorney || ""} placeholder="Who holds it and where the document is kept" /></label>
        <label className="fl">Other notes<textarea name="other_notes" defaultValue={e?.other_notes || ""} /></label>
        <p className="note">Everything here is shown as entered by the family. KIN doesn&apos;t check it.</p>
        <button className="btn primary block">Save</button>
      </form>
    </main>
  );
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Emergency</h1>
      <Notice sp={sp} />
      <div className="emerg">
        <a href="tel:999" className="ebox e999"><span>Emergency</span><b>999</b><span className="small">If someone is in danger</span></a>
        <a href="tel:111" className="ebox e111"><span>Urgent medical advice</span><b>111</b><span className="small">NHS 111, day or night</span></a>
      </div>
      <section className="stack"><h2>Family</h2>
        <div className="card list">{fam.map((m) => (
          <div key={m.user_id} className="item"><span className="avatar sm">{(m.profiles?.display_name || "?")[0]}</span>
            <span className="main"><span className="t">{m.profiles?.display_name} <span className="muted">· {m.relationship}</span></span>
              <span className="s phone">{m.profiles?.phone || "No number added"}</span></span></div>))}</div>
      </section>
      {inner && (
        <section className="stack"><h2>Information for responders</h2>
          <div className="card">
            <dl className="kv">
              <dt>Name</dt><dd>{circle.person_name}</dd>
              <dt>Address</dt><dd>{visit?.address || "Not added"}</dd>
              <dt>GP</dt><dd>{gp ? `${gp.organisation || gp.name}${gp.phone ? `\n${gp.phone}` : ""}` : "Not added"}</dd>
              <dt>Pharmacy</dt><dd>{ph ? `${ph.organisation || ph.name}${ph.phone ? `\n${ph.phone}` : ""}` : "Not added"}</dd>
              <dt>Hospital</dt><dd>{e?.preferred_hospital || "Not added"}</dd>
              <dt>Allergies</dt><dd>{e?.allergies || "None recorded"}</dd>
              <dt>Important</dt><dd>{e?.important_info || "None recorded"}</dd>
              <dt>Power of attorney</dt><dd>{e?.power_of_attorney || "Not recorded"}</dd>
              {e?.other_notes && <><dt>Other</dt><dd>{e.other_notes}</dd></>}
            </dl>
            <p className="note" style={{ padding: "0 14px 12px" }}>Entered by the family{e?.updated_by ? `, last updated by ${nameOf(e.updated_by)} ${when(e.updated_at).toLowerCase()}` : ""}. KIN hasn&apos;t checked it.</p>
          </div>
          {canEdit(role) && <Link href={`/c/${id}/more/emergency?edit=1`} className="btn">Edit emergency information</Link>}
        </section>
      )}
    </main>
  );
}

async function KidsEmergency({ id }: { id: string }) {
  const { supabase, members } = await getCircle(id);
  const [{ data: kids }, { data: contacts }] = await Promise.all([
    supabase.from("children").select("*").eq("circle_id", id).order("sort"),
    supabase.from("contacts").select("*").eq("circle_id", id).in("category", ["School", "GP", "Dentist", "Authorised to collect", "Family"]).order("category"),
  ]);
  const adults = members.filter((m) => ["admin", "family", "contributor"].includes(m.role) && m.status === "active");
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Emergency</h1>
      <div className="emerg">
        <a href="tel:999" className="ebox e999"><span>Emergency</span><b>999</b><span className="small">If someone is in danger</span></a>
        <a href="tel:111" className="ebox e111"><span>Urgent medical advice</span><b>111</b><span className="small">NHS 111, day or night</span></a>
      </div>
      <section className="stack"><h2>Call</h2>
        <div className="card list">{adults.map((m) => (
          <div key={m.user_id} className="item"><span className="avatar sm">{(m.profiles?.display_name || "?")[0]}</span>
            <span className="main"><span className="t">{m.profiles?.display_name} <span className="muted">· {m.relationship}</span></span><span className="s phone">{m.profiles?.phone || "No number added"}</span></span></div>
        ))}</div>
      </section>
      <section className="stack"><h2>The children</h2>
        {(kids || []).map((k) => (
          <div key={k.id} className="card pad">
            <span className={`kid col-${k.colour}`} style={{ fontSize: 15 }}>{k.first_name} {k.last_name || ""}</span>
            <dl className="kv" style={{ padding: 0 }}>
              {k.date_of_birth && <><dt>Date of birth</dt><dd>{new Date(k.date_of_birth + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</dd></>}
              <dt>Allergies</dt><dd>{k.allergies || "None recorded"}</dd>
              {k.important_notes && <><dt>Important</dt><dd>{k.important_notes}</dd></>}
              {k.gp && <><dt>GP</dt><dd>{k.gp}</dd></>}
              {k.school && <><dt>School</dt><dd>{k.school}</dd></>}
            </dl>
          </div>
        ))}
      </section>
      {(contacts || []).length > 0 && (
        <section className="stack"><h2>Useful numbers</h2>
          <div className="card list">{(contacts || []).map((c) => (
            <div key={c.id} className="item"><span className="main"><span className="t">{c.name}</span><span className="s">{[c.category, c.organisation].filter(Boolean).join(" · ")}</span>{c.phone && <span className="s phone">{c.phone}</span>}</span></div>
          ))}</div>
        </section>
      )}
      <p className="note">Entered by the family. KIN hasn&apos;t checked it.</p>
    </main>
  );
}
