import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, type Child } from "@/lib/kin";
import { Hidden, Notice } from "@/components/ui";
import KidWeek from "@/components/KidWeek";
import CopyButton from "@/components/CopyButton";
import { kidWeek } from "@/lib/kidweek";
import { site } from "@/lib/notify";
import { createScreen, revokeScreen } from "../../actions";

export default async function ChildView({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, nameOf } = await getCircle(id);
  if (circle.kind !== "children") return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>This view is for families with children.</p></main>;
  const { data: kids } = await supabase.from("children").select("*").eq("circle_id", id).order("sort");
  const children = (kids || []) as Child[];
  const child = children.find((k) => k.id === sp.child) || children[0];
  if (!child) return <main className="page"><Link href={`/c/${id}`} className="link">‹ Home</Link><p>Add a child first.</p></main>;
  const days = await kidWeek(supabase, id, child.id, 7, (u) => (nameOf(u) === "You" ? "You" : nameOf(u)));
  const parent = canEdit(role);
  const { data: screens } = parent ? await supabase.from("child_screens").select("token, created_at").eq("circle_id", id).eq("child_id", child.id).eq("revoked", false) : { data: null };
  return (
    <main className="page">
      <Link href={`/c/${id}`} className="link">‹ Home</Link>
      <Notice sp={sp} />
      <h1>{child.first_name}&apos;s week</h1>
      {children.length > 1 && <div className="row">{children.map((k) => <Link key={k.id} href={`/c/${id}/children/view?child=${k.id}`} className={`btn sm${k.id === child.id ? " primary" : ""}`}>{k.first_name}</Link>)}</div>}
      <KidWeek name={child.first_name} days={days} />
      {parent && (
        <section className="card pad stack">
          <h2>Put this on a tablet at home</h2>
          <p className="small">Make a private link that shows {child.first_name} just this week view, with no sign-in. It shows first names, the homes and what&apos;s on, and nothing else. You can switch it off at any time.</p>
          {(screens || []).map((sc) => {
            const url = `${site()}/screen/${sc.token}`;
            return (
              <div key={sc.token} className="stack" style={{ gap: 8 }}>
                <div className="copybox">{url}</div>
                <div className="row"><CopyButton text={url} />
                  <form action={revokeScreen}><Hidden circle={id} /><input type="hidden" name="token" value={sc.token} /><input type="hidden" name="child" value={child.id} /><button className="btn sm">Switch this link off</button></form></div>
              </div>
            );
          })}
          {!screens?.length && <form action={createScreen}><Hidden circle={id} /><input type="hidden" name="child" value={child.id} /><button className="btn primary">Make a tablet link</button></form>}
        </section>
      )}
    </main>
  );
}
