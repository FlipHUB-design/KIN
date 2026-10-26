import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { site } from "@/lib/notify";

async function makeFeed(formData: FormData) {
  "use server";
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  if (formData.get("reset")) await supabase.from("calendar_feeds").delete().eq("user_id", user.id);
  const { error } = await supabase.from("calendar_feeds").insert({ user_id: user.id });
  if (error && !formData.get("reset") && error.code !== "23505") redirect("/account/calendar?error=" + encodeURIComponent("Calendar sync isn't switched on yet. Please try again later."));
  redirect("/account/calendar?notice=" + encodeURIComponent(formData.get("reset") ? "New link made. The old one has stopped working." : "Your calendar link is ready"));
}

async function stopFeed() {
  "use server";
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  await supabase.from("calendar_feeds").delete().eq("user_id", user.id);
  redirect("/account/calendar?notice=" + encodeURIComponent("Calendar sync stopped"));
}

export default async function CalendarSync({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: feed } = await supabase.from("calendar_feeds").select("token").eq("user_id", user.id).maybeSingle();
  const https = feed ? `${site()}/api/ical/${feed.token}.ics` : "";
  const webcal = https.replace(/^https?:/, "webcal:");
  return (
    <main className="page">
      <Link href="/account" className="link">‹ Your account</Link>
      <h1>Add KIN to your calendar</h1>
      <p className="muted">KIN&apos;s dates appear in your own Google, Apple or Outlook calendar and stay up to date. You&apos;ll see the appointments and dates your role lets you see in each circle, plus jobs you&apos;ve said you&apos;ll do.</p>
      {sp.notice && <p className="ok">{sp.notice}</p>}
      {sp.error && <p className="error">{sp.error}</p>}

      {!feed ? (
        <form action={makeFeed} className="card pad form">
          <p>Make a private link for your calendar app. Only you should have it.</p>
          <button className="btn primary">Make my calendar link</button>
        </form>
      ) : (
        <>
          <div className="card pad form">
            <h2>Your private link</h2>
            <label className="fl">Copy this link<input readOnly value={https} /></label>
            <a href={webcal} className="btn primary">Open in my calendar app</a>
            <p className="small muted">Works straight away on iPhone, iPad and Mac. For Google or Outlook, follow the steps below.</p>
          </div>
          <div className="card pad">
            <h2>Google Calendar</h2>
            <ol className="small">
              <li>On a computer, open Google Calendar.</li>
              <li>Next to <b>Other calendars</b>, press <b>+</b> then <b>From URL</b>.</li>
              <li>Paste your link and press <b>Add calendar</b>.</li>
            </ol>
            <p className="small muted">Google checks for changes a few times a day, so new dates can take a while to appear.</p>
            <h2>Apple Calendar</h2>
            <ol className="small">
              <li>Press <b>Open in my calendar app</b> above, then <b>Subscribe</b>.</li>
              <li>Or on a Mac: <b>File</b> then <b>New Calendar Subscription</b>, and paste your link.</li>
            </ol>
            <h2>Outlook</h2>
            <ol className="small">
              <li>In Outlook on the web, open the calendar and choose <b>Add calendar</b>.</li>
              <li>Choose <b>Subscribe from web</b>, paste your link and give it the name KIN.</li>
            </ol>
          </div>
          <div className="card pad form">
            <h2>Keep it private</h2>
            <p className="small">Anyone with this link can see these dates. If you&apos;ve shared it by mistake, make a new one and the old one stops working.</p>
            <form action={makeFeed}><input type="hidden" name="reset" value="1" /><button className="btn">Make a new link</button></form>
            <form action={stopFeed}><button className="btn warn">Stop calendar sync</button></form>
          </div>
        </>
      )}
    </main>
  );
}
