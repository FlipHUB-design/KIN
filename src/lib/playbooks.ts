// UK life-admin playbooks: ready-made steps for moments families get stuck.
// Wording avoids amounts and deadlines that change often; each links to the
// official page, which is the source of truth. Review these regularly.

export type Step = { title: string; detail: string; offset: number; category: string; link?: string; private?: boolean };
export type Playbook = { slug: string; title: string; summary: string; startLabel: string; startHint: string; steps: Step[]; link: string; linkLabel: string; kind?: "care" | "children" };

const GOV = "https://www.gov.uk";

export const PLAYBOOKS: Playbook[] = [
  {
    slug: "attendance-allowance",
    title: "Claim Attendance Allowance",
    summary: "A benefit for people over State Pension age who need help looking after themselves. It isn't means-tested.",
    startLabel: "Start date", startHint: "When you'll begin",
    link: `${GOV}/attendance-allowance`, linkLabel: "Attendance Allowance on GOV.UK",
    steps: [
      { title: "Check Attendance Allowance eligibility", detail: "Read who can get it and the two rates. It depends on the help needed, not on income or savings.", offset: 0, category: "Administration", link: `${GOV}/attendance-allowance/eligibility` },
      { title: "Get the claim form", detail: "Download the form, or order it by phone. If you order it by phone, the claim can count from the date you called as long as you send it back in time. GOV.UK has the details.", offset: 1, category: "Administration", link: `${GOV}/attendance-allowance/how-to-claim` },
      { title: "Gather details for the Attendance Allowance form", detail: "GP and hospital contacts, current medicines, and notes on what help is needed day and night, including on bad days.", offset: 3, category: "Administration", private: true },
      { title: "Fill in the form together", detail: "Describe the hardest days, not the best ones. Say how long things take and what goes wrong without help.", offset: 7, category: "Administration", private: true },
      { title: "Post the form and keep a copy", detail: "Photograph every page before posting. Add the copy to Documents.", offset: 10, category: "Administration" },
      { title: "Check for the Attendance Allowance decision letter", detail: "When the decision arrives, read it with KIN. If you disagree, you can ask for the decision to be looked at again. Check the time limit on the letter.", offset: 60, category: "Administration" },
    ],
  },
  {
    slug: "hospital-discharge",
    title: "Coming home from hospital",
    summary: "Plan the first days at home so nothing falls through the gaps.",
    startLabel: "Expected discharge date", startHint: "Ask the ward for this",
    link: "https://www.nhs.uk/nhs-services/hospitals/going-into-hospital/being-discharged-from-hospital/", linkLabel: "Being discharged from hospital on NHS.uk",
    steps: [
      { title: "Ask the ward about the discharge plan", detail: "Who to speak to, the expected date and time, and what support is planned at home.", offset: -2, category: "Administration", link: "https://www.nhs.uk/social-care-and-support/care-after-a-hospital-stay/planning-to-leave-hospital/" },
      { title: "Get the home ready", detail: "Heating on, fridge stocked, bed made up, clear walkways, key safe working.", offset: -1, category: "Household" },
      { title: "Lift home from hospital", detail: "Confirm the time with the ward before setting off. Bring warm clothes and shoes.", offset: 0, category: "Transport" },
      { title: "Collect medicines and the discharge letter", detail: "Ask what's changed and add the letter to Documents so the family can see it.", offset: 0, category: "Administration" },
      { title: "Visit on the first evening home", detail: "Check they're settled, warm and have eaten.", offset: 0, category: "Visit" },
      { title: "Ask about support at home", detail: "If help is needed with daily tasks, ask the council for a needs assessment.", offset: 1, category: "Administration", link: `${GOV}/apply-needs-assessment-social-services` },
      { title: "Book any follow-up appointments", detail: "Check the discharge letter for GP or clinic follow-ups and add them to the calendar.", offset: 2, category: "Administration" },
    ],
  },
  {
    slug: "blue-badge",
    title: "Apply for or renew a Blue Badge",
    summary: "Parking closer to where they need to go. Apply through the local council.",
    startLabel: "Start date", startHint: "When you'll begin",
    link: `${GOV}/apply-blue-badge`, linkLabel: "Blue Badge on GOV.UK",
    steps: [
      { title: "Check Blue Badge eligibility", detail: "Some people qualify automatically; others are assessed by the council.", offset: 0, category: "Administration", link: `${GOV}/apply-blue-badge` },
      { title: "Gather Blue Badge documents", detail: "A recent digital photo, proof of identity, proof of address and National Insurance number. Supporting evidence if asked.", offset: 2, category: "Administration", private: true },
      { title: "Apply online for the Blue Badge", detail: "Apply on GOV.UK. Keep the reference number.", offset: 4, category: "Administration", link: `${GOV}/apply-blue-badge` },
      { title: "Check for the Blue Badge decision", detail: "Councils can take several weeks. Chase if you've heard nothing.", offset: 60, category: "Administration" },
      { title: "Note the Blue Badge renewal date", detail: "Badges usually last up to 3 years. Add the expiry date to Home so KIN reminds you.", offset: 90, category: "Administration" },
    ],
  },
  {
    slug: "power-of-attorney",
    title: "Set up lasting power of attorney",
    summary: "Lets chosen people make decisions if the person loses capacity. It must be made while they can still decide.",
    startLabel: "Start date", startHint: "When you'll begin",
    link: `${GOV}/power-of-attorney`, linkLabel: "Lasting power of attorney on GOV.UK",
    steps: [
      { title: "Talk about wishes and who should be attorney", detail: "It's their decision. Discuss health and welfare, and property and financial affairs, which are separate LPAs.", offset: 0, category: "Visit", private: true },
      { title: "Fill in the LPA forms", detail: "Use the online service or paper forms from GOV.UK.", offset: 7, category: "Administration", link: `${GOV}/power-of-attorney/make-lasting-power` },
      { title: "Sign and witness the LPA", detail: "Follow the signing order in the guidance exactly. Mistakes can delay registration.", offset: 14, category: "Administration", private: true },
      { title: "Register the LPA with the Office of the Public Guardian", detail: "An LPA can't be used until it's registered. Check the current fee and any reductions on GOV.UK.", offset: 16, category: "Administration", link: `${GOV}/power-of-attorney/register` },
      { title: "Store the registered LPA safely", detail: "Upload a copy to Documents (administrators only) and note where the original is kept.", offset: 80, category: "Administration", private: true },
    ],
  },
  {
    slug: "council-tax",
    title: "Check council tax discounts",
    summary: "Living alone, some disabilities and some conditions can reduce the bill. Each council runs its own scheme.",
    startLabel: "Start date", startHint: "When you'll begin",
    link: `${GOV}/apply-for-council-tax-discount`, linkLabel: "Council Tax discounts on GOV.UK",
    steps: [
      { title: "Check council tax discounts", detail: "Enter the postcode on GOV.UK to reach the council's own page.", offset: 0, category: "Administration", link: `${GOV}/apply-for-council-tax-discount` },
      { title: "Apply for the council tax discount", detail: "Keep a copy of what you send.", offset: 3, category: "Administration", private: true },
      { title: "Check the new council tax bill", detail: "Make sure the discount appears. Read any letter with KIN.", offset: 45, category: "Administration" },
    ],
  },
  {
    slug: "after-a-death",
    title: "After someone dies",
    summary: "The practical steps in the first weeks. Share them out so no one carries it all.",
    startLabel: "Date of death", startHint: "",
    link: `${GOV}/after-a-death`, linkLabel: "What to do after someone dies on GOV.UK",
    steps: [
      { title: "Register the death", detail: "In England and Wales this is usually within 5 days. The registrar will give a Tell Us Once reference.", offset: 1, category: "Administration", link: `${GOV}/register-a-death` },
      { title: "Use Tell Us Once", detail: "Tells several government services in one go. It has to be used within 28 days of getting the reference.", offset: 5, category: "Administration", link: `${GOV}/after-a-death/organisations-you-need-to-contact-and-tell-us-once` },
      { title: "Tell the bank, pension providers and utilities", detail: "Make a list in the task comments of who has been told.", offset: 7, category: "Administration", private: true },
      { title: "Find the will and contact the executor", detail: "Check with the family solicitor if there is one.", offset: 3, category: "Administration", private: true },
      { title: "Cancel appointments and deliveries", detail: "GP, hospital, prescriptions, newspapers, regular deliveries.", offset: 7, category: "Administration" },
      { title: "Secure the home", detail: "Check heating, post and insurance for an empty property.", offset: 3, category: "Household" },
    ],
  },
];

