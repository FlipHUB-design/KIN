import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { DEFAULT_CHANNELS, LEVEL_DESC, LEVEL_LABEL, emailOn, isDemoEmail, mobileNumber, smsOn, type Channels, type Level } from "@/lib/notify";

const LEVELS: Level[] = ["answer", "update", "urgent"];

async function save(f: FormData) {
  "use server";
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const channels = Object.fromEntries(LEVELS.map((l) => [l, { email: f.get(`${l}_email`) === "on", sms: f.get(`${l}_sms`) === "on" }])) as Channels;
  const phone = String(f.get("phone") ?? "").trim();
  const wantsText = LEVELS.some((l) => channels[l].sms);
  if (phone && !mobileNumber(phone)) redirect("/account/alerts?error=" + encodeURIComponent("That doesn't look like a mobile number. Try 07700 900123."));
  const time = (k: string, d: string) => (/^\d{2}:\d{2}$/.test(String(f.get(k))) ? String(f.get(k)) : d);
  await supabase.from("profiles").update({ phone: phone || null }).eq("id", user.id);
  const { error } = await supabase.from("notification_prefs").upsert({
    user_id: user.id, channels, digest: f.get("digest") === "on",
    quiet_start: time("quiet_start", "21:00"), quiet_end: time("quiet_end", "07:00"), updated_at: new Date().toISOString(),
  });
  if (error) redirect("/account/alerts?error=" + encodeURIComponent("Couldn't save. Please try again."));
  redirect("/account/alerts?notice=" + encodeURIComponent(wantsText && !phone ? "Saved. Add your mobile number to get texts." : "Saved"));
}

export default async function Alerts({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const [{ data: prefs }, { data: me }] = await Promise.all([
    supabase.from("notification_prefs").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("phone").eq("id", user.id).single(),
  ]);
  const ch: Channels = { ...DEFAULT_CHANNELS, ...(prefs?.channels || {}) };
  const demo = isDemoEmail(user.email);
  return (
    <main className="page">
      <Link href="/account" className="link">‹ Your account</Link>
      <h1>Alerts</h1>
      <p className="muted">Choose how KIN tells you about things. Everything also appears on the Alerts page inside each family or Care Circle.</p>
      {sp.notice && <p className="ok">{sp.notice}</p>}
      {sp.error && <p className="error">{sp.error}</p>}
      {demo && <p className="note">Demo accounts never send real emails or texts. You can still try the settings.</p>}
      {!demo && (!emailOn() || !smsOn()) && (
        <p className="note">{!emailOn() && !smsOn() ? "Email and text sending aren't switched on for this KIN site yet." : !emailOn() ? "Email sending isn't switched on for this KIN site yet." : "Text sending isn't switched on for this KIN site yet."} Your choices are saved and will apply once they are.</p>
      )}
      <form action={save} className="form">
        <div className="card pad">
          <table className="alertgrid">
            <thead><tr><th scope="col"><span className="sr-only">Kind of alert</span></th><th scope="col">Email</th><th scope="col">Text</th></tr></thead>
            <tbody>
              {LEVELS.map((l) => (
                <tr key={l}>
                  <th scope="row"><b>{LEVEL_LABEL[l]}</b><span className="small muted">{LEVEL_DESC[l]}</span></th>
                  <td><input type="checkbox" name={`${l}_email`} defaultChecked={ch[l].email} aria-label={`${LEVEL_LABEL[l]} by email`} /></td>
                  <td><input type="checkbox" name={`${l}_sms`} defaultChecked={ch[l].sms} aria-label={`${LEVEL_LABEL[l]} by text`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="fl">Mobile number for texts<input name="phone" type="tel" defaultValue={me?.phone || ""} placeholder="e.g. 07700 900123" />
          <span className="note">Also shown to people in your families and Care Circles so they can reach you.</span></label>
        <div className="two">
          <label className="fl">No texts after<input type="time" name="quiet_start" defaultValue={String(prefs?.quiet_start || "21:00").slice(0, 5)} /></label>
          <label className="fl">Until<input type="time" name="quiet_end" defaultValue={String(prefs?.quiet_end || "07:00").slice(0, 5)} /></label>
        </div>
        <p className="note">Urgent alerts are always texted, even in quiet hours, if you&apos;ve turned texts on for them. You still get the email and the alert in KIN.</p>
        <label className="checkline"><input type="checkbox" name="digest" defaultChecked={prefs?.digest ?? true} /> <span>Morning email: what&apos;s on today, and anything waiting for you</span></label>
        <button className="btn primary block">Save</button>
      </form>
    </main>
  );
}
