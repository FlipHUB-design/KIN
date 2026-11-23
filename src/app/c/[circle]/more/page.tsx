import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, isInner } from "@/lib/kin";
import { Header } from "@/components/ui";
import { helpfulOn } from "@/lib/helpful-server";

export default async function More({ params }: { params: Promise<{ circle: string }> }) {
  const { circle: id } = await params;
  const { circle, role, me } = await getCircle(id);
  const kids = circle.kind === "children";
  const parent = canEdit(role);
  const helpful = parent && (await helpfulOn());
  type It = [string, string, string, boolean];
  const groups: [string, It[]][] = kids ? [
    ["Day to day", [
      ["../schedule", "Schedule", "Where the children sleep each night, and swap requests", true],
      ["../handover", "Handover", "Packing checklist and handover notes", true],
      ["../schedule/holidays", "Holidays and special days", "Christmas, Easter, birthdays and school holidays, planned early", parent],
      ["../children", "Children", "School, allergies, sizes, passports and where things are", true],
      ["../medications", "Medicines", "What each child takes, and repeat prescriptions", isInner(role, circle.kind)],
      ["../children/view", "Children's picture view", "A simple week in pictures for a home tablet", parent],
    ]],
    ["Money and agreements", [
      ["../costs", "Costs", "Shared costs, approvals and child maintenance", parent],
      ["../agreements", "Agreements", "Bedtimes, screens, money and holidays, agreed once", true],
      ["../records", "Records", "A dated history you can download", parent],
    ]],
    ["Paperwork and contacts", [
      ["../letters", "School letters", "Photograph a letter and Many Hands suggests the tasks", parent],
      ["documents", "Documents", "Birth certificates, school reports, forms", isInner(role, circle.kind)],
      ["contacts", "Contacts", "School, GP, dentist, clubs and who can collect", true],
      ["../playbooks", "Playbooks", "School places, passports, travel abroad, childcare and more", true],
      ["../helpful", "Helpful things", "Two-home essentials and back-to-school ideas", helpful],
    ]],
    ["Settings and history", [
      ["../alerts", "Alerts", "Requests and news for you, and how you get them by email or text", true],
      ["../schedule/settings", "Family settings", "Homes, usual pattern, packing list and cost split", parent],
      ["activity", "Activity", "Everything that has happened", true],
      ["audit", "Access log", "Access changes and document views", role === "admin"],
    ]],
  ] : [
    ["Care", [
      ["../rota", "Care rota", "Who's visiting when, and the days nobody has covered yet", true],
      ["../medications", "Medications", "The medication list and repeat prescription reminders", isInner(role)],
      ["../wellbeing", `How ${circle.preferred_name}'s been`, "The daily check-in answers over recent weeks", isInner(role) && role !== "supported"],
    ]],
    ["Paperwork and money", [
      ["../letters", "Letters", "Photograph a letter and Many Hands suggests the tasks", parent],
      ["documents", "Documents", "Letters, policies and warranties", isInner(role)],
      ["../costs", "Shared costs", "Who paid for what, and who owes whom", parent],
      ["../playbooks", "Playbooks", "Step-by-step plans: Attendance Allowance, hospital discharge and more", true],
      ["../helpful", "Helpful things", "Practical things for coming home from hospital and staying safe at home", helpful],
    ]],
    ["Home and contacts", [
      ["contacts", "Important contacts", "GP, pharmacy, neighbours and trades", true],
      ["home", "Home and maintenance", "Boiler, insurance, appliances and service dates", isInner(role)],
    ]],
    ["Settings and history", [
      ["../alerts", "Alerts", "Jobs and news for you, and how you get them by email or text", true],
      ["settings", `${circle.preferred_name}'s details`, "Profile, address, access and check-in routine", parent],
      ["activity", "Activity", "Everything that has happened", true],
      ["audit", "Access log", "Access changes, personal details and document views", role === "admin"],
    ]],
  ];
  const href = (k: string) => (k.startsWith("../") ? `/c/${id}/${k.slice(3)}` : `/c/${id}/more/${k}`);
  const Row = ({ k, l, s }: { k: string; l: string; s: string }) => (
    <Link href={k.startsWith("/") ? k : href(k)} className="item"><span className="main"><span className="t">{l}</span><span className="s">{s}</span></span><span className="muted">›</span></Link>
  );
  return (
    <main className="page">
      <Header title="More" sub={circle.person_name} initial={(me.profiles?.display_name || "?")[0]} />
      <Link href={href("emergency")} className="card item emergency-link">
        <span className="main"><span className="t">Emergency information</span><span className="s">{kids ? "999, NHS 111, allergies and who to call" : "999, NHS 111 and details for responders"}</span></span><span>›</span>
      </Link>
      {groups.map(([title, list]) => {
        const shown = list.filter((i) => i[3]);
        if (!shown.length) return null;
        return (
          <section key={title} className="stack" style={{ gap: 8 }}>
            <h2 className="label">{title}</h2>
            <div className="card list">{shown.map(([k, l, d]) => <Row key={k} k={k} l={l} s={d} />)}</div>
          </section>
        );
      })}
      <section className="stack" style={{ gap: 8 }}>
        <h2 className="label">You</h2>
        <div className="card list">
          <Row k={`/ask?c=${id}`} l="Ask Many Hands" s="Help with how to do something" />
          <Row k="/circles" l={kids ? "Switch family" : "People I help"} s="Switch to another family or Care Circle, or start a new one" />
          <Row k="/account" l="Your account" s="Name, phone, password, calendar sync, your data" />
        </div>
      </section>
      <p className="disclaimer">{kids
        ? "Many Hands helps families organise. It isn't legal advice and doesn't replace a court order, mediation or professional support."
        : "Many Hands is a coordination tool for families. It isn't a medical service, doesn't monitor health, and doesn't replace the NHS App, a GP or professional care."}</p>
    </main>
  );
}
