import Link from "next/link";
import { getCircle } from "@/lib/data";
import { canEdit, dayLabel, today, when } from "@/lib/kin";
import UploadForm from "@/components/UploadForm";
import { Hidden, Notice } from "@/components/ui";
import { deleteDocument, registerDocument } from "../../actions";

export default async function Documents({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, role, nameOf, user } = await getCircle(id);
  const { data } = await supabase.from("documents").select("*").eq("circle_id", id).order("created_at", { ascending: false });
  const edit = canEdit(role);
  return (
    <main className="page">
      <Link href={`/c/${id}/more`} className="link">‹ More</Link>
      <h1>Documents</h1>
      <Notice sp={sp} />
      <div className="card list">
        {(data || []).map((d) => (
          <div key={d.id} className="item">
            <span className="main">
              <span className="t">{d.name}</span>
              <span className="s">{d.category} · Visible to {d.access === "admins" ? "administrators" : "family"} · Added by {nameOf(d.uploaded_by)} {when(d.created_at).toLowerCase()}</span>
              {d.expiry_date && <span className="s">{d.expiry_date < today() ? <span className="tag over">Expired</span> : "Expires"} {dayLabel(d.expiry_date)}</span>}
              {d.notes && <span className="s">{d.notes}</span>}
            </span>
            <span className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
              <a className="btn sm" href={`/c/${id}/more/documents/${d.id}`} target="_blank" rel="noopener">Open</a>
              {(role === "admin" || d.uploaded_by === user.id) && (
                <details><summary className="link" style={{ listStyle: "none", color: "var(--coral)", fontSize: 14 }}>Delete</summary>
                  <form action={deleteDocument}><Hidden circle={id} id={d.id} /><button className="btn sm warn">Yes, delete</button></form></details>
              )}
            </span>
          </div>
        ))}
        {!data?.length && <p className="empty">No documents yet.</p>}
      </div>
      {role !== "admin" && <p className="note">Some documents may be visible to administrators only.</p>}
      {edit && <UploadForm circle={id} admin={role === "admin"} register={registerDocument} />}
    </main>
  );
}
