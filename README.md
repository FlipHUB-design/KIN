# KIN

**Know what's happening. Know what needs doing. Know who's doing it.**

KIN is a private family coordination app for supporting an ageing parent or relative. A family creates a Care Circle around one person, invites relatives and helpers with the right level of access, and shares visits, lifts to appointments, household jobs, contacts and documents in one place.

KIN is not a medical app. It doesn't diagnose, monitor health or contact emergency services.

## What's in this first version

- Accounts: sign up, sign in, password reset, data download, account deletion
- Care Circles: create a circle, invite people by link, five roles (administrator, family member, contributor, helper, supported person), change access, pause or remove someone
- Home dashboard: coordination status (all good, attention needed, urgent family action), today, needs attention, next two weeks, family workload, recent activity
- Tasks: categories, due dates and times, repeating tasks, "I'll do it", hand back, mark done, comments, family-only tasks
- Appointments: "Does Mum need transport?" creates a driving task, and the appointment shows who's driving
- Check-ins: check in and out, how they are, notes, missed check-in banner with "mark as expected"
- Calendar: day, week and month views
- Contacts, emergency information (999 and NHS 111 always shown), home and maintenance record, documents (PDFs and photos, private storage), activity timeline, access log
- Simplified large-text screen for the supported person, with "How are you today?" and "I need help"
- Restricted screen for helpers: only their visits, the address, how to get in and one contact

Permissions are enforced by the database (Supabase row-level security), not just hidden on screen. `npm run test:db` runs 51 checks, for example that a cleaner can't see appointments, a contributor can't see family-only tasks, and an outsider can't see anything by changing a link.

### Letter reading, playbooks and shared costs

