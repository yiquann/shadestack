"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";

type Props = {
  // The preview container the wipe is measured against (screen space, not the
  // mirrored media inside it).
  containerRef: RefObject<HTMLElement | null>;
  pos: number;
  setPos: Dispatch<SetStateAction<number>>;
};

// The draggable before/after divider: a full-height line with a round grab
// handle. Left of the line is "before", right is "after". The parent clips its
// "after" layer at `pos`% and shows the original beneath on the left.
export function BeforeAfterOverlay({ containerRef, pos, setPos }: Props) {
  function setFromClientX(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }

  return (
    <>
      <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-pill bg-ink/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-surface">
        Before
      </span>
      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-pill bg-ink/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-surface">
        After
      </span>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Before and after comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            setFromClientX(e.clientX);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 2));
          if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 2));
        }}
        className="absolute inset-y-0 z-20 flex w-10 -translate-x-1/2 cursor-ew-resize touch-none select-none items-center justify-center focus-visible:outline-none"
        style={{ left: `${pos}%` }}
      >
        <div className="h-full w-0.5 bg-surface/90 shadow-[0_0_4px_rgba(0,0,0,0.45)]" />
        <div className="absolute grid h-8 w-8 place-items-center rounded-full bg-surface text-ink shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
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
