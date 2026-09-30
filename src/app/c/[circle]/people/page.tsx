import Link from "next/link";
import { getCircle } from "@/lib/data";
import { ROLE_DESC, ROLE_LABEL, when, type Role } from "@/lib/kin";
import { Header, Hidden, Notice } from "@/components/ui";
import { changeMember, revokeInvite } from "../actions";

export default async function People({ params, searchParams }: { params: Promise<{ circle: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle: id } = await params;
  const sp = await searchParams;
  const { supabase, circle, members, role, user, me } = await getCircle(id);
  const admin = role === "admin";
  const { data: invites } = admin
    ? await supabase.from("invitations").select("*").eq("circle_id", id).is("accepted_at", null).eq("revoked", false).gt("expires_at", new Date().toISOString())
    : { data: [] };
  return (
    <main className="page">
      <Header title="Care Circle" sub={`Everyone who helps ${circle.preferred_name}`} initial={(me.profiles?.display_name || "?")[0]} />
      {sp.welcome && <p className="ok">Your Care Circle for {circle.preferred_name} is ready. Next, invite the people who help.</p>}
      <Notice sp={sp} />
      <div className="card list">
        {members.map((m) => {
          const self = m.user_id === user.id;
          const manage = admin && !self;
          return (
            <div key={m.user_id} className="member">
              <span className="avatar">{(m.profiles?.display_name || "?")[0]}</span>
              <div className="main">
                <div><b>{m.profiles?.display_name}</b>{self && " (you)"} <span className="muted">· {m.relationship}</span>
                  {m.status === "paused" && <> <span className="tag over">Access paused</span></>}</div>
                {manage ? (
                  <form action={changeMember} className="row">
                    <Hidden circle={id} /><input type="hidden" name="user" value={m.user_id} /><input type="hidden" name="op" value="role" />
                    <label className="small muted">Access{" "}
                      <select name="role" defaultValue={m.role}>
                        {(["admin", "family", "contributor", "helper", "supported"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select></label>
                    <button className="btn sm">Change</button>
                  </form>
                ) : <span className="small"><b>{ROLE_LABEL[m.role]}</b></span>}
                <span className="small muted">{ROLE_DESC[m.role]}</span>
                <span className="small muted">Last active: {m.last_active_at ? when(m.last_active_at) : "Not yet"}</span>
                {manage && (
                  <div className="row">
                    <form action={changeMember}><Hidden circle={id} /><input type="hidden" name="user" value={m.user_id} />
                      <input type="hidden" name="op" value={m.status === "paused" ? "restore" : "pause"} />
                      <button className="btn sm">{m.status === "paused" ? "Restore access" : "Pause access"}</button></form>
                    <details><summary className="btn sm warn" style={{ listStyle: "none" }}>Remove</summary>
                      <form action={changeMember} className="stack" style={{ marginTop: 8 }}><Hidden circle={id} /><input type="hidden" name="user" value={m.user_id} /><input type="hidden" name="op" value="remove" />
                        <span className="small">Remove {m.profiles?.display_name} from {circle.preferred_name}&apos;s circle?</span>
                        <button className="btn sm warn">Yes, remove</button></form></details>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {admin && (invites || []).length > 0 && (
        <section className="stack"><h2>Waiting to join</h2>
          <div className="card list">{(invites || []).map((i) => (
            <div key={i.id} className="member"><span className="avatar">{i.name[0]}</span><div className="main">
              <b>{i.name}</b><span className="small muted">{ROLE_LABEL[i.role as Role]} · {i.relationship}</span>
              <div className="row"><Link className="btn sm" href={`/c/${id}/people/invite?sent=${i.id}`}>Show link</Link>
                <form action={revokeInvite}><Hidden circle={id} id={i.id} /><button className="btn sm">Cancel invitation</button></form></div>
            </div></div>))}</div>
        </section>
      )}
      {admin && <Link href={`/c/${id}/people/invite`} className="btn primary block">Invite someone</Link>}
      <p className="note">Access rules are checked by the database for every request, so hidden information can&apos;t be reached by changing a link.</p>
    </main>
  );
}
