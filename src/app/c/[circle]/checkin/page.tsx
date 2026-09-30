import { getCircle } from "@/lib/data";
import { nowHM } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import Link from "next/link";
import { checkIn } from "../actions";

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { circle, role } = await getCircle(id);
  const p = circle.preferred_name;
  return (
    <main className="page">
      <Link href={`/c/${id}`} className="link">‹ Home</Link>
      <h1>Check in with {p}</h1>
      <p className="muted">Time: {nowHM()}</p>
      <Notice sp={sp} />
      <form action={checkIn} className="form">
        <Hidden circle={id} />
        {role !== "helper" && (
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 8 }}>How is {p}?</legend>
            <div className="choice">
              {["Good", "OK", "Needs attention"].map((m, i) => (
                <label key={m}><input type="radio" name="mood" value={m} defaultChecked={i === 0} /><span>{m}</span></label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="fl">Add a note (optional)
          <textarea name="note" placeholder={role === "helper" ? "e.g. Kitchen and bathroom done." : "e.g. Had breakfast and is watching television."} />
        </label>
        <p className="note">This is a note for the family, not a health assessment. KIN never records your location.</p>
        <button className="btn primary block">Check in</button>
      </form>
    </main>
  );
}
