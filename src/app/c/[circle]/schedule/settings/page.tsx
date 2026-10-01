import Link from "next/link";
import { getCircle } from "@/lib/data";
import { loadFamily } from "@/lib/family";
import { addDays, canEdit, COLOURS, PATTERNS, today } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { saveFamily, saveHousehold, setPattern } from "../../actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLOUR_NAME: Record<string, string> = { blue: "Blue", plum: "Purple", amber: "Amber", coral: "Coral", accent: "Green" };

export default async function ScheduleSettings({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, members, me, nameOf } = await getCircle(id);
  const base = `/c/${id}`;
  if (!canEdit(role)) return <main className="page"><Link href={base} className="link">‹ Home</Link><p>Only parents can change these settings.</p></main>;
  const fam = await loadFamily(supabase, id, { days: 1 });
  const { data: pattern } = await supabase.from("schedule_patterns").select("*").eq("circle_id", id).maybeSingle();
  const [A, B] = fam.households;
  const preset = PATTERNS.find((p) => p.key === sp.preset);
  const days: string[] = preset && A && B ? preset.days.map((x) => (x === "A" ? A.id : B.id)) : (pattern?.days as string[]) || Array(14).fill(A?.id || "");
  const t = today();
  const monday = addDays(t, -((new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7));
  const parents = members.filter((m) => ["admin", "family"].includes(m.role) && m.status === "active");
  const homes = [...fam.households, ...(fam.households.length < 2 ? [null] : [])];
  return (
    <main className="page">
      <Header title="Family settings" initial={(me.profiles?.display_name || "?")[0]} back={{ href: `${base}/schedule`, label: "Schedule" }} />
      <Notice sp={sp} />

      <section className="stack"><h2>Homes</h2>
        {homes.map((h, i) => (
          <form key={h?.id || "new"} action={saveHousehold} className="card pad form">
            <Hidden circle={id} id={h?.id} /><input type="hidden" name="sort" value={i} />
            <div className="two">
              <label className="fl">Name<input name="name" defaultValue={h?.name} placeholder={i === 0 ? "e.g. Mum's" : "e.g. Dad's"} required maxLength={60} /></label>
              <label className="fl">Colour<select name="colour" defaultValue={h?.colour || (i === 0 ? "plum" : "blue")}>{COLOURS.map((c) => <option key={c} value={c}>{COLOUR_NAME[c]}</option>)}</select></label>
            </div>
            <label className="fl">Address<textarea name="address" defaultValue={h?.address || ""} placeholder="Shown to childminders for drop-offs" /></label>
            <button className="btn sm">{h ? "Save" : "Add home"}</button>
          </form>
        ))}
      </section>

      {A && B && (
        <section className="stack"><h2>Usual pattern</h2>
          <p className="small muted">Start from a common pattern, then adjust any night. The pattern repeats every two weeks.</p>
          <nav className="chips">{PATTERNS.map((p) => <Link key={p.key} href={`${base}/schedule/settings?preset=${p.key}#pattern`} className="chip" aria-current={sp.preset === p.key} title={p.desc}>{p.label}</Link>)}</nav>
          {preset && <p className="small">{preset.desc}. Nights shown with {A.name} as the first home.</p>}
          <form id="pattern" action={setPattern} className="card pad form">
            <Hidden circle={id} />
            {[0, 1].map((w) => (
              <fieldset key={w} style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label">Week {w + 1}</legend>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                  {DAYS.map((d, i) => (
                    <label key={d} className="fl" style={{ fontSize: 12 }}>{d}
                      <select name={`d${w * 7 + i}`} defaultValue={days[w * 7 + i]} style={{ padding: "6px 2px", fontSize: 13 }}>
                        {fam.households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="two">
              <label className="fl">Week 1 starts on<input type="date" name="anchor" defaultValue={pattern?.anchor || monday} required /><span className="note">A Monday</span></label>
              <label className="fl">Name for this pattern<input name="label" defaultValue={preset?.label || pattern?.label || ""} placeholder="e.g. 2-2-5-5" /></label>
            </div>
            <p className="note">Each choice is the home the children sleep at that night. Changing the usual pattern is logged and everyone sees the new schedule straight away, so agree it first.</p>
            <button className="btn primary">Save usual pattern</button>
          </form>
        </section>
      )}

      <form action={saveFamily} className="stack">
        <Hidden circle={id} />
        <h2>Family details</h2>
        <div className="card pad form">
          <div className="two">
            <label className="fl">Family name<input name="person_name" defaultValue={circle.person_name} placeholder="e.g. The Carter family" /></label>
            <label className="fl">How you refer to them<input name="preferred_name" defaultValue={circle.preferred_name} placeholder="e.g. the kids" /></label>
          </div>
          <label className="fl">Usual handover<input name="handover_note" defaultValue={circle.handover_note || ""} placeholder="e.g. School pick-up, or 5:30pm at Mum's on non-school days" /></label>
          <label className="fl">Packing list for handovers<textarea name="packing_list" defaultValue={(circle.packing_list || []).join("\n")} placeholder={"One item per line\nSchool uniform\nPE kit\nReading book"} style={{ minHeight: 140 }} /></label>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
            <legend className="label">Usual split for shared costs</legend>
            <div className="row">{parents.map((m) => (
              <label key={m.user_id} className="fl" style={{ width: 120 }}>{nameOf(m.user_id)} %<input name={`split_${m.user_id}`} inputMode="numeric" defaultValue={circle.default_split?.[m.user_id] ?? Math.round(100 / parents.length)} /></label>
            ))}</div>
            <span className="note">Used as the starting split for new costs. You can change it for each cost.</span>
          </fieldset>
          <button className="btn primary">Save family details</button>
        </div>
      </form>
    </main>
  );
}
