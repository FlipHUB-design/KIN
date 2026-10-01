import Link from "next/link";
import { getCircle } from "@/lib/data";
import { loadFamily } from "@/lib/family";
import { canEdit, dayLabel, kidsLabel, nextHandover, today, when, type ChildItem, type Handover } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { recordHandover } from "../actions";

export default async function HandoverPage({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, nameOf, me } = await getCircle(id);
  const base = `/c/${id}`;
  const fam = await loadFamily(supabase, id, { days: 16 });
  const [{ data: hist }, { data: items }] = await Promise.all([
    supabase.from("handovers").select("*").eq("circle_id", id).order("handed_at", { ascending: false }).limit(10),
    supabase.from("child_items").select("*").eq("circle_id", id),
  ]);
  const t = today();
  const tonight = fam.nightOf(t)?.household_id;
  // If the children change home today, today's handover is the "next" one.
  const next = nextHandover(fam.nights, fam.nights[0]?.night || t);
  const from = fam.home(next?.from || tonight), to = fam.home(next?.to);
  const kids = fam.children;
  const list = circle.packing_list || [];
  const atFrom = ((items || []) as ChildItem[]).filter((i) => i.household_id === from?.id);
  const H = (hist || []) as Handover[];
  const lastMissing = H[0]?.items_missing || [];
  return (
    <main className="page">
      <Header title="Handover" sub={kidsLabel(kids)} initial={(me.profiles?.display_name || "?")[0]} back={{ href: base, label: "Home" }} />
      <Notice sp={sp} />
      {next && to ? (
        <section className={`tonight col-${to.colour}`}>
          <span className="label">Next handover</span>
          <span className="big">{dayLabel(next.date)}: {from?.name} to {to.name}</span>
          {circle.handover_note && <span>{circle.handover_note}</span>}
        </section>
      ) : <p className="muted">No handover in the next two weeks.</p>}
      {lastMissing.length > 0 && <p className="callout amber">Missing at the last handover: {lastMissing.join(", ")}</p>}
      <form action={recordHandover} className="card pad form">
        <Hidden circle={id} />
        <input type="hidden" name="from_household" value={from?.id || ""} />
        <input type="hidden" name="to_household" value={to?.id || ""} />
        <h2>Packing checklist</h2>
        {list.length ? (
          <div className="stack" style={{ gap: 6 }}>
            {list.map((item) => (
              <label key={item} className="checkline" style={{ fontSize: 16 }}>
                <input type="hidden" name="all_items" value={item} />
                <input type="checkbox" name="packed" value={item} style={{ width: 20, height: 20 }} /> {item}
              </label>
            ))}
          </div>
        ) : <p className="small muted">No packing list yet. {canEdit(role) && <Link href={`${base}/schedule/settings`}>Add one</Link>}</p>}
        {atFrom.length > 0 && <p className="small muted">Kept at {from?.name}: {atFrom.map((i) => `${i.name}${i.child_id ? ` (${kids.find((k) => k.id === i.child_id)?.first_name})` : ""}`).join(", ")}. <Link href={`${base}/children#where`}>Where is it?</Link></p>}
        <label className="fl">Note for the other home (optional)<textarea name="note" maxLength={1000} placeholder="e.g. Alfie has a spelling test on Friday. Ruby's school shoes are in the car." /></label>
        <p className="note">Keep notes practical and about the children. Both parents can see them.</p>
        <button className="btn primary">Record handover</button>
      </form>
      <section className="stack"><h2>Recent handovers</h2>
        <div className="card list">
          {H.map((h) => (
            <div key={h.id} className="item"><span className="main">
              <span className="t">{fam.home(h.from_household)?.name || "?"} to {fam.home(h.to_household)?.name || "?"}</span>
              <span className="s">{when(h.handed_at)} · recorded by {nameOf(h.recorded_by)}</span>
              {h.items_missing.length > 0 && <span className="s"><span className="tag unas">Missing</span> {h.items_missing.join(", ")}</span>}
              {h.note && <span className="s">&ldquo;{h.note}&rdquo;</span>}
            </span></div>
          ))}
          {!H.length && <p className="empty">No handovers recorded yet.</p>}
        </div>
      </section>
    </main>
  );
}
