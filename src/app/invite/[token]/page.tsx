import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { roleDesc, roleLabel, type Kind, type Role } from "@/lib/kin";
import Wordmark from "@/components/Wordmark";

async function accept(formData: FormData) {
  "use server";
  const token = String(formData.get("token"));
  const { supabase } = await getUser();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) redirect(`/invite/${token}?error=${encodeURIComponent(error.message)}`);
  redirect(`/c/${data}`);
}

export default async function Invite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  const { data } = await supabase.rpc("invitation_preview", { p_token: token });
  const inv = (data || [])[0] as { person: string; inviter: string; role: Role; name: string; valid: boolean; kind: Kind } | undefined;
  const here = `/invite/${token}`;
  return (
    <main className="page" style={{ maxWidth: 460 }}>
      <span className="brand"><Wordmark /></span>
      {!inv || !inv.valid ? (
        <>
          <h1>This invitation has expired</h1>
          <p className="muted">Ask the person who invited you to send a new link.</p>
        </>
      ) : (
        <>
          <h1>{inv.inviter?.split(" ")[0] || "Someone"} has invited you to {inv.kind === "children" ? "help with the children on KIN" : `help with ${inv.person}`}</h1>
          <div className="card pad">
            <span className="label">Your access</span>
            <b>{roleLabel(inv.role, inv.kind)}</b>
            <p className="small muted">{roleDesc(inv.role, inv.kind)}</p>
          </div>
          {sp.error && <p className="error">{sp.error}</p>}
          {user ? (
            <form action={accept}>
              <input type="hidden" name="token" value={token} />
              <button className="btn primary block">{inv.kind === "children" ? "Join the family" : "Join the Care Circle"}</button>
            </form>
          ) : (
            <div className="stack">
              <Link className="btn primary block" href={`/signup?next=${encodeURIComponent(here)}`}>Create an account to join</Link>
              <Link className="btn block" href={`/login?next=${encodeURIComponent(here)}`}>I already have an account</Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
