"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON: Record<string, React.ReactNode> = {
  Home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  Calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  Tasks: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5" /></>,
  People: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.6c2.6.2 4.3 2 5 5.4" /></>,
  More: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
};

export default function Nav({ base }: { base: string }) {
  const path = usePathname();
  const items = [["Home", ""], ["Calendar", "/calendar"], ["Tasks", "/tasks"], ["People", "/people"], ["More", "/more"]] as const;
  return (
    <nav className="tabs" aria-label="Main">
      <div className="in">
        {items.map(([label, sub]) => {
          const href = base + sub;
          const active = sub === "" ? path === base : path.startsWith(href) || (sub === "/calendar" && path.includes("/appointments"));
          return (
            <Link key={label} href={href} aria-current={active ? "page" : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[label]}</svg>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
