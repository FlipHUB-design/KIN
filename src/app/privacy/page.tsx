import Link from "next/link";

export default function Privacy() {
  return (
    <main className="page" style={{ paddingBottom: 48 }}>
      <Link href="/" className="brand">KIN</Link>
      <h1>How KIN handles your information</h1>
      <p className="note">Draft for the operator of this service to review with a UK GDPR adviser before launch.</p>
      <div className="card pad">
        <p>KIN stores what your family chooses to add about the person you support: names, contact details, appointments, tasks, check-in notes, contacts, home details and documents you upload. Some of this may be health-related, which is special category data under UK GDPR.</p>
        <p>Only members of a Care Circle can see its information, and each member sees only what their role allows. Helpers such as cleaners see only their own visits, the address and access notes. These rules are enforced by the database, not just the app&apos;s screens.</p>
        <p>We don&apos;t sell your data or use it for advertising. Data is encrypted in transit and at rest by our hosting provider.</p>
        <p>You can download a copy of your data and delete your account at any time from your Account page. An administrator can remove a whole Care Circle, which deletes its records and documents.</p>
        <p>KIN is not a medical service. It doesn&apos;t assess health or safety and doesn&apos;t contact emergency services.</p>
      </div>
    </main>
  );
}
