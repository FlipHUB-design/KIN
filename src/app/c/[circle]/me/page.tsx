import Link from "next/link";
import { getCircle } from "@/lib/data";
import { dayLabel, hm, today, type Appointment } from "@/lib/kin";

export default async function Me({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { supabase, circle, nameOf, role } = await getCircle(id);
  const [{ data: appts }, { data: person }, { data: visit }] = await Promise.all([
    supabase.from("appointments").select("*").eq("circle_id", id).gte("date", today()).order("date").limit(10),
    supabase.from("person_profiles").select("*").eq("circle_id", id).maybeSingle(),
    supabase.from("visit_info").select("address").eq("circle_id", id).maybeSingle(),
  ]);
  return (
    <main className={`page ${role === "supported" ? "sp" : ""}`}>
      <Link href={`/c/${id}`} className="link">‹ Back</Link>
      <h1>My information</h1>
      <div className="card"><dl className="kv">
        <dt>Name</dt><dd>{circle.person_name}</dd>
        <dt>Address</dt><dd>{visit?.address || "Not added"}</dd>
        <dt>Phone</dt><dd>{person?.phone || "Not added"}</dd>
      </dl></div>
      <p className="note">You decide what your family can see. Ask your family administrator to change anything.</p>
      <h2 id="appointments">My appointments</h2>
      <div className="stack">
        {((appts || []) as Appointment[]).map((a) => (
          <div key={a.id} className="card pad">
            <b>{dayLabel(a.date)}{a.time ? `, ${hm(a.time)}` : ""}</b>
            <div>{a.title}{a.location ? `, ${a.location}` : ""}</div>
            {a.driver && <div className="muted">{nameOf(a.driver)} is driving you</div>}
          </div>
        ))}
        {!appts?.length && <p className="muted">No appointments booked.</p>}
      </div>
    </main>
  );
}
