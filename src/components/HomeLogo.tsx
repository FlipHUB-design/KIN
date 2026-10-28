import Link from "next/link";
import { getUser } from "@/lib/data";
import Wordmark from "@/components/Wordmark";

/** The Many Hands logo as a way home: the demo's person picker for demo accounts, your families when signed in, else the front page. */
export default async function HomeLogo() {
  const { user } = await getUser();
  const demo = !!user?.email?.endsWith("@kin-demo.example.com");
  const href = demo ? "/demo" : user ? "/circles" : "/";
  return <Link href={href} className="brand" aria-label={demo ? "Many Hands: back to choose a demo person" : "Many Hands home"} title={demo ? "Back to choose a demo person" : "Many Hands home"}><Wordmark /></Link>;
}
