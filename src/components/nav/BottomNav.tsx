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
    // Fixed to the viewport bottom rather than sitting in flow at the end of the
    // app-shell column. In flow it was only ever as low as .app-shell was tall,
    // so anywhere 100dvh under-resolves the bar rides up with it; pinned, it is
    // at the bottom of the screen by construction. .app-shell reserves an equal
    // strip as padding-bottom, so this still cannot overlap the page above it.
    //
    // Height is pinned to --nav-h (the same value that reserves the strip) and
    // the safe-area inset is absorbed as bottom padding, so the labels stay
    // centred in the visible band above an iOS home indicator. min-h rather than
    // a hard height: the links carry their own vertical padding as a floor, so
    // the labels keep clear of the top border even if --nav-h fails to resolve.
    <nav className="fixed inset-x-0 bottom-0 z-50 flex min-h-[var(--nav-h)] items-stretch border-t border-border bg-bg/97 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md">
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
            className={`flex flex-1 items-center justify-center py-4 text-sm font-semibold transition-colors duration-150 active:bg-chip/60 ${
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
