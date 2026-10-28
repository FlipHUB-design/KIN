import Link from "next/link";
import { getCircle } from "@/lib/data";
import { addDays, canEdit, dayWord, isInner, today } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { markOrdered, saveMedication, stopMedication } from "../actions";

type Med = { id: string; name: string; dose: string | null; when_taken: string | null; notes: string | null; pharmacy: string | null; repeat_days: number | null; next_order: string | null; last_ordered: string | null; active: boolean };

function MedForm({ cid, m }: { cid: string; m?: Med }) {
  return (
    <form action={saveMedication} className="form">
      <Hidden circle={cid} id={m?.id} />
      <label className="fl">Medicine<input name="name" defaultValue={m?.name || ""} required maxLength={120} placeholder="As on the box, e.g. Amlodipine 5mg" /></label>
      <div className="two">
        <label className="fl">Dose<input name="dose" defaultValue={m?.dose || ""} placeholder="As on the label, e.g. 1 tablet" /></label>
        <label className="fl">When<input name="when_taken" defaultValue={m?.when_taken || ""} placeholder="e.g. Morning" /></label>
      </div>
      <div className="two">
        <label className="fl">Repeat every (days)<input name="repeat_days" type="number" min={1} max={365} defaultValue={m?.repeat_days ?? ""} placeholder="e.g. 28" /></label>
        <label className="fl">Next order due<input name="next_order" type="date" defaultValue={m?.next_order || ""} /></label>
      </div>
      <label className="fl">Pharmacy<input name="pharmacy" defaultValue={m?.pharmacy || ""} placeholder="e.g. Duston Pharmacy" /></label>
      <label className="fl">Notes<input name="notes" defaultValue={m?.notes || ""} placeholder="e.g. Ordered through the NHS App" /></label>
      <button className="btn primary">{m ? "Save" : "Add to the list"}</button>
    </form>
  );
}

export default async function Medications({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, me } = await getCircle(id);
  const kids = circle.kind === "children";
  if (!isInner(role, circle.kind)) return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>Only the family can see the medication list.</p></main>;
  const { data, error } = await supabase.from("medications").select("*").eq("circle_id", id).order("name");
  const meds = (data || []) as Med[];
  const t = today();
  const active = meds.filter((m) => m.active), stopped = meds.filter((m) => !m.active);
  const due = active.filter((m) => m.next_order && m.next_order <= addDays(t, 7)).sort((a, b) => a.next_order!.localeCompare(b.next_order!));
  const edit = canEdit(role);
  return (
    <main className="page">
      <Header title="Medications" sub={kids ? "Medicines the children take, and repeat orders" : `What ${circle.preferred_name} takes, and when to reorder`} initial={(me.profiles?.display_name || "?")[0]} back={{ href: `/c/${id}/more`, label: "More" }} />
      <Notice sp={sp} />
      {error && <p className="note">The medication list isn&apos;t set up on this server yet.</p>}
      {!!due.length && (
        <section className="status attn">
          <div className="sline"><span className="dot" />Repeat prescriptions due</div>
          <ul>{due.map((m) => <li key={m.id}>{m.name}: {m.next_order! < t ? "overdue since" : "due"} {dayWord(m.next_order)}</li>)}</ul>
        </section>
      )}
      <section className="stack">
        <h2>Taking now</h2>
        {!active.length && <p className="muted">Nothing on the list yet.</p>}
        {active.map((m) => (
          <div key={m.id} className="card pad">
            <div className="row between"><b>{m.name}</b>{m.next_order && <span className={`tag ${m.next_order < t ? "over" : m.next_order <= addDays(t, 7) ? "unas" : ""}`}>Reorder {dayWord(m.next_order)}</span>}</div>
            <span className="small">{[m.dose, m.when_taken].filter(Boolean).join(" · ") || "No dose noted"}</span>
            <span className="small muted">{[m.repeat_days ? `Repeat every ${m.repeat_days} days` : null, m.pharmacy, m.last_ordered ? `Last ordered ${dayWord(m.last_ordered)}` : null, m.notes].filter(Boolean).join(" · ")}</span>
            {edit && (
              <div className="row">
                {m.repeat_days && <form action={markOrdered}><Hidden circle={id} id={m.id} /><button className="btn sm primary">Ordered today</button></form>}
                <details><summary className="btn sm" style={{ listStyle: "none" }}>Edit</summary><div style={{ marginTop: 12 }}><MedForm cid={id} m={m} /></div></details>
                <form action={stopMedication}><Hidden circle={id} id={m.id} /><input type="hidden" name="active" value="no" /><button className="btn sm">Stopped taking</button></form>
              </div>
            )}
          </div>
        ))}
      </section>
      {edit && (
        <details className="card pad">
          <summary style={{ fontWeight: 700, cursor: "pointer" }}>Add a medicine</summary>
          <div style={{ marginTop: 12 }}><MedForm cid={id} /></div>
        </details>
      )}
      {!!stopped.length && (
        <section className="stack"><h2>Stopped</h2>
          <div className="card list">{stopped.map((m) => (
            <div key={m.id} className="item"><span className="main"><span className="t">{m.name}</span></span>
              {edit && <form action={stopMedication}><Hidden circle={id} id={m.id} /><input type="hidden" name="active" value="yes" /><button className="btn sm">Taking again</button></form>}</div>
          ))}</div>
        </section>
      )}
      <p className="note">A shared list for the family. Many Hands doesn&apos;t give medical advice. Always follow the label and check with the GP or pharmacist.</p>
    </main>
  );
}
