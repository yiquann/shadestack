"use client";

import type { ReactNode } from "react";
import type { LookId, ViewMode } from "@/lib/tryon/session";
import type { DockActions, LookSlot } from "@/lib/tryon/dockState";

type Props = {
  viewMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  /** Which of the three trailing actions are currently available. */
  actions: DockActions;
  /** Split divider on/off, or the single-view before/after wipe — whichever `orientation` currently means. */
  orientationOn: boolean;
  onOrientation: () => void;
  onSwap: () => void;
  onSave: () => void;
  /** Row 2's chips, in display order. */
  slots: LookSlot[];
  /** Open a look's applied products. Available on a dimmed chip too, read-only. */
  onViewLook: (look: LookId) => void;
  /** Open the catalog targeting a look. Live chips only. */
  onAddLook: (look: LookId) => void;
  /** Chip to ring briefly on entering split view, or null. */
  highlight: LookId | null;
};

const SEGMENT =
  "flex-1 rounded-pill px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const ICON_BTN =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * The one treatment every unavailable control in this row shares, so the user
 * learns a single visual rule for "not available here" instead of a different
 * cue per button.
 *
 * The fill, and only the fill. Every icon button keeps its circular border and
 * its full-strength glyph in every state, so an unavailable control still reads
 * as a button with a legible symbol — which is the point, since swap and split
 * were previously invisible until you found them. Swapping the warm `chip` fill
 * for the neutral `chip-strong` is the whole cue.
 *
 * Reduced opacity was the first attempt and was not noticeable enough on device
 * against this warm, low-contrast palette; a version that also muted the glyph
 * read as unavailable but cost the icon its definition.
 *
 * The same `chip-strong` serves hover throughout the dock: a control is either
 * at rest or it is not, so there is one step and one colour rather than a third
 * shade to misread. On a pointer device that does mean hovering an available
 * control momentarily resembles an unavailable one — accepted, because the dock
 * is a phone surface and phones have no hover.
 *
 * pointer-events-none blocks the tap but NOT keyboard activation, so every
 * handler below re-checks its own flag. The button deliberately keeps its place
 * in the tab order and carries aria-disabled rather than the disabled attribute:
 * assistive tech should announce that the control is there and currently
 * unavailable, which is exactly what the fill says visually.
 */
const UNAVAILABLE = "pointer-events-none bg-chip-strong text-textSecondary";

const IDLE_ICON = "bg-chip text-textSecondary hover:bg-chip-strong hover:text-ink";

