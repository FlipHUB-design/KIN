import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCircle, getUser } from "@/lib/data";
import { canEdit } from "@/lib/kin";
import { HELPFUL } from "@/lib/helpful";
import { helpfulOn } from "@/lib/helpful-server";
import { Disclosure } from "@/components/Helpful";
import { Notice } from "@/components/ui";

async function setHidden(f: FormData) {
  "use server";
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const hide = f.get("hide") === "1";
  await supabase.from("profiles").update({ hide_helpful: hide }).eq("id", user.id);
  revalidatePath("/c", "layout");
  redirect(`/c/${String(f.get("circle"))}/helpful?notice=${encodeURIComponent(hide ? "Suggestions hidden around the app" : "Suggestions shown again")}`);
}

/** All the "Helpful things" lists for this kind of family. */
export default async function HelpfulPage({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, role, user } = await getCircle(id);
  if (!canEdit(role) || !(await helpfulOn())) notFound();
  const kind = circle.kind === "children" ? "children" : "care";
  const { data: me } = await supabase.from("profiles").select("hide_helpful").eq("id", user.id).maybeSingle();
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Helpful things</h1>
      <p className="muted">Practical things other families find useful{kind === "care" ? " when looking after someone at home" : " when children live across two homes"}. Only you and other parents or organisers see these.</p>
      <Notice sp={sp} />
      {HELPFUL.filter((l) => l.kind === kind).map((l) => (
        <section key={l.id} id={l.id} className="card pad helpful">
          <h2 style={{ margin: 0 }}>{l.title}</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>{l.intro}</p>
          <ul className="hf-list">
            {l.items.map((i) => (
              <li key={i.id}>
                <a href={`/api/helpful/${i.id}?p=page`} target="_blank" rel="noopener sponsored">{i.name} ↗</a>
                <span className="small muted">{i.why}</span>
                {i.note && <span className="small hf-note">{i.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Disclosure />
      <form action={setHidden} className="row">
        <input type="hidden" name="circle" value={id} />
        <input type="hidden" name="hide" value={me?.hide_helpful ? "0" : "1"} />
        <button className="btn sm">{me?.hide_helpful ? "Show suggestions around the app again" : "Hide suggestions around the app"}</button>
      </form>
    </main>
  );
}
