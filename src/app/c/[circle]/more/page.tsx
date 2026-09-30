import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, isInner } from "@/lib/kin";
import { Header } from "@/components/ui";

export default async function More({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { circle, role, me } = await getCircle(id);
  const items: [string, string, string, boolean][] = [
    ["../letters", "Letters", "Photograph a letter and KIN suggests the tasks", canEdit(role)],
    ["../playbooks", "Playbooks", "Step-by-step plans: Attendance Allowance, hospital discharge and more", true],
    ["../costs", "Shared costs", "Who paid for what, and who owes whom", canEdit(role)],
    ["emergency", "Emergency information", "999, NHS 111 and details for responders", true],
    ["contacts", "Important contacts", "GP, pharmacy, neighbours and trades", true],
    ["home", "Home and maintenance", "Boiler, insurance, appliances and service dates", isInner(role)],
    ["documents", "Documents", "Letters, policies and warranties", isInner(role)],
    ["activity", "Activity", "Everything that has happened", true],
    ["settings", `${circle.preferred_name}'s details`, "Profile, address, access and check-in routine", canEdit(role)],
    ["audit", "Access log", "Access changes, personal details and document views", role === "admin"],
  ];
  return (
    <main className="page">
      <Header title="More" sub={circle.person_name} initial={(me.profiles?.display_name || "?")[0]} />
      <div className="card list">
        {items.filter((i) => i[3]).map(([k, l, s]) => (
          <Link key={k} href={k.startsWith("../") ? `/c/${id}/${k.slice(3)}` : `/c/${id}/more/${k}`} className="item"><span className="main"><span className="t">{l}</span><span className="s">{s}</span></span><span className="muted">›</span></Link>
        ))}
        <Link href="/circles" className="item"><span className="main"><span className="t">People I help</span><span className="s">Switch Care Circle or start a new one</span></span><span className="muted">›</span></Link>
        <Link href="/account" className="item"><span className="main"><span className="t">Your account</span><span className="s">Name, phone, password, your data</span></span><span className="muted">›</span></Link>
      </div>
      <p className="disclaimer">KIN is a coordination tool for families. It isn&apos;t a medical service, doesn&apos;t monitor health, and doesn&apos;t replace the NHS App, a GP or professional care.</p>
    </main>
  );
}
