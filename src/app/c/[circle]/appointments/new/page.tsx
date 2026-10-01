import Link from "next/link";
import { getCircle } from "@/lib/data";
import { addDays, today, type Child } from "@/lib/kin";
import { ChildPicker } from "../../tasks/TaskForm";
import { Hidden, Notice } from "@/components/ui";
import { createAppointment } from "../../actions";

export default async function NewAppointment({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { circle, supabase } = await getCircle(id);
  const kidsMode = circle.kind === "children";
  const { data: kidRows } = kidsMode ? await supabase.from("children").select("*").eq("circle_id", id).order("sort") : { data: [] };
  const kids = (kidRows || []) as Child[];
  const p = kidsMode ? "anyone" : circle.preferred_name;
  return (
    <main className="page">
      <Link href={`/c/${id}/calendar`} className="link">‹ Calendar</Link>
      <h1>{kidsMode ? "New event" : "New appointment"}</h1>
      <Notice sp={sp} />
      <form action={createAppointment} className="form">
        <Hidden circle={id} />
        <label className="fl">What is it?<input name="title" required maxLength={140} placeholder={kidsMode ? "e.g. Dentist check-up, Parents' evening, INSET day" : "e.g. Hearing clinic"} /></label>
        {kidsMode && <ChildPicker kids={kids} label="Which children?" />}
        <div className="two">
          <label className="fl">Date<input type="date" name="date" defaultValue={addDays(today(), 7)} required /></label>
          <label className="fl">Time<input type="time" name="time" /></label>
        </div>
        {kidsMode && <label className="fl">Ends (for several days, like half term)<input type="date" name="end_date" /></label>}
        <label className="fl">Where?<input name="location" placeholder="e.g. Northampton General Hospital" /></label>
        <label className="fl">Who&apos;s going?<input name="attending" placeholder={kidsMode ? "e.g. Alfie and Mum" : `e.g. ${p} and Sarah`} /></label>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>{kidsMode ? "Does someone need to take them?" : `Does ${p} need transport?`}</legend>
          <div className="choice">
            <label><input type="radio" name="needs_transport" value="yes" defaultChecked={!kidsMode} /><span>Yes</span></label>
            <label><input type="radio" name="needs_transport" value="no" defaultChecked={kidsMode} /><span>No</span></label>
          </div>
          <span className="note">{kidsMode ? "If yes, KIN asks the family who can take them." : <>If yes, KIN adds a &ldquo;Who can drive?&rdquo; task for the family.</>}</span>
        </fieldset>
        <label className="fl">Notes<textarea name="notes" placeholder="e.g. Bring the blue folder" /></label>
        {kidsMode && <label className="checkline"><input type="checkbox" name="share_with_helpers" /> Show to childminders too (useful for INSET days and holidays)</label>}
        {kidsMode && <label className="checkline"><input type="checkbox" name="private" /> Parents only (hidden from the children, grandparents and childminders)</label>}
        <button className="btn primary block">{kidsMode ? "Add event" : "Add appointment"}</button>
      </form>
    </main>
  );
}
