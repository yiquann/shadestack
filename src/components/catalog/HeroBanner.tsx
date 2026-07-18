import Link from "next/link";
import { DESIGN_TOKENS } from "@/lib/tokens";

export function HeroBanner() {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-card p-6 text-surface"
      style={{ background: DESIGN_TOKENS.gradients.heroBanner }}
    >
      {/* Soft highlighter-style glow — echoes the app's own screen-blend highlighter layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-2xl"
        style={{ background: `${DESIGN_TOKENS.colors.accent}4d` }}
      />
      <div className="relative">
        <p className="font-display text-2xl leading-tight">Virtual Try-On</p>
        <p className="mt-1 text-sm text-textFaint">See it on your own face, live.</p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/try-on"
            className="rounded-pill bg-accent px-4 py-2 text-xs font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Virtual Try-On
          </Link>
          <Link
            href="/try-on"
            className="rounded-pill border border-surface/30 px-4 py-2 text-xs font-semibold text-surface transition-colors duration-150 hover:border-surface/50 hover:bg-surface/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Shade Match
          </Link>
        </div>
      </div>
    </div>
  );
}
