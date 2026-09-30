// UK life-admin playbooks: ready-made steps for moments families get stuck.
// Wording avoids amounts and deadlines that change often; each links to the
// official page, which is the source of truth. Review these regularly.

export type Step = { title: string; detail: string; offset: number; category: string; link?: string; private?: boolean };
export type Playbook = { slug: string; title: string; summary: string; startLabel: string; startHint: string; steps: Step[]; link: string; linkLabel: string };

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

export const playbook = (slug: string) => PLAYBOOKS.find((p) => p.slug === slug);
