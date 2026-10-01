import Link from "next/link";
import { getCircle } from "@/lib/data";
import { loadFamily } from "@/lib/family";
import { addDays, ageOn, canEdit, COLOURS, dayLabel, today, type Child, type ChildItem } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { deleteItem, saveChild, saveItem } from "../actions";

const COLOUR_NAME: Record<string, string> = { blue: "Blue", plum: "Purple", amber: "Amber", coral: "Coral", accent: "Green" };
const fmt = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");

function ChildForm({ circle, k }: { circle: string; k?: Child }) {
  return (
    <form action={saveChild} className="card pad form">
      <Hidden circle={circle} id={k?.id} />
      <div className="two">
        <label className="fl">First name<input name="first_name" defaultValue={k?.first_name} required maxLength={60} /></label>
        <label className="fl">Last name<input name="last_name" defaultValue={k?.last_name || ""} /></label>
      </div>
      <div className="two">
        <label className="fl">Date of birth<input type="date" name="date_of_birth" defaultValue={k?.date_of_birth || ""} /></label>
        <label className="fl">Colour<select name="colour" defaultValue={k?.colour || "coral"}>{COLOURS.map((c) => <option key={c} value={c}>{COLOUR_NAME[c]}</option>)}</select></label>
      </div>
      <span className="label">School</span>
      <div className="two">
        <label className="fl">School<input name="school" defaultValue={k?.school || ""} /></label>
        <label className="fl">Year<input name="year_group" defaultValue={k?.year_group || ""} placeholder="e.g. Year 4" /></label>
      </div>
      <div className="two">
        <label className="fl">Class or form<input name="class_name" defaultValue={k?.class_name || ""} /></label>
        <label className="fl">Teacher or tutor<input name="teacher" defaultValue={k?.teacher || ""} /></label>
      </div>
      <span className="label">Shared with childminders and grandparents</span>
      <label className="fl">Allergies<input name="allergies" defaultValue={k?.allergies || ""} placeholder="e.g. Peanuts. Carries an auto-injector." /></label>
      <label className="fl">Important to know<textarea name="important_notes" defaultValue={k?.important_notes || ""} placeholder="e.g. Collected only by the people on the contacts list" /></label>
      <span className="label">Sizes and appointments</span>
      <div className="two">
        <label className="fl">Clothes size<input name="clothes_size" defaultValue={k?.clothes_size || ""} placeholder="e.g. Age 9-10" /></label>
        <label className="fl">Shoe size<input name="shoe_size" defaultValue={k?.shoe_size || ""} placeholder="e.g. 3 (UK)" /></label>
      </div>
      <div className="two">
        <label className="fl">GP surgery<input name="gp" defaultValue={k?.gp || ""} /></label>
        <label className="fl">Dentist<input name="dentist" defaultValue={k?.dentist || ""} /></label>
      </div>
      <label className="fl">Passport expires<input type="date" name="passport_expiry" defaultValue={k?.passport_expiry || ""} /><span className="note">KIN reminds you six months before. Don&apos;t store the passport number here.</span></label>
      <button className="btn primary">{k ? "Save" : "Add child"}</button>
    </form>
  );
}

