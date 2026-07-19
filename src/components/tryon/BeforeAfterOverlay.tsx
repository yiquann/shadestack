"use client";

import { useEffect, useRef, type RefObject } from "react";

type Props = {
  // The preview container. The divider position is written to its `--wipe`
  // custom property; the parent's clip-path and this overlay's line both read
  // `var(--wipe)`, so dragging updates CSS only — it never triggers a React
  // re-render (which would contend with the camera render loop and cause lag).
  targetRef: RefObject<HTMLElement | null>;
};

// The before/after comparison overlay. The whole preview is the drag surface —
// press and drag anywhere to move the divider — with a visible line + white
// arrows marking the split. Left of the line is "before", right is "after".
export function BeforeAfterOverlay({ targetRef }: Props) {
  const posRef = useRef(50);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Seed --wipe on mount, preserving any position left from a previous open.
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const existing = parseFloat(el.style.getPropertyValue("--wipe"));
    if (Number.isNaN(existing)) {
      el.style.setProperty("--wipe", `${posRef.current}%`);
    } else {
      posRef.current = existing;
    }
    surfaceRef.current?.setAttribute("aria-valuenow", String(Math.round(posRef.current)));
  }, [targetRef]);

  function setWipe(pct: number) {
    const clamped = Math.min(100, Math.max(0, pct));
    posRef.current = clamped;
    targetRef.current?.style.setProperty("--wipe", `${clamped}%`);
    surfaceRef.current?.setAttribute("aria-valuenow", String(Math.round(clamped)));
  }

  function setFromClientX(clientX: number) {
    const el = targetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    setWipe(((clientX - rect.left) / rect.width) * 100);
  }

  return (
    <>
      <span className="pointer-events-none absolute left-2 top-2 z-30 rounded-pill bg-ink/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-surface">
        Before
      </span>
      <span className="pointer-events-none absolute right-2 top-2 z-30 rounded-pill bg-ink/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-surface">
        After
      </span>

      {/* Full-preview drag surface. */}
      <div
        ref={surfaceRef}
        role="slider"
        tabIndex={0}
        aria-label="Before and after comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={50}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            setFromClientX(e.clientX);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setWipe(posRef.current - 2);
          if (e.key === "ArrowRight") setWipe(posRef.current + 2);
        }}
        className="absolute inset-0 z-20 cursor-ew-resize touch-none select-none focus-visible:outline-none"
      />

      {/* Visual divider line + white arrows (non-interactive; the surface above
          handles the dragging). The arrows sit below centre so they don't cover
          the face. Position tracks --wipe, so it moves without a re-render. */}
      <div
        className="pointer-events-none absolute inset-y-0 z-20 -translate-x-1/2"
        style={{ left: "var(--wipe, 50%)" }}
      >
        <div className="mx-auto h-full w-0.5 bg-surface/90 shadow-[0_0_4px_rgba(0,0,0,0.45)]" />
        <div
          className="absolute left-1/2 top-[70%] -translate-x-1/2 -translate-y-1/2 text-surface"
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 7 4 12l5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>
    </>
  );
}
