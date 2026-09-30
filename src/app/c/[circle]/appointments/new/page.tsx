import Link from "next/link";
import { getCircle } from "@/lib/data";
import { addDays, today } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import { createAppointment } from "../../actions";

export default async function NewAppointment({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { circle } = await getCircle(id);
  const p = circle.preferred_name;
  return (
    <main className="page">
      <Link href={`/c/${id}/calendar`} className="link">‹ Calendar</Link>
      <h1>New appointment</h1>
      <Notice sp={sp} />
      <form action={createAppointment} className="form">
        <Hidden circle={id} />
        <label className="fl">What is it?<input name="title" required maxLength={140} placeholder="e.g. Hearing clinic" /></label>
        <div className="two">
          <label className="fl">Date<input type="date" name="date" defaultValue={addDays(today(), 7)} required /></label>
          <label className="fl">Time<input type="time" name="time" /></label>
        </div>
        <label className="fl">Where?<input name="location" placeholder="e.g. Northampton General Hospital" /></label>
        <label className="fl">Who&apos;s going?<input name="attending" placeholder={`e.g. ${p} and Sarah`} /></label>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>Does {p} need transport?</legend>
          <div className="choice">
            <label><input type="radio" name="needs_transport" value="yes" defaultChecked /><span>Yes</span></label>
            <label><input type="radio" name="needs_transport" value="no" /><span>No</span></label>
          </div>
          <span className="note">If yes, KIN adds a &ldquo;Who can drive?&rdquo; task for the family.</span>
        </fieldset>
        <label className="fl">Notes<textarea name="notes" placeholder="e.g. Bring the blue folder" /></label>
        <button className="btn primary block">Add appointment</button>
      </form>
    </main>
  );
}
