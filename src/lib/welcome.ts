
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CO = [
  ["One schedule, two homes", "Everyone sees where the children are sleeping each night, with swaps asked for and agreed in writing."],
  ["Handovers without the panic", "A shared packing list, so the PE kit and the charger end up at the right house."],
  ["Shared costs, no awkward chats", "Log what you've paid, agree splits and keep a dated record, ready for a mediator if you ever need one."],
  ["A calm message helper", "\"Check my tone\" suggests a calmer way to say the hard things."],
  ["A view for the children", "A simple picture week for younger children, and their own view from 13."],
] as const;
const CARE = [
  ["Everyone who helps, in one place", "Family, neighbours and paid helpers each see only what they need."],
  ["Lifts and jobs shared out", "Ask for a lift to the hospital and someone says \"I'll do it\" with one tap."],
  ["Appointments sorted", "Questions to ask, what to bring and where to park, and if they go on their own, they can record it and we'll write up what the doctor said."],
  ["A care rota with the gaps showing", "See at a glance which days nobody's visiting."],
  ["Letters read for you", "Photograph a council or hospital letter and Many Hands pulls out what needs doing and by when."],
] as const;

/** The welcome email for someone joining the waiting list, tailored to who they are. */
export function waitlistWelcome(name: string | null, kind: string, siteUrl: string) {
  const first = name?.split(" ")[0] || null;
  const lists: { title: string; items: readonly (readonly [string, string])[] }[] =
    kind === "coparent" ? [{ title: "For parents sharing children across two homes", items: CO }]
    : kind === "carer" ? [{ title: "For families looking after someone older", items: CARE }]
    : [{ title: "For families looking after someone older", items: CARE.slice(0, 3) }, { title: "For parents sharing children across two homes", items: CO.slice(0, 3) }];
  const demo = `${siteUrl}/demo`;
  const subject = first ? `Welcome to Many Hands, ${first}` : "Welcome to Many Hands";
  const intro = [
    `${first ? `Hi ${first}, thank` : "Thank"} you for joining the Many Hands waiting list.`,
    "Many Hands is one shared place for everyone who helps a family: the calendar, who's doing what, appointments, costs and the paperwork. Many hands make light work.",
  ];
  const next = [
    "We're opening to a small group of families first, and you're on the list. We'll email you as soon as your place is ready.",
    "In the meantime, have a look round our demo, with two made-up families. And if you reply to this email to tell us what would make life easier for your family, it really does shape what we build.",
  ];
  const logo = `${siteUrl}/wordmark-white.png`;
  const P = (t: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#2F3A33">${esc(t)}</p>`;
  const H = (t: string) => `<tr><td style="padding:26px 36px 6px"><p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:#684689">${esc(t)}</p></td></tr>`;
  const feature = ([t, d]: readonly [string, string], i: number) => `<tr><td style="padding:10px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="34" valign="top" style="padding-top:2px"><div style="width:26px;height:26px;border-radius:13px;background:${i % 2 ? "#ECE4F4" : "#DCEBE3"};color:${i % 2 ? "#684689" : "#2B6A55"};font-size:13px;font-weight:bold;line-height:26px;text-align:center">${i + 1}</div></td>
<td valign="top" style="font-size:15px;line-height:1.55;color:#2F3A33"><b style="color:#16201B">${esc(t)}</b><br>${esc(d)}</td>
</tr></table></td></tr>`;
  const font = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F2F4F1;${font}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">You're on the list. Here's what Many Hands will do for your family.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F4F1"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #D6DCD4">
<tr><td style="background:#2B6A55;padding:30px 36px 28px">
<img src="${logo}" width="190" alt="many hands" style="display:block;width:190px;height:auto;border:0;color:#FFFFFF;font-size:28px;font-weight:bold">
<p style="margin:16px 0 0;font-size:15px;color:#DCEBE3;font-weight:bold;letter-spacing:.2px">Keeping families connected. Making care simple.</p>
</td></tr>
<tr><td style="padding:34px 36px 4px">
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#16201B">You're on the list${first ? `, ${esc(first)}` : ""}!</h1>
${intro.map(P).join("")}
</td></tr>
${lists.map((l) => H(l.title) + l.items.map(feature).join("")).join("")}
${H("What happens next")}
<tr><td style="padding:8px 36px 6px">${next.map(P).join("")}</td></tr>
<tr><td style="padding:6px 36px 34px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:12px;background:#2B6A55">
<a href="${demo}" style="display:inline-block;padding:15px 28px;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:12px">Try the demo &rarr;</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#F7F8F6;border-top:1px solid #E3E7E2;padding:22px 36px">
<p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#16201B"><span style="color:#2B6A55">many</span>hands</p>
<p style="margin:0;font-size:13px;line-height:1.55;color:#56635B">Many hands make light work.<br>You're getting this because you joined the Many Hands waiting list. We'll only email you about Many Hands launching. To be removed, just reply and say so.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [
    `You're on the list${first ? `, ${first}` : ""}!`, "", ...intro, "",
    ...lists.flatMap((l) => [l.title.toUpperCase(), ...l.items.map(([t, d]) => `- ${t}. ${d}`), ""]),
    "WHAT HAPPENS NEXT", ...next, "", `Try the demo: ${demo}`, "",
    "You're getting this because you joined the Many Hands waiting list. To be removed, just reply and say so.",
  ].join("\n");
  return { subject, html, text };
}
