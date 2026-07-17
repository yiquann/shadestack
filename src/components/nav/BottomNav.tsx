"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESIGN_TOKENS } from "@/lib/tokens";

const TABS = [
  { href: "/discover", label: "Discover" },
  { href: "/try-on", label: "Try On" },
  { href: "/saved", label: "Saved" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-border py-3 backdrop-blur-md"
      style={{ backgroundColor: "rgba(250,246,242,0.97)" }}
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-xs font-semibold transition-colors"
            style={{
              color: active
                ? DESIGN_TOKENS.colors.accent
                : DESIGN_TOKENS.colors.textFaint,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
