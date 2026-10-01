import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, isInner } from "@/lib/kin";
import { Header } from "@/components/ui";

export default async function More({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { circle, role, me } = await getCircle(id);
  const kids = circle.kind === "children";
  const parent = canEdit(role);
  const items: [string, string, string, boolean][] = kids ? [
    ["../schedule", "Schedule", "Where the children sleep each night, and swap requests", true],
    ["../handover", "Handover", "Packing checklist and handover notes", true],
    ["../children", "Children", "School, allergies, sizes, passports and where things are", true],
    ["../costs", "Costs", "Shared costs, approvals and child maintenance", parent],
    ["../agreements", "Agreements", "Bedtimes, screens, money and holidays, agreed once", true],
    ["../letters", "School letters", "Photograph a letter and KIN suggests the tasks", parent],
    ["../playbooks", "Playbooks", "School places, passports, travel abroad, childcare and more", true],
    ["../records", "Records", "A dated history you can download", parent],
    ["contacts", "Contacts", "School, GP, dentist, clubs and who can collect", true],
    ["emergency", "Emergency information", "999, NHS 111, allergies and who to call", true],
    ["documents", "Documents", "Birth certificates, school reports, forms", isInner(role, circle.kind)],
    ["activity", "Activity", "Everything that has happened", true],
    ["../schedule/settings", "Family settings", "Homes, usual pattern, packing list and cost split", parent],
    ["audit", "Access log", "Access changes and document views", role === "admin"],
  ] : [
    ["../letters", "Letters", "Photograph a letter and KIN suggests the tasks", parent],
    ["../playbooks", "Playbooks", "Step-by-step plans: Attendance Allowance, hospital discharge and more", true],
    ["../costs", "Shared costs", "Who paid for what, and who owes whom", parent],
    ["emergency", "Emergency information", "999, NHS 111 and details for responders", true],
    ["contacts", "Important contacts", "GP, pharmacy, neighbours and trades", true],
    ["home", "Home and maintenance", "Boiler, insurance, appliances and service dates", isInner(role)],
    ["documents", "Documents", "Letters, policies and warranties", isInner(role)],
    ["activity", "Activity", "Everything that has happened", true],
    ["settings", `${circle.preferred_name}'s details`, "Profile, address, access and check-in routine", parent],
    ["audit", "Access log", "Access changes, personal details and document views", role === "admin"],
  ];
  return (
    <main className="page">
      <Header title="More" sub={circle.person_name} initial={(me.profiles?.display_name || "?")[0]} />
      <div className="card list">
        {items.filter((i) => i[3]).map(([k, l, s]) => (
          <Link key={k} href={k.startsWith("../") ? `/c/${id}/${k.slice(3)}` : `/c/${id}/more/${k}`} className="item"><span className="main"><span className="t">{l}</span><span className="s">{s}</span></span><span className="muted">›</span></Link>
        ))}
        <Link href="/circles" className="item"><span className="main"><span className="t">{kids ? "Switch family" : "People I help"}</span><span className="s">Switch to another family or Care Circle, or start a new one</span></span><span className="muted">›</span></Link>
        <Link href="/account" className="item"><span className="main"><span className="t">Your account</span><span className="s">Name, phone, password, your data</span></span><span className="muted">›</span></Link>
      </div>
      <p className="disclaimer">{kids
        ? "KIN helps families organise. It isn't legal advice and doesn't replace a court order, mediation or professional support."
        : "KIN is a coordination tool for families. It isn't a medical service, doesn't monitor health, and doesn't replace the NHS App, a GP or professional care."}</p>
    </main>
  );
}