function DockIconButton({
  enabled,
  active,
  label,
  title,
  onClick,
  children,
}: {
  enabled: boolean;
  active?: boolean;
  label: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={!enabled}
      aria-pressed={active}
      title={title}
      onClick={() => {
        if (!enabled) return;
        onClick();
      }}
      className={`${ICON_BTN} ${
        !enabled ? UNAVAILABLE : active ? "border-ink bg-ink text-surface" : IDLE_ICON
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A chip split into two tap targets: a wide label and a trailing `＋`.
 *
 * Keeps its outline in every state, exactly as the icon buttons above do — a
 * dimmed Look B has to still read as a button, or it stops looking like
 * something that exists and starts looking like a gap. Same rule throughout the
 * dock: the fill changes, nothing else.
 */
const CHIP = "flex flex-1 items-stretch overflow-hidden rounded-pill border border-border";
const CHIP_LABEL =
  "flex-1 truncate px-5 py-3 text-left text-sm font-semibold transition-colors duration-150 hover:bg-chip-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";
const CHIP_PLUS =
  "flex w-11 shrink-0 items-center justify-center border-l border-ink/10 text-base font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";

function LookChip({
  slot,
  highlighted,
  onView,
  onAdd,
}: {
  slot: LookSlot;
  highlighted: boolean;
  onView: (look: LookId) => void;
  onAdd: (look: LookId) => void;
}) {
  const id = slot.look.toLowerCase();
  return (
    <div
      className={`${CHIP} ${highlighted ? "chip-highlight" : ""} ${
        slot.live ? "bg-chip text-ink" : "bg-chip-strong text-textSecondary"
      }`}
    >
      {/* Viewing never requires edit rights, so this stays live on a dimmed
          chip — it opens the look read-only. It is the only way to check what
          is in Look B without leaving single view. */}
      <button
        type="button"
        onClick={() => onView(slot.look)}
        aria-label={slot.live ? `${slot.label} products` : `${slot.label} products — view only`}
        data-testid={`view-products-${id}`}
        className={CHIP_LABEL}
      >
        {slot.label}
      </button>
      <button
        type="button"
        aria-disabled={!slot.live}
        onClick={() => {
          if (!slot.live) return;
          onAdd(slot.look);
        }}
        aria-label={
          slot.live
            ? `Add products to ${slot.label}`
            : `Add products to ${slot.label} — switch to split view to edit this look`
        }
        title={slot.live ? undefined : "Switch to split view to edit this look"}
        data-testid={`add-products-${id}`}
        className={`${CHIP_PLUS} ${slot.live ? "hover:bg-chip-strong" : "pointer-events-none"}`}
      >
        ＋
      </button>
    </div>
  );
}

const SVG_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * The phone dock. Row 1 is mode and actions, row 2 the look slots — both always
 * present, so the dock's height never changes and the preview above it never
 * resizes.
 *
 * Every control in row 1 renders in every mode. Buttons that appeared and
 * disappeared between modes used to reflow the row and, worse, hid the fact
 * that split view existed at all.
 */
export function TryOnDock({
  viewMode,
  onModeChange,
  actions,
  orientationOn,
  onOrientation,
  onSwap,
  onSave,
  slots,
  onViewLook,
  onAddLook,
  highlight,
}: Props) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex w-full min-w-0 max-w-[var(--control-w)] gap-1 rounded-pill bg-chip p-1">
          {(["single", "split"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={viewMode === m}
              onClick={() => onModeChange(m)}
              className={`${SEGMENT} ${
                viewMode === m
                  ? "bg-ink text-surface"
                  : "text-textSecondary hover:bg-chip-strong hover:text-ink"
              }`}
            >
              {m === "single" ? "Single" : "Split"}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <DockIconButton
            enabled={actions.orientation}
            active={orientationOn}
            label={viewMode === "split" ? "Toggle divider" : "Toggle before and after"}
            title={viewMode === "split" ? "Divider" : "Before / after"}
            onClick={onOrientation}
          >
            <svg {...SVG_PROPS} aria-hidden>
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <path d="M12 5v14" />
            </svg>
          </DockIconButton>

          <DockIconButton
            enabled={actions.swap}
            label="Swap sides"
            title="Swap"
            onClick={onSwap}
          >
            <svg {...SVG_PROPS} aria-hidden>
              <path d="M4 9h12M16 9l-3-3M16 9l-3 3M20 15H8M8 15l3-3M8 15l3 3" />
            </svg>
          </DockIconButton>

          <DockIconButton
            enabled={actions.save}
            label="Save look"
            title="Save look"
            onClick={onSave}
          >
            {/* Same path as the product detail sheet's save control, so the two
                read as one action. */}
            <svg {...SVG_PROPS} aria-hidden>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </DockIconButton>
        </div>
      </div>

      {/* Row 2. One row in every state — one chip or two, both the same height,
          spanning the same width as row 1 above so the dock reads as one block.
          The `＋` is persistent: it used to vanish on an empty look, which meant
          this row appeared the moment a first product landed. */}
      <div className="flex w-full items-stretch gap-2">
        {slots.map((slot) => (
          <LookChip
            key={slot.look}
            slot={slot}
            highlighted={highlight === slot.look}
            onView={onViewLook}
            onAdd={onAddLook}
          />
        ))}
        {/* Holds the second half of the row open when there is only one chip, so
            that chip is laid out by exactly the same rule as the paired ones —
            same flex-1 basis, same gap, same left edge. Reserving the space
            rather than computing a width means single and split cannot drift
            apart, and switching between them moves nothing: the chip on screen
            keeps its size and position and the second simply replaces this. */}
        {slots.length === 1 && <div className="flex-1" aria-hidden />}
      </div>
    </div>
  );
}
