import Link from "next/link";
import { getCircle } from "@/lib/data";

export default async function Help({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { members, role } = await getCircle(id);
  const fam = members.filter((m) => ["admin", "family"].includes(m.role) && m.status === "active");
  return (
    <main className={`page ${role === "supported" ? "sp" : ""}`}>
      <Link href={`/c/${id}`} className="link">‹ Back</Link>
      <h1>Getting help</h1>
      <div className="emerg">
        <a href="tel:999" className="ebox e999"><span>Emergency</span><b>999</b><span className="small">If someone is in danger</span></a>
        <a href="tel:111" className="ebox e111"><span>Medical advice</span><b>111</b><span className="small">NHS 111, day or night</span></a>
      </div>
      <h2>Your family</h2>
      <div className="stack">
        {fam.map((m) => (
          <div key={m.user_id} className="card pad" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <div><b>{m.profiles?.display_name}</b><div className="small muted">{m.relationship}</div></div>
            {m.profiles?.phone ? <a className="btn primary phone" href={`tel:${m.profiles.phone.replace(/\s/g, "")}`}>{m.profiles.phone}</a> : <span className="small muted">No number added</span>}
          </div>
        ))}
      </div>
    </main>
  );
}
