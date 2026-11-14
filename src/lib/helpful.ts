/**
 * "Helpful things": short, practical product lists shown where they're relevant.
 * Links go to Amazon UK searches (or a product page when an ASIN is set), carrying
 * the Associates tag from AMAZON_TAG when there is one. Edit freely: ids must stay stable
 * because click counts are stored against them.
 */
export type HelpfulItem = { id: string; name: string; why: string; search: string; asin?: string; note?: string };
export type HelpfulList = { id: string; kind: "care" | "children"; title: string; intro: string; items: HelpfulItem[] };

export const HELPFUL: HelpfulList[] = [
  {
    id: "home-from-hospital", kind: "care", title: "Coming home from hospital",
    intro: "Small things that make the first weeks at home easier and safer.",
    items: [
      { id: "pill-organiser", name: "Weekly pill organiser (morning and evening)", why: "Makes it easy to see if today's tablets have been taken.", search: "weekly pill organiser am pm large" },
      { id: "key-safe", name: "Police-approved key safe", why: "Lets carers and family get in without a spare key going round. Look for Secured by Design.", search: "police approved key safe secured by design" },
      { id: "grab-rail", name: "Grab rails for the bathroom", why: "Steadier getting in and out of the bath or shower. Fix to a solid wall, or ask the council's occupational therapist.", search: "bathroom grab rail" },
      { id: "toilet-frame", name: "Raised toilet seat with frame", why: "Easier sitting and standing after an operation or a fall.", search: "raised toilet seat with frame" },
      { id: "reacher", name: "Long-handled grabber", why: "Picks things up without bending.", search: "long handled grabber reacher" },
      { id: "night-lights", name: "Motion-sensor night lights", why: "Lights the way to the bathroom at night without fumbling for switches.", search: "plug in motion sensor night light" },
    ],
  },
  {
    id: "safe-at-home", kind: "care", title: "Staying safe and independent at home",
    intro: "Ideas families often find useful. Ask the person what they'd like first: it's their home.",
    items: [
      { id: "day-clock", name: "Large day and date clock", why: "Shows the day, date and whether it's morning or evening, in big letters.", search: "large digital day clock dementia" },
      { id: "big-button-phone", name: "Big-button phone with photo buttons", why: "One press to call family.", search: "big button phone photo memory keys" },
      { id: "co-alarm", name: "Carbon monoxide alarm", why: "Cheap and important if there's a gas boiler or fire.", search: "carbon monoxide alarm 10 year" },
      { id: "video-doorbell", name: "Video doorbell", why: "See who's at the door before opening it.", search: "video doorbell", note: "Agree it with the person first, and tell visitors it records." },
      { id: "indoor-camera", name: "Indoor camera", why: "Some families use one in a shared room for peace of mind.", search: "indoor security camera", note: "Only with the person's clear agreement. Never in a bedroom or bathroom. If they can't agree, talk to their GP or social worker first." },
      { id: "non-slip-mat", name: "Non-slip bath mat", why: "A simple way to cut the risk of slipping.", search: "non slip bath mat suction" },
    ],
  },
  {
    id: "appointments", kind: "care", title: "For appointments",
    intro: "Keep everything together so whoever goes has it all.",
    items: [
      { id: "doc-wallet", name: "A4 document wallet", why: "One place for letters, the medication list and the appointment card.", search: "a4 document wallet expanding file" },
      { id: "travel-pill-case", name: "Travel pill case", why: "For a long day at the hospital.", search: "travel pill case daily" },
      { id: "power-bank", name: "Small phone power bank", why: "So the phone lasts for recording the appointment and calling home.", search: "small power bank" },
      { id: "badge-holder", name: "Blue Badge holder", why: "Keeps the badge and clock clean and easy to display.", search: "blue badge holder with timer" },
    ],
  },
  {
    id: "two-homes", kind: "children", title: "Two homes, less packing",
    intro: "Duplicating a few everyday things means less to carry and less forgotten at handover.",
    items: [
      { id: "spare-uniform", name: "A second set of school uniform", why: "One set at each home, so nothing is ever at the wrong house.", search: "school uniform pack" },
      { id: "toiletry-kit", name: "Children's toothbrush and toiletries set", why: "Keep a set at each home.", search: "kids toothbrush toiletry set" },
      { id: "chargers", name: "Spare phone and tablet chargers", why: "The thing most often left behind.", search: "usb c charger cable 2 pack" },
      { id: "holdall", name: "Children's weekend holdall", why: "Their own bag for going between homes.", search: "kids weekend holdall bag" },
      { id: "wall-planner", name: "Family wall planner for each home", why: "So the children can see where they'll be, even without a phone.", search: "family wall planner" },
    ],
  },
  {
    id: "back-to-school", kind: "children", title: "Back to school",
    intro: "Name everything, and keep a spare of the things that go missing.",
    items: [
      { id: "name-labels", name: "Iron-on and stick-on name labels", why: "For uniform, PE kit, water bottles and lunch boxes.", search: "school name labels iron on stick on" },
      { id: "stationery-kit", name: "School stationery kit", why: "Pens, pencils, ruler and rubber in one go. Check the school's list first.", search: "school stationery set pencil case" },
      { id: "water-bottle", name: "Leak-proof water bottle", why: "Most schools ask for one every day.", search: "kids leak proof water bottle" },
      { id: "pe-bag", name: "PE bag", why: "Kept by the door on PE days.", search: "kids pe drawstring bag" },
      { id: "lunch-box", name: "Lunch box", why: "Look for one that's easy for small hands to open.", search: "kids lunch box" },
    ],
  },
];

export const helpfulList = (id: string) => HELPFUL.find((l) => l.id === id);
export const helpfulItem = (id: string) => { for (const l of HELPFUL) { const i = l.items.find((x) => x.id === id); if (i) return { list: l, item: i }; } return null; };

/** The Amazon UK link for an item, with the Associates tag when one is set. */
export function amazonUrl(item: HelpfulItem) {
  const tag = process.env.AMAZON_TAG?.trim();
  const u = item.asin ? new URL(`https://www.amazon.co.uk/dp/${item.asin}`) : new URL("https://www.amazon.co.uk/s");
  if (!item.asin) u.searchParams.set("k", item.search);
  if (tag) u.searchParams.set("tag", tag);
  return u.toString();
}
export const affiliateOn = () => !!process.env.AMAZON_TAG?.trim();