const CAF = "https://www.cafcass.gov.uk";

PLAYBOOKS.push(
  {
    kind: "children",
    slug: "child-passport",
    title: "Get or renew a child's passport",
    summary: "Child passports last 5 years. Someone with parental responsibility applies, with both parents' details.",
    startLabel: "Start date", startHint: "At least a few months before you travel",
    link: `${GOV}/get-a-child-passport`, linkLabel: "Child passports on GOV.UK",
    steps: [
      { title: "Check the passport expiry date", detail: "Some countries need several months left on a passport. Check entry rules for where you're going.", offset: 0, category: "Administration", link: `${GOV}/foreign-travel-advice` },
      { title: "Agree who applies and gather details", detail: "You'll need both parents' details. Find the old passport or, for a first passport, the birth certificate.", offset: 2, category: "Administration", private: true },
      { title: "Take a passport photo", detail: "Follow the photo rules on GOV.UK. Many shops and the online service can check it for you.", offset: 5, category: "Administration", link: `${GOV}/photos-for-passports` },
      { title: "Apply for the child's passport", detail: "Apply online. Check current processing times before you book travel.", offset: 7, category: "Administration", link: `${GOV}/get-a-child-passport` },
      { title: "Check the new passport has arrived", detail: "Update the expiry date in Children and note where it's kept in Where is it?", offset: 35, category: "Administration" },
    ],
  },
  {
    kind: "children",
    slug: "travel-abroad",
    title: "Take the children abroad",
    summary: "You usually need permission from everyone with parental responsibility. A letter and the right documents avoid problems at the border.",
    startLabel: "Departure date", startHint: "",
    link: `${GOV}/permission-take-child-abroad`, linkLabel: "Permission to take a child abroad on GOV.UK",
    steps: [
      { title: "Tell the other parent the dates and where you're going", detail: "Share the dates, address and how to contact the children. Ask for permission early.", offset: -60, category: "Administration", link: `${GOV}/permission-take-child-abroad` },
      { title: "Check the children's passports", detail: "Check expiry dates and any entry rules for the country you're visiting.", offset: -56, category: "Administration", link: `${GOV}/foreign-travel-advice` },
      { title: "Get a permission letter", detail: "A letter from the other parent with their contact details and the trip details. Keep it with the passports.", offset: -21, category: "Administration", link: `${GOV}/permission-take-child-abroad` },
      { title: "Pack evidence of your relationship", detail: "For example a birth certificate, and a marriage or divorce certificate if your surname is different from the children's.", offset: -7, category: "Administration", private: true },
      { title: "Share the itinerary", detail: "Add flight times and where you're staying to the calendar so everyone knows.", offset: -3, category: "Administration" },
    ],
  },
  {
    kind: "children",
    slug: "school-place",
    title: "Apply for a school place",
    summary: "Apply through your council, even for schools in another area. In England the closing date is usually 31 October for secondary and 15 January for primary. Check your council's dates.",
    startLabel: "Your council's closing date", startHint: "Check your council's website",
    link: `${GOV}/apply-for-secondary-school-place`, linkLabel: "School places on GOV.UK",
    steps: [
      { title: "Find your council's closing date and admissions booklet", detail: "Each council publishes its dates, admissions rules and catchment information.", offset: -70, category: "School", link: `${GOV}/apply-for-secondary-school-place` },
      { title: "Go to open evenings", detail: "Add each one to the calendar. Agree with the other parent which ones you'll each attend.", offset: -56, category: "School" },
      { title: "Agree your preferences in order", detail: "Use Agreements to record the order you've both agreed, so there's no confusion later.", offset: -21, category: "School", private: true },
      { title: "Submit the school application", detail: "Apply online through the council. Keep the confirmation email and add it to Documents.", offset: -7, category: "School", link: `${GOV}/apply-for-primary-school-place` },
      { title: "Check the offer on national offer day", detail: "Offers come months later. Note the date and the deadline to accept.", offset: 120, category: "School" },
    ],
  },
  {
    kind: "children",
    slug: "childcare-costs",
    title: "Get help with childcare costs",
    summary: "Tax-Free Childcare and free childcare hours for working parents. Both need you to reconfirm every 3 months.",
    startLabel: "Start date", startHint: "",
    link: `${GOV}/tax-free-childcare`, linkLabel: "Tax-Free Childcare on GOV.UK",
    steps: [
      { title: "Check what you can get", detail: "Tax-Free Childcare is for working parents with children aged 11 or under (16 if disabled). Free hours depend on the child's age and where you live.", offset: 0, category: "Childcare", link: `${GOV}/tax-free-childcare` },
      { title: "Check your childminder or nursery is registered", detail: "Your provider must be signed up to receive payments.", offset: 2, category: "Childcare" },
      { title: "Apply for a childcare account", detail: "Apply online. Keep the reference and any codes for free hours.", offset: 5, category: "Childcare", link: `${GOV}/free-childcare-if-working`, private: true },
      { title: "Reconfirm childcare eligibility", detail: "Sign in every 3 months to reconfirm, or the support stops. Set this task to repeat.", offset: 90, category: "Childcare" },
    ],
  },
  {
    kind: "children",
    slug: "new-baby",
    title: "A new baby",
    summary: "The paperwork in the first weeks, shared out.",
    startLabel: "Date of birth", startHint: "",
    link: `${GOV}/register-birth`, linkLabel: "Register a birth on GOV.UK",
    steps: [
      { title: "Register the birth", detail: "In England, Wales and Northern Ireland, births must be registered within 42 days.", offset: 7, category: "Administration", link: `${GOV}/register-birth` },
      { title: "Register the baby with a GP", detail: "Ask your GP surgery how to register a newborn.", offset: 10, category: "Appointment" },
      { title: "Claim Child Benefit", detail: "Claim even if you decide not to be paid: it can protect the State Pension of a parent who isn't working. GOV.UK explains the High Income Child Benefit Charge.", offset: 14, category: "Administration", link: `${GOV}/child-benefit` },
      { title: "Add the baby to Children in KIN", detail: "Add the date of birth, GP and anything grandparents or childminders need to know.", offset: 14, category: "Administration" },
    ],
  },
  {
    kind: "children",
    slug: "separating",
    title: "Making arrangements after separating",
    summary: "The practical steps for agreeing where the children live, money and how you'll communicate. KIN isn't legal advice.",
    startLabel: "Start date", startHint: "",
    link: `${GOV}/looking-after-children-divorce`, linkLabel: "Making child arrangements on GOV.UK",
    steps: [
      { title: "Read about making child arrangements", detail: "How arrangements can be agreed without going to court, and what happens if you can't agree.", offset: 0, category: "Administration", link: `${GOV}/looking-after-children-divorce` },
      { title: "Draft a parenting plan together", detail: "Cafcass has a free parenting plan to work through. Record each thing you agree in Agreements.", offset: 3, category: "Administration", link: `${CAF}/grown-ups/parents-and-carers/divorce-and-separation/parenting-together/parenting-plan/`, private: true },
      { title: "Set up the usual schedule in KIN", detail: "Add both homes and the pattern you've agreed, so grandparents, childminders and the children can see it.", offset: 5, category: "Administration" },
      { title: "Agree how shared costs are split", detail: "Set the usual split in Family settings and record what counts as a shared cost in Agreements.", offset: 7, category: "Administration", private: true },
      { title: "Decide how child maintenance will work", detail: "Parents can arrange it between themselves or use the Child Maintenance Service.", offset: 10, category: "Administration", link: `${GOV}/making-child-maintenance-arrangement`, private: true },
      { title: "Find out about family mediation", detail: "If you can't agree, a mediator can help. A first meeting (a MIAM) is usually needed before going to court.", offset: 10, category: "Administration", link: "https://www.familymediationcouncil.org.uk/", private: true },
      { title: "Tell the school and GP about both homes", detail: "Ask the school to send letters and reports to both parents, and update contact details.", offset: 14, category: "School" },
    ],
  },
  {
    kind: "children",
    slug: "school-holidays",
    title: "Plan the school holidays",
    summary: "Agree who has the children when, book clubs early and tell the childminder.",
    startLabel: "First day of the holiday", startHint: "",
    link: `${GOV}/school-term-holiday-dates`, linkLabel: "School term dates on GOV.UK",
    steps: [
      { title: "Add the holiday dates to the calendar", detail: "Add term dates and INSET days as events, and share them with the childminder.", offset: -42, category: "School", link: `${GOV}/school-term-holiday-dates` },
      { title: "Agree who has the children each week", detail: "Ask for schedule changes for any days that differ from the usual pattern, so everyone sees the final plan.", offset: -35, category: "Childcare" },
      { title: "Book holiday clubs or childcare", detail: "Popular clubs fill early. Add costs to Costs so they're shared as agreed.", offset: -28, category: "Childcare" },
      { title: "Check passports and permission if travelling", detail: "See the Take the children abroad playbook.", offset: -28, category: "Administration" },
    ],
  },
);

export const playbook = (slug: string) => PLAYBOOKS.find((p) => p.slug === slug);
export const playbooksFor = (kind?: string) => PLAYBOOKS.filter((p) => (p.kind || "care") === (kind || "care"));
