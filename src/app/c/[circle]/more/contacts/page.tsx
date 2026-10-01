import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, CONTACT_CATEGORIES, KID_CONTACT_CATEGORIES } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import { deleteContact, saveContact } from "../../actions";

export default async function Contacts({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, circle } = await getCircle(id);
  const { data } = await supabase.from("contacts").select("*").eq("circle_id", id).order("category").order("name");
  const edit = canEdit(role);
  const editing = sp.edit ? data?.find((c) => c.id === sp.edit) : null;
  if (edit && (sp.new || editing)) {
    const c = editing || {};
    return (
      <main className="page">
        <Link href={`/c/${id}/more/contacts`} className="link">‹ Contacts</Link>
        <h1>{editing ? "Edit contact" : "New contact"}</h1>
        <form action={saveContact} className="form">
          <Hidden circle={id} id={editing?.id} />
          <label className="fl">Name<input name="name" defaultValue={c.name} required /></label>
          <div className="two">
            <label className="fl">Organisation<input name="organisation" defaultValue={c.organisation || ""} /></label>
            <label className="fl">Type<select name="category" defaultValue={c.category || "Other"}>{(circle.kind === "children" ? KID_CONTACT_CATEGORIES : CONTACT_CATEGORIES).map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div className="two">
            <label className="fl">Phone<input name="phone" type="tel" defaultValue={c.phone || ""} /></label>
            <label className="fl">Email<input name="email" type="email" defaultValue={c.email || ""} /></label>
          </div>
          <label className="fl">Notes<textarea name="notes" defaultValue={c.notes || ""} /></label>
          <label className="fl">Who can see this?<select name="visibility" defaultValue={c.visibility || "family"}>
            <option value="family">Family only</option><option value="everyone">{circle.kind === "children" ? "Everyone, including childminders" : "Everyone in the circle, including helpers"}</option></select></label>
          <button className="btn primary block">Save contact</button>
        </form>
        {editing && <form action={deleteContact}><Hidden circle={id} id={editing.id} /><button className="link" style={{ color: "var(--coral)" }}>Delete contact</button></form>}
      </main>
    );
  }
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Contacts</h1>
      <Notice sp={sp} />
      <div className="card list">
        {(data || []).map((c) => {
          const inner = (<span className="main"><span className="t">{c.name}</span><span className="s">{[c.category, c.organisation].filter(Boolean).join(" · ")}</span>
            {c.phone && <span className="s phone">{c.phone}</span>}{c.email && <span className="s">{c.email}</span>}{c.notes && <span className="s">{c.notes}</span>}</span>);
          return edit ? <Link key={c.id} href={`/c/${id}/more/contacts?edit=${c.id}`} className="item">{inner}<span className="muted">Edit</span></Link>
            : <div key={c.id} className="item">{inner}</div>;
        })}
        {!data?.length && <p className="empty">No contacts shared with you yet.</p>}
      </div>
      {edit && <Link href={`/c/${id}/more/contacts?new=1`} className="btn primary block">Add contact</Link>}
    </main>
  );
}
