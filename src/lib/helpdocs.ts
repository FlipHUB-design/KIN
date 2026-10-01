import type { Kind, Role } from "@/lib/kin";

// What the help chat knows. Keep answers short, plain and true to how the app works.
// "page" is a key from PAGES so answers can link straight to the right screen.

export const PAGES = {
  home: { label: "Home", path: "" },
  calendar: { label: "Calendar", path: "/calendar" },
  tasks: { label: "Tasks", path: "/tasks" },
  newtask: { label: "Add a task", path: "/tasks/new" },
  newappointment: { label: "Add an event", path: "/appointments/new" },
  people: { label: "People", path: "/people" },
  invite: { label: "Invite someone", path: "/people/invite" },
  more: { label: "More", path: "/more" },
  schedule: { label: "Schedule", path: "/schedule" },
  schedulesettings: { label: "Family settings", path: "/schedule/settings" },
  handover: { label: "Handover", path: "/handover" },
  children: { label: "Children", path: "/children" },
  costs: { label: "Costs", path: "/costs" },
  agreements: { label: "Agreements", path: "/agreements" },
  letters: { label: "Letters", path: "/letters" },
  playbooks: { label: "Playbooks", path: "/playbooks" },
  records: { label: "Records", path: "/records" },
  contacts: { label: "Contacts", path: "/more/contacts" },
  emergency: { label: "Emergency information", path: "/more/emergency" },
  documents: { label: "Documents", path: "/more/documents" },
  activity: { label: "Activity", path: "/more/activity" },
  settings: { label: "Circle details", path: "/more/settings" },
  homeinfo: { label: "Home and maintenance", path: "/more/home" },
  checkin: { label: "Check in", path: "/checkin" },
  alerts: { label: "Alerts", path: "/alerts" },
  alertsettings: { label: "Email and text alerts", path: "@/account/alerts" },
  account: { label: "Your account", path: "@/account" },
  newcircle: { label: "Start a new family or Care Circle", path: "@/circles/new" },
  switch: { label: "Switch family or circle", path: "@/circles" },
} as const;
export type PageKey = keyof typeof PAGES;

export const pageHref = (key: string, circleId?: string | null) => {
  const p = PAGES[key as PageKey];
  if (!p) return null;
  if (p.path.startsWith("@")) return p.path.slice(1);
  return circleId ? `/c/${circleId}${p.path}` : null;
};

export type Doc = { id: string; q: string; a: string; words: string; kinds?: Kind[]; roles?: Role[]; pages?: PageKey[] };

const PARENTS: Role[] = ["admin", "family"];

