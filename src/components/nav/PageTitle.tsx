"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * A page heading that scrolls its tab back to the top when tapped.
 *
 * iOS gives you this for free by tapping the status bar, but only for the
 * *document* scroller — these tabs scroll inside `<main>` so the tab bar can
 * stay put, which leaves the native gesture with nothing to do. Tapping the
 * title is the closest equivalent that works everywhere.
 *
 * The heading stays an <h1> for document structure; the button lives inside it
 * so assistive tech still reports a level-1 heading with the page's name.
 */
export function PageTitle({ children, className = "" }: Props) {
  return (
    <h1 className={`shrink-0 font-display text-2xl text-ink ${className}`}>
      <button
        type="button"
        // Walk up to the scrolling ancestor rather than taking a ref: the same
        // title is used by every scrollable tab, and each owns its own <main>.
        onClick={(e) => {
          const scroller = e.currentTarget.closest("main");
          scroller?.scrollTo({ top: 0, behavior: "smooth" });
        }}
        title="Back to top"
        className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {children}
      </button>
    </h1>
  );
}
