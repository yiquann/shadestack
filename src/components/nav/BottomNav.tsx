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
    // Height is pinned to --nav-h (which pages reserve as bottom padding) and
    // the safe-area inset is absorbed as bottom padding, so the labels stay
    // centred in the visible strip above an iOS home indicator.
    // In normal flow at the end of the app-shell column (not fixed), so it can
    // never overlap the page above it. shrink-0 keeps it at full height while
    // the page absorbs the rest. min-h rather than a hard height: the links
    // carry their own vertical padding as a floor, so the labels keep clear of
    // the top border even if --nav-h fails to resolve on an older browser.
    <nav className="z-50 flex min-h-[var(--nav-h)] shrink-0 items-stretch border-t border-border bg-bg/97 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md">
      {TABS.map((tab, i) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            // Each tab is an equal-width, full-height tap target (rather than a
            // bare text node in a justify-around row), which both gives the
            // labels room to breathe under the top border and lets the divider
            // below span the bar's full height.
            className={`flex flex-1 items-center justify-center py-4 text-xs font-semibold transition-colors duration-150 active:bg-chip/60 ${
              i > 0 ? "border-l border-border" : ""
            } ${active ? "text-accent" : "text-textFaint"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
