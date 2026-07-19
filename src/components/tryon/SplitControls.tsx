"use client";

import type { ViewMode } from "@/lib/tryon/session";

type Props = {
  viewMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  swapped: boolean;
  onSwap: () => void;
  divider: boolean;
  onToggleDivider: () => void;
  // Whether Look B exists; gates the single-view swap between looks.
  hasB: boolean;
};

const SEGMENT =
  "flex-1 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const SWAP_BTN =
  "rounded-pill bg-chip px-3 py-1.5 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip-hover hover:text-ink";

export function SplitControls({
  viewMode,
  onModeChange,
  swapped,
  onSwap,
  divider,
  onToggleDivider,
  hasB,
}: Props) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full max-w-[240px] gap-1 rounded-pill bg-chip p-1">
        {(["single", "split"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={viewMode === m}
            onClick={() => onModeChange(m)}
            className={`${SEGMENT} ${
              viewMode === m ? "bg-ink text-surface" : "text-textSecondary hover:text-ink"
            }`}
          >
            {m === "single" ? "Single" : "Split"}
          </button>
        ))}
      </div>
      {viewMode === "split" ? (
        <>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSwap} className={SWAP_BTN}>
              Swap sides
            </button>
            <button
              type="button"
              aria-pressed={divider}
              onClick={onToggleDivider}
              className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                divider
                  ? "bg-ink text-surface"
                  : "bg-chip text-textSecondary hover:bg-chip-hover hover:text-ink"
              }`}
            >
              Divider
            </button>
          </div>
          <p className="text-[11px] text-textMuted">
            *Left = {swapped ? "Look B" : "Look A"} · Right = {swapped ? "Look A" : "Look B"}
          </p>
        </>
      ) : (
        hasB && (
          <>
            <button type="button" onClick={onSwap} className={SWAP_BTN}>
              Swap look
            </button>
            <p className="text-[11px] text-textMuted">
              Editing {swapped ? "Look B" : "Look A"}
            </p>
          </>
        )
      )}
    </div>
  );
}