export const DOCS: Doc[] = [
  // ---------------------------------------------------------------- getting started
  { id: "what", q: "What is KIN?", words: "what is kin about app",
    a: "KIN is one shared place for family admin. A Care Circle organises practical support for an older relative: visits, lifts, shopping, paperwork. A family organises children's lives across one or two homes: the schedule, pick-ups, school, clubs and shared costs. Everyone sees only what their role allows." },
  { id: "setup", q: "How do I set up a new family or Care Circle?", words: "set up start create new family circle guided setup add another", pages: ["newcircle"],
    a: "Go to Start a new family or Care Circle. Answer a few easy questions about who it's for, who helps and what a normal week looks like. KIN drafts a setup with jobs, dates, contacts and invitations, and you untick anything you don't want before it's created. You can change all of it afterwards." },
  { id: "switch", q: "How do I switch between families or circles?", words: "switch another family circle more than one several", pages: ["switch"],
    a: "Open More, then Switch family. You can belong to several families and Care Circles with one account." },
  // ---------------------------------------------------------------- people and roles
  { id: "invite", q: "How do I invite someone?", words: "invite add person member join link family helper grandparent childminder", pages: ["invite", "people"],
    a: "Open People, then Invite someone. Choose their name, how they're related and what they can see. If you add their email, KIN emails the link. Otherwise copy the link and send it by text or WhatsApp. Each link works once and expires after 14 days. Only administrators can invite." },
  { id: "roles-care", q: "Who can see what in a Care Circle?", kinds: ["care"], words: "roles access see permissions private administrator family contributor helper supported", pages: ["people"],
    a: "Administrators see and manage everything. Family members see everything and can edit. Contributors, such as grandchildren or friends, see shared jobs and appointments but not private tasks, personal details or emergency medical information. Helpers, such as a cleaner or neighbour, see only their own jobs, the address and how to get in. The supported person gets a simple large-text view of their day." },
  { id: "roles-kids", q: "Who can see what in a family?", kinds: ["children"], words: "roles access see permissions private parent grandparent childminder young person step-parent child", pages: ["people"],
    a: "Parents see everything, answer schedule requests and approve costs. Grandparents and step-parents see the schedule, shared events and jobs, but not money or private items. Childminders see their pick-ups, which home to drop off at, allergies and events shared with them. A young person aged 13 or over gets their own simple view: where they're sleeping, what to pack and what's on. They never see money or parents-only items." },
  { id: "change-role", q: "How do I change someone's access or remove them?", words: "change role access remove pause someone member", roles: ["admin"], pages: ["people"],
    a: "Open People. As an administrator you can change each person's access, pause it for a while, or remove them. Removing someone also removes their alerts from that family or circle." },
  // ---------------------------------------------------------------- tasks and calendar
  { id: "task", q: "How do I add a job or task?", words: "add task job to do create chore reminder", pages: ["newtask", "tasks"],
    a: "Open Tasks and tap Add task. Give it a title, a date and, if you like, a time, a repeat (weekly, monthly and so on) and who's doing it. Leave it unassigned and it shows as \"Who can do this?\" until someone takes it." },
  { id: "claim", q: "How do I take on a job, or hand it back?", words: "claim take on accept job hand back decline can't do", pages: ["tasks"],
    a: "Open the task and tap I'll do it (or I'll drive, for a lift). Everyone can see you're responsible. If plans change, tap I can't do this any more and it goes back to the shared list." },
  { id: "recurring", q: "How do repeating tasks work?", words: "repeat recurring weekly every week monthly next", pages: ["tasks"],
    a: "When you mark a repeating task as done, KIN creates the next one automatically, for the same person, on the next date." },
  { id: "private", q: "Can I keep a task private?", words: "private hidden secret task only family parents", pages: ["newtask"],
    a: "Yes. Tick the private option when adding a task. Private tasks are only seen by administrators and family members (parents, in a family). Contributors, helpers and young people don't see them." },
  { id: "event", q: "How do I add an appointment or event?", words: "add appointment event calendar date hospital school trip club lift driver", pages: ["newappointment", "calendar"],
    a: "Open Calendar and tap Add event (Add appointment in a Care Circle). Add the date and time and, for an appointment, whether someone needs to drive. If a lift is needed, KIN shows it as needing someone until a person takes it. In a family you can choose which children it's for, make it parents-only, or share it with helpers such as a childminder." },
  // ---------------------------------------------------------------- children
  { id: "schedule", q: "How does the schedule work?", kinds: ["children"], words: "schedule where sleep tonight nights pattern rota 2-2-5-5 week on week off homes", pages: ["schedule", "schedulesettings"],
    a: "The schedule shows which home the children sleep at each night, built from your regular pattern (such as 2-2-5-5 or week on, week off). Parents set the homes and pattern in Family settings. Everyone in the family can see where the children are tonight." },
  { id: "swap", q: "How do I ask to swap days?", kinds: ["children"], words: "swap change days nights request schedule weekend holiday exchange", roles: PARENTS, pages: ["schedule"],
    a: "Open Schedule and choose Ask for a change. Pick the dates, which home, a reason and what you offer in return. Nothing changes until another parent agrees. Once agreed, the schedule updates for everyone and the change is kept in Records." },
  { id: "handover", q: "How does the handover checklist work?", kinds: ["children"], words: "handover packing bag checklist forgot kit uniform", pages: ["handover"],
    a: "Before a handover, open Handover and tick what's been packed. Anything unticked is recorded as missing and the other parent gets an alert. Parents can change the checklist in Family settings." },
  { id: "where", q: "How do I keep track of where things are?", kinds: ["children"], words: "where is it lost item coat passport kit which house", pages: ["children"],
    a: "Open Children and use Where is it? to note which home an item is at, such as a passport, school coat or swimming kit." },
  { id: "child-details", q: "Where do I add school, allergy or size details?", kinds: ["children"], words: "school allergy allergies size shoes gp dentist passport details child profile", pages: ["children"],
    a: "Open Children and edit each child's details: school, year, teacher, allergies, important notes, sizes, GP, dentist and passport expiry. Allergies and important notes are shown to everyone in the family, including childminders, so they can keep the children safe." },
  { id: "agreements", q: "What are agreements?", kinds: ["children"], words: "agreement rules bedtime screens phone christmas holidays agreed", pages: ["agreements"],
    a: "Agreements are things parents settle once, such as bedtimes, screen time or Christmas arrangements. One parent proposes, the other agrees or declines, and agreed ones are kept with dates. Parents can choose to share agreed rules with helpers and the children." },
  { id: "young", q: "Can my child have their own account?", kinds: ["children"], words: "child account teenager 13 young person own login phone", pages: ["invite"],
    a: "Yes, from age 13. Invite them with the young person access. They see where they're sleeping, what to pack, their own items and agreed rules. They don't see money, private items or anything only about a brother or sister." },
  // ---------------------------------------------------------------- money
  { id: "costs", q: "How do shared costs work?", words: "costs money expenses split owe balance pay paid receipt", roles: PARENTS, pages: ["costs"],
    a: "Open Costs and add what was spent, who paid and how to split it. KIN keeps a running balance of who owes whom. In a family, a cost the other parent shares waits for their approval and only counts in the balance once approved. They can also query it." },
  { id: "approve", q: "How do I approve or query a cost?", kinds: ["children"], words: "approve query dispute cost expense agree money", roles: PARENTS, pages: ["costs"],
    a: "Costs waiting for you appear on Home under Waiting for your answer, and in Costs. Tap Approve, or Query it with a note if something isn't right. A queried cost doesn't count until it's sorted out." },
  { id: "settle", q: "How do I record a payment or child maintenance?", words: "record payment settle up paid back maintenance child maintenance standing order", roles: PARENTS, pages: ["costs"],
    a: "In Costs, use Record a payment to settle up when someone pays back what they owe. In a family, child maintenance payments are recorded separately in the Maintenance section, so they don't mix with shared costs. KIN records payments. It doesn't move money." },
  { id: "split", q: "Can costs be split unevenly?", words: "split uneven 60 40 percentage share default split", roles: PARENTS, pages: ["costs", "schedulesettings"],
    a: "Yes. When adding a cost, set each person's share. Parents can set a default split for the family in Family settings." },
  // ---------------------------------------------------------------- records, letters, playbooks
  { id: "records", q: "Can I download a record of requests and payments?", kinds: ["children"], words: "records history download csv spreadsheet evidence mediation court log", roles: PARENTS, pages: ["records"],
    a: "Yes. Records keeps a dated history of schedule requests and answers, costs, payments, maintenance, agreements and handovers. Tap Download as a spreadsheet for a CSV file you can keep or share, for example with a mediator." },
  { id: "letters", q: "How does reading a letter work?", words: "letter photo scan read school letter council post suggests tasks ai", roles: PARENTS, pages: ["letters"],
    a: "Open Letters (or School letters) and photograph or upload the letter. KIN's AI helper reads it, summarises it and suggests tasks with deadlines. Nothing is added until you choose which suggestions to keep. The letter is saved in Documents." },
  { id: "playbooks", q: "What are playbooks?", words: "playbook guide step by step attendance allowance passport school place blue badge power of attorney", pages: ["playbooks"],
    a: "Playbooks are step-by-step guides for common UK admin, such as claiming Attendance Allowance, renewing a child's passport or applying for a school place. Start one and its steps become tasks with dates and links to GOV.UK. They're practical checklists, not legal or financial advice." },
  { id: "documents", q: "Where do I keep documents?", words: "documents upload file pdf insurance birth certificate store", pages: ["documents"],
    a: "Open More, then Documents, to upload files. Choose whether each is visible to administrators only or to the whole family. Expiry dates show as reminders." },
  { id: "contacts", q: "Where do I keep important phone numbers?", words: "contacts phone numbers gp school dentist plumber who to call", pages: ["contacts"],
    a: "Open More, then Contacts. Add the GP, school, clubs, trades or anyone else. You can choose whether helpers can see each contact." },
  // ---------------------------------------------------------------- care
  { id: "checkin", q: "What is checking in?", kinds: ["care"], words: "check in visit arrive leave visited mood", pages: ["checkin"],
    a: "When you visit, tap Check in, and Check out when you leave, with a quick note on how things were. The family sees who visited and when. If the circle has a daily check-in time and nobody has checked in by then, KIN shows it on Home. KIN never contacts emergency services." },
  { id: "needhelp", q: "What happens when someone presses I need help?", kinds: ["care"], words: "i need help button urgent emergency alert supported person", pages: ["emergency"],
    a: "The family and administrators get an urgent alert by email and text, if they've turned those on, and it appears in Activity. KIN does not contact emergency services. In an emergency, call 999. For medical advice, call NHS 111." },
  { id: "emergency", q: "Where is the emergency information?", words: "emergency information 999 111 allergies hospital medication responders", pages: ["emergency"],
    a: "Open More, then Emergency information. It shows 999 and NHS 111, and the details responders might need, such as allergies and preferred hospital. Medical details are only visible to administrators and family." },
  // ---------------------------------------------------------------- alerts and account
  { id: "alerts", q: "How do alerts work?", words: "alerts notifications email text sms notify told know", pages: ["alerts", "alertsettings"],
    a: "KIN alerts you when something needs you: a request to answer, a cost to approve, a job given to you, or an answer to your request. Every alert appears on the Alerts page. You choose which also come by email or text in Email and text alerts, under Your account." },
  { id: "quiet", q: "Can I stop texts at night?", words: "quiet hours night texts stop turn off morning email digest", pages: ["alertsettings"],
    a: "Yes. In Email and text alerts, set your quiet hours (9pm to 7am to start with). Texts aren't sent then, except urgent ones if you've turned those on. You can also turn the morning email on or off." },
  { id: "phone", q: "How do I change my name, phone number or password?", words: "change name phone number password account email", pages: ["account"],
    a: "Open Your account to change your name and phone number, or to change your password." },
  { id: "privacy", q: "Is my information private?", words: "private secure safe data gdpr who can see delete export", pages: ["account"],
    a: "Each family or circle is private to its members, and the database itself enforces who can see what, not just the screens. You can download your data or delete your account from Your account." },
  { id: "delete", q: "How do I delete my account?", words: "delete account remove me leave close", pages: ["account"],
    a: "Open Your account and use Delete your account. If you're the only administrator of a family or circle that has other members, make someone else an administrator first." },
  { id: "demo", q: "What is the demo?", words: "demo try example made up", a: "The demo has two made-up families you can explore as different people, to see what each role sees. Demo accounts never send real emails or texts, and the demo resets each day." },
];

export function docsFor(kind?: Kind | null, role?: Role | null) {
  return DOCS.filter((d) => (!d.kinds || !kind || d.kinds.includes(kind)) && (!d.roles || !role || d.roles.includes(role)));
}

/** Simple keyword match, used when the AI helper isn't available. */
export function searchDocs(q: string, docs: Doc[]) {
  const words = q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["how", "the", "can", "and", "what", "does", "for", "with", "you", "are", "who", "this", "that", "where", "when", "why", "our", "get"].includes(w));
  if (!words.length) return [];
  return docs.map((d) => {
    const hay = `${d.q} ${d.words}`.toLowerCase();
    const score = words.reduce((s, w) => s + (hay.includes(w) ? (d.words.includes(w) ? 2 : 1) : w.endsWith("s") && hay.includes(w.slice(0, -1)) ? 1 : 0), 0);
    return { d, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.d);
}
