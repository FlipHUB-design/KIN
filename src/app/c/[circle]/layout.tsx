import Nav from "@/components/Nav";
import { getCircle } from "@/lib/data";

export default async function CircleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ circle: string }> }) {
  const { circle } = await params;
  const { role } = await getCircle(circle);
  const fullNav = role === "admin" || role === "family" || role === "contributor";
  return (
    <>
      {children}
      {fullNav && <Nav base={`/c/${circle}`} />}
    </>
  );
}
