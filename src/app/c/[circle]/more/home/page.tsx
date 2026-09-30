import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, dayLabel, today } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import { deleteAsset, saveAsset } from "../../actions";

const SUGGEST = ["Boiler", "Home insurance", "Smoke alarms", "Washing machine", "Fridge freezer", "Broadband", "Car", "Garden", "Gutters", "Roof", "Alarm"];

export default async function HomeAssets({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role } = await getCircle(id);
  const [{ data }, { data: visit }] = await Promise.all([
    supabase.from("home_assets").select("*").eq("circle_id", id).order("next_service", { nullsFirst: false }),
    supabase.from("visit_info").select("address").eq("circle_id", id).maybeSingle(),
  ]);
  const edit = canEdit(role);
  const editing = sp.edit ? data?.find((a) => a.id === sp.edit) : null;
  if (edit && (sp.new || editing)) {
    const a = editing || {};
    return (
      <main className="page">
        <Link href={`/c/${id}/more/home`} className="link">‹ Home</Link>
        <h1>{editing ? a.name : "Add to the home record"}</h1>
        <form action={saveAsset} className="form">
          <Hidden circle={id} id={editing?.id} />
          <label className="fl">What is it?<input name="name" list="asset-names" defaultValue={a.name} required /></label>
          <datalist id="asset-names">{SUGGEST.map((s) => <option key={s} value={s} />)}</datalist>
          <label className="fl">Make, model or details<input name="details" defaultValue={a.details || ""} placeholder="e.g. Worcester Greenstar 30i, serial 1234" /></label>
          <div className="two">
            <label className="fl">Last serviced<input type="date" name="last_service" defaultValue={a.last_service || ""} /></label>
            <label className="fl">Next due<input type="date" name="next_service" defaultValue={a.next_service || ""} /></label>
          </div>
          <div className="two">
            <label className="fl">Warranty ends<input type="date" name="warranty_expiry" defaultValue={a.warranty_expiry || ""} /></label>
            <label className="fl">Supplier or engineer<input name="supplier" defaultValue={a.supplier || ""} /></label>
          </div>
          <label className="fl">Notes<textarea name="notes" defaultValue={a.notes || ""} /></label>
          {!editing && <label className="checkline"><input type="checkbox" name="make_task" defaultChecked /> Add a yearly task for the next due date</label>}
          <p className="note">Dates are set by the family. KIN doesn&apos;t set legal or safety schedules.</p>
          <button className="btn primary block">Save</button>
        </form>
        {editing && <form action={deleteAsset}><Hidden circle={id} id={editing.id} /><button className="link" style={{ color: "var(--coral)" }}>Remove</button></form>}
      </main>
    );
  }
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Home</h1>
      {visit?.address && <p className="muted" style={{ whiteSpace: "pre-line" }}>{visit.address}</p>}
      <Notice sp={sp} />
      <div className="card list">
        {(data || []).map((a) => {
          const inner = (<><span className="bar" /><span className="main"><span className="t">{a.name}</span>{a.details && <span className="s">{a.details}</span>}
            {a.next_service && <span className="s">Next: {a.next_service < today() && <span className="tag over">Overdue</span>} {dayLabel(a.next_service)}</span>}
            {a.warranty_expiry && <span className="s">Warranty ends {dayLabel(a.warranty_expiry)}</span>}</span></>);
          return edit ? <Link key={a.id} href={`/c/${id}/more/home?edit=${a.id}`} className="item k-maintenance">{inner}</Link> : <div key={a.id} className="item k-maintenance">{inner}</div>;
        })}
        {!data?.length && <p className="empty">Nothing recorded yet. Start with the boiler and home insurance.</p>}
      </div>
      {edit && <Link href={`/c/${id}/more/home?new=1`} className="btn primary block">Add item</Link>}
    </main>
  );
}
