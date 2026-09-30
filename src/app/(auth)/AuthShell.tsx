import Link from "next/link";

export default function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="page" style={{ paddingBottom: 40, maxWidth: 440 }}>
      <Link href="/" className="brand">KIN</Link>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