- **Letters:** photograph a letter and KIN suggests tasks with deadlines. Nothing is added until someone confirms. To switch on automatic reading, create an API key at [console.anthropic.com](https://console.anthropic.com) and add it in Vercel as `ANTHROPIC_API_KEY`, then redeploy. Without it, letters are still saved to Documents and the sample letter still works.
- **Playbooks:** Attendance Allowance, coming home from hospital, Blue Badge, lasting power of attorney, council tax discounts, and after a death. Each step links to GOV.UK or NHS.uk. Review them every few months, because rules change. They live in `src/lib/playbooks.ts`.
- **Shared costs:** who paid for what and the fewest payments to settle up. Visible to administrators and family only.

The database changes for these are in `supabase/migrations/0002_letters_playbooks_costs.sql`, which runs after 0001.

### KIN for children and co-parents

A family can be set up for **children** instead of an older relative (choose when you start). Everything above still works, plus:

- **Two homes and a schedule:** add both homes, pick a usual pattern (2-2-5-5, 2-2-3, week on/week off, every other weekend) and fine-tune any night. Everyone sees where the children sleep tonight, colour-coded on Home and the calendar.
- **Swap requests:** a parent asks for a change with a reason and an offer in return; another parent agrees or says no. Nothing changes until it's agreed. Grandparents, childminders and the children see the result, not the reasons.
- **Handovers:** a packing list, a record of what went and what was missing, and notes for the other home.
- **Children:** school, class, allergies and important notes (shared with childminders), sizes, GP, dentist and passport expiry with a renewal reminder. **Where is it?** tracks passports, PE kits and chargers between homes.
- **Agreements:** bedtimes, screens, money and holidays, agreed once by both parents. Shared rules show to grandparents, childminders and the children.
- **Costs:** an agreed split (for example 50/50 or 60/40), approvals from the other parent, queries, spend per child, and a separate child maintenance record.
- **Records:** a dated history of requests, answers, costs and handovers, downloadable as a CSV for mediation.
- **Views for everyone:** grandparents see the schedule and their tasks; childminders see pick-ups, which home to drop off at, allergies and dates shared with them; a 13+ young person gets their own simple view with what to pack, house rules, a way to message their parents and Childline's number.
- **Children's playbooks:** child passports, taking children abroad, school places, childcare costs, a new baby, making arrangements after separating, and school holidays.

The database changes are in `supabase/migrations/0003_children_coparenting.sql`. Run it after 0002.

### Not built yet

Email and push notifications, the missed check-in escalation chain (notify Sarah, then Anthony), medication reminders, shopping lists, meals, the AI assistant, two-factor sign-in. The database is ready to grow into these.

---

## Getting it running (step by step)

You'll need three free accounts: **GitHub** (the code is already here), **Supabase** (database, sign-in and file storage) and **Vercel** (hosts the website). Allow about 30 minutes. Menu names below may shift slightly as those services update their dashboards.

### 1. Create the database on Supabase

1. Go to [supabase.com](https://supabase.com), sign up and click **New project**.
2. Name it `kin`, set a strong database password (save it in a password manager), and choose the **London** region so data stays in the UK.
3. Wait a couple of minutes while it sets up.
4. In the left menu open **SQL Editor**, click **New query**.
5. In this GitHub repository, open `supabase/migrations/0001_kin_schema.sql`, click **Raw**, select everything and copy it.
6. Paste it into the Supabase SQL editor and click **Run**. You should see "Success. No rows returned".

### 2. Copy your Supabase keys

In Supabase open **Project Settings → API** (sometimes shown as **API Keys** or **Data API**). Keep this tab open. You'll need:

- **Project URL** (looks like `https://abcd1234.supabase.co`)
- **anon / public key**
- **service_role key** (keep this one secret; it's only used on the server to delete accounts)

### 3. Put the website online with Vercel

1. Go to [vercel.com](https://vercel.com) and **sign up with GitHub**.
2. Click **Add New → Project**, find **KIN** in your repositories and click **Import**. (If it isn't listed, click the link to adjust GitHub app permissions and allow access to the repository.)
3. Open **Environment Variables** and add these four, one at a time:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
   | `NEXT_PUBLIC_SITE_URL` | leave as `https://example.com` for now |

4. Click **Deploy**. After a minute or two you'll get a web address like `https://kin-abc123.vercel.app`.
5. Back in Vercel go to **Settings → Environment Variables**, change `NEXT_PUBLIC_SITE_URL` to that address (no slash at the end), then go to **Deployments**, click the **⋯** menu on the latest one and choose **Redeploy**.

### 4. Tell Supabase where the site lives

In Supabase open **Authentication → URL Configuration**:

- **Site URL**: your Vercel address, e.g. `https://kin-abc123.vercel.app`
- **Redirect URLs**: add `https://kin-abc123.vercel.app/auth/callback`

Save. Sign-up confirmation and password-reset emails will now link back to your site.

### 5. Try it

Open your Vercel address, create an account, confirm your email, and start a Care Circle. Use **People → Invite someone** to create an invitation link, open it in a private browser window and sign up as a second person to see the other roles.

---

## Before real families use it

This app will hold personal and health-related information, which is special category data under UK GDPR. Before launch:

- **Register with the ICO** and pay the data protection fee.
- **Write a data protection impact assessment (DPIA).** It's expected for health-related data.
- **Have the privacy notice reviewed.** `/privacy` is a starting draft, not legal text.
- **Set up your own email sending** in Supabase (**Authentication → Emails → SMTP settings**, using a provider such as Resend or Postmark). Supabase's built-in email is heavily rate-limited and meant for testing.
- **Move Supabase to a paid plan** for daily backups and no project pausing.
- **Turn on leaked-password protection** in Supabase's authentication settings if your plan offers it.

## Working on the code on your own computer (optional)

1. Install [Node.js](https://nodejs.org) (the LTS version).
2. Download the code: on this GitHub page click **Code → Download ZIP**, and unzip it.
3. Open a terminal in that folder and run `npm install`.
4. Copy `.env.example` to a new file called `.env.local` and fill in your Supabase values, with `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
5. In Supabase, add `http://localhost:3000/auth/callback` to the Redirect URLs.
6. Run `npm run dev` and open http://localhost:3000.

Useful commands: `npm run build` (check everything compiles), `npm run lint`, `npm run test:db` (permission tests).

## How the code is organised

- `supabase/migrations/0001_kin_schema.sql`: all tables, permission rules and database functions
- `supabase/tests/permissions.test.mjs`: permission tests
- `src/app/c/[circle]/`: every screen inside a Care Circle (home, calendar, tasks, people, more)
- `src/app/c/[circle]/actions.ts`: everything that changes data
- `src/lib/kin.ts`: shared labels, dates (UK time) and the dashboard status rules
- `src/app/globals.css`: colours, type and layout