export default async function Children({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf, me } = await getCircle(id);
  const base = `/c/${id}`;
  const parent = canEdit(role);
  const fam = await loadFamily(supabase, id, { days: 1 });
  const { data: itemRows } = await supabase.from("child_items").select("*").eq("circle_id", id).order("name");
  const items = (itemRows || []) as ChildItem[];
  const kids = fam.children;
  const editing = sp.edit === "new" ? "new" : kids.find((k) => k.id === sp.edit);
  if (parent && editing) return (
    <main className="page">
      <Link href={`${base}/children`} className="link">‹ Children</Link>
      <h1>{editing === "new" ? "Add a child" : editing.first_name}</h1>
      <ChildForm circle={id} k={editing === "new" ? undefined : editing} />
    </main>
  );
  const t = today();
  return (
    <main className="page">
      <Header title="Children" initial={(me.profiles?.display_name || "?")[0]} back={{ href: base, label: "Home" }} />
      <Notice sp={sp} />
      {kids.map((k) => {
        const age = ageOn(k.date_of_birth);
        const passportSoon = k.passport_expiry && k.passport_expiry <= addDays(t, 183);
        return (
          <section key={k.id} className="card pad">
            <div className="row between"><div className="row"><span className={`kid col-${k.colour}`} style={{ fontSize: 15 }}>{k.first_name} {k.last_name || ""}</span>
              {age !== null && <span className="small muted">Age {age}{k.date_of_birth ? ` · birthday ${new Date(k.date_of_birth + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}` : ""}</span>}</div>
              {parent && <Link href={`${base}/children?edit=${k.id}`} className="link">Edit</Link>}</div>
            <dl className="kv" style={{ padding: 0 }}>
              {k.school && <><dt>School</dt><dd>{k.school}{k.year_group ? `, ${k.year_group}` : ""}{k.class_name ? ` (${k.class_name})` : ""}{k.teacher ? `. ${k.teacher}` : ""}</dd></>}
              <dt>Allergies</dt><dd>{k.allergies || "None recorded"}</dd>
              {k.important_notes && <><dt>Important</dt><dd>{k.important_notes}</dd></>}
              {(k.clothes_size || k.shoe_size) && <><dt>Sizes</dt><dd>{[k.clothes_size && `Clothes ${k.clothes_size}`, k.shoe_size && `Shoes ${k.shoe_size}`].filter(Boolean).join(" · ")}</dd></>}
              {k.gp && <><dt>GP</dt><dd>{k.gp}</dd></>}
              {k.dentist && <><dt>Dentist</dt><dd>{k.dentist}</dd></>}
              {k.passport_expiry && <><dt>Passport</dt><dd>{passportSoon ? <span className="tag over">{k.passport_expiry < t ? "Expired" : "Renew soon"}</span> : null} Expires {fmt(k.passport_expiry)}
                {passportSoon && parent && <> · <Link href={`${base}/playbooks/child-passport`}>Renewal steps</Link></>}</dd></>}
            </dl>
            <div className="row"><Link href={`${base}/tasks/new?child=${k.id}`} className="btn sm">Add a task for {k.first_name}</Link></div>
          </section>
        );
      })}
      {!kids.length && <p className="muted">No children added yet.</p>}
      {parent && <Link href={`${base}/children?edit=new`} className="btn">Add a child</Link>}

      <section className="stack" id="where">
        <h2>Where is it?</h2>
        <p className="small muted">The things that travel between homes: passports, PE kits, chargers, the red book.</p>
        {fam.households.length > 0 && (
          <div className="card list">
            {items.map((i) => (
              <div key={i.id} className="item" style={{ flexWrap: "wrap" }}>
                <span className="main"><span className="t">{i.name} {i.child_id && <span className={`kid col-${kids.find((k) => k.id === i.child_id)?.colour}`}>{kids.find((k) => k.id === i.child_id)?.first_name}</span>}</span>
                  <span className="s">{fam.home(i.household_id)?.name || "Somewhere else"}{i.location_note ? ` · ${i.location_note}` : ""} · updated {dayLabel(i.updated_at.slice(0, 10)).toLowerCase()} by {nameOf(i.updated_by)}</span></span>
                {parent && (
                  <form action={saveItem} className="row" style={{ gap: 4 }}>
                    <Hidden circle={id} id={i.id} /><input type="hidden" name="name" value={i.name} /><input type="hidden" name="child_id" value={i.child_id || ""} /><input type="hidden" name="location_note" value={i.location_note || ""} />
                    {fam.households.filter((h) => h.id !== i.household_id).map((h) => <button key={h.id} name="household_id" value={h.id} className="btn sm">Now at {h.name}</button>)}
                  </form>
                )}
              </div>
            ))}
            {!items.length && <p className="empty">Nothing tracked yet.</p>}
          </div>
        )}
        {parent && fam.households.length > 0 && (
          <details className="card pad">
            <summary style={{ fontWeight: 700, cursor: "pointer" }}>Track an item</summary>
            <form action={saveItem} className="form" style={{ marginTop: 12 }}>
              <Hidden circle={id} />
              <div className="two">
                <label className="fl">Item<input name="name" required maxLength={80} placeholder="e.g. Passport" /></label>
                <label className="fl">Whose?<select name="child_id"><option value="">Shared</option>{kids.map((k) => <option key={k.id} value={k.id}>{k.first_name}</option>)}</select></label>
              </div>
              <div className="two">
                <label className="fl">Where is it now?<select name="household_id">{fam.households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
                <label className="fl">Exactly where?<input name="location_note" maxLength={200} placeholder="e.g. Filing box, study" /></label>
              </div>
              <button className="btn primary">Add</button>
            </form>
          </details>
        )}
        {parent && items.length > 0 && (
          <details><summary className="small muted" style={{ cursor: "pointer" }}>Remove an item</summary>
            <div className="row" style={{ marginTop: 8 }}>{items.map((i) => <form key={i.id} action={deleteItem}><Hidden circle={id} id={i.id} /><button className="btn sm warn">{i.name}</button></form>)}</div>
          </details>
        )}
      </section>
      <p className="note">Allergies and important notes are shown to everyone in the family, including childminders.</p>
    </main>
  );
}
