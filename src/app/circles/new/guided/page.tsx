import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { aiOn } from "@/lib/ai";
import { addDays, today } from "@/lib/kin";
import Wizard from "./Wizard";

export default async function Guided({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { user } = await getUser();
  if (!user) redirect("/login?next=/circles/new");
  const kind = sp.kind === "children" ? "children" : sp.kind === "care" ? "care" : null;
  if (!kind) redirect("/circles/new");
  const t = today();
  const monday = addDays(t, -((new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7));
  return (
    <>
      <Wizard kind={kind} monday={monday} aiReady={aiOn()} />
      <p className="page note" style={{ paddingTop: 0 }}>Prefer a short form? <Link href={`/circles/new?kind=${kind}`} className="link">Set up with the basics only</Link></p>
    </>
  );
}
