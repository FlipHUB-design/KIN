/** Before launch, new accounts are closed: people join the waiting list instead.
 *  Family members invited to an existing circle can still create an account.
 *  Set SIGNUPS_OPEN=true in Vercel to open registration to everyone. */
export const signupsOpen = () => process.env.SIGNUPS_OPEN === "true";
export const canRegister = (next?: string | null) => signupsOpen() || (!!next && next.startsWith("/invite/"));
export const registerHref = (next?: string | null, from = "signup") =>
  canRegister(next) ? `/signup${next ? `?next=${encodeURIComponent(next)}` : ""}` : `/waitlist?from=${from}`;
