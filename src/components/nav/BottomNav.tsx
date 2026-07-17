"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/discover", label: "Discover" },
  { href: "/try-on", label: "Try On" },
  { href: "/saved", label: "Saved" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-border bg-bg/97 py-3 backdrop-blur-md">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-xs font-semibold transition-colors ${
              active ? "text-accent" : "text-textFaint"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
