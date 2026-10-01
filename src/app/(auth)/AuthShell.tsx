import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export default function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="page" style={{ paddingBottom: 40, maxWidth: 440 }}>
      <Link href="/" className="brand"><Wordmark /></Link>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
