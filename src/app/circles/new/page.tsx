import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";

async function create(formData: FormData) {
  "use server";
  const { supabase } = await getUser();
  const person = String(formData.get("person")).trim();
  const preferred = String(formData.get("preferred")).trim() || person.split(" ")[0];
  const { data, error } = await supabase.rpc("create_circle", {
    p_person_name: person,
    p_preferred_name: preferred,
    p_relationship: String(formData.get("relationship")).trim(),
  });
  if (error) redirect("/circles/new?error=" + encodeURIComponent("We couldn't create the circle. Please try again."));
  const checkin = String(formData.get("checkin_by") || "");
  if (checkin) await supabase.from("care_circles").update({ checkin_by: checkin, checkin_note: `Someone usually visits or calls ${preferred} by ${checkin}.` }).eq("id", data);
  await supabase.from("visit_info").update({ address: String(formData.get("address")).trim() || null }).eq("circle_id", data);
  redirect(`/c/${data}/people?welcome=1`);
}

export default async function NewCircle({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <main className="page">
      <Link href="/circles" className="link">‹ Back</Link>
      <h1>Start a Care Circle</h1>
      <p className="muted">A Care Circle is a private space around one person. You can add more detail later.</p>
      {sp.error && <p className="error">{sp.error}</p>}
      <form action={create} className="form">
        <label className="fl">Who are you helping?<input name="person" placeholder="Full name, e.g. Margaret Hale" required /></label>
        <div className="two">
          <label className="fl">What do you call them?<input name="preferred" placeholder="e.g. Mum" /></label>
          <label className="fl">You are their…<input name="relationship" placeholder="e.g. Daughter" required /></label>
        </div>
        <label className="fl">Their address<textarea name="address" placeholder="Shown to anyone who visits, including helpers" /></label>
        <label className="fl">Does someone usually check in by a certain time?
          <input name="checkin_by" type="time" />
          <span className="note">Optional. KIN will show when nobody has checked in by then. It never contacts emergency services.</span>
        </label>
        <button className="btn primary block">Create Care Circle</button>
      </form>
    </main>
  );
}
