"use client";

import { useState } from "react";
import { DESIGN_TOKENS } from "@/lib/tokens";
import type { LookId } from "@/lib/tryon/session";

export type LookChoice = { look: LookId; name: string };

type Props = {
  // Which looks currently have makeup. When both do, the user picks which to
  // save (A / B / Both); otherwise the sole look is saved with one name.
  hasA: boolean;
  hasB: boolean;
  // The active look, used as the default selection when both have makeup.
  defaultLook: LookId;
  onClose: () => void;
  onSave: (choices: LookChoice[]) => void;
};

type Selection = LookId | "both";

const SEGMENT_BASE =
  "flex-1 rounded-pill px-3 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const NAME_INPUT =
  "w-full rounded-pill border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent";

// Bottom sheet to name and save the current look(s). Mirrors ProductDetailSheet's
// scrim + slideUp panel.
export function SaveLookSheet({ hasA, hasB, defaultLook, onClose, onSave }: Props) {
  const both = hasA && hasB;
  const soleLook: LookId = hasA ? "A" : "B";
  const [selection, setSelection] = useState<Selection>(both ? defaultLook : soleLook);
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");

  // Which looks the current selection will save.
  const savesA = selection === "A" || selection === "both";
  const savesB = selection === "B" || selection === "both";
  const validA = !savesA || nameA.trim().length > 0;
  const validB = !savesB || nameB.trim().length > 0;
  const canSave = (savesA || savesB) && validA && validB;

  function submit() {
    if (!canSave) return;
    const choices: LookChoice[] = [];
    if (savesA) choices.push({ look: "A", name: nameA.trim() });
    if (savesB) choices.push({ look: "B", name: nameB.trim() });
    onSave(choices);
  }

  const segments: { id: Selection; label: string }[] = [
    { id: "A", label: "Look A" },
    { id: "B", label: "Look B" },
    { id: "both", label: "Both" },
  ];

  return (
    <div className="fixed inset-0" style={{ zIndex: 70 }}>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
        style={{ animation: "fadeIn 0.2s ease-out" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-surface p-6"
        style={{ borderRadius: DESIGN_TOKENS.radii.sheet, animation: "slideUp 0.25s ease-out" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="font-display text-xl text-ink">Save Look</h2>
        <p className="mt-1 text-xs text-textMuted">
          {both
            ? "Save Look A, Look B, or both — name each to re-apply it later."
            : "Name this combination to re-apply it later."}
        </p>

        {both && (
          <div className="mt-4 flex gap-1 rounded-pill bg-chip p-1" role="group" aria-label="Which look to save">
            {segments.map((seg) => {
              const isActive = seg.id === selection;
              return (
                <button
                  key={seg.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSelection(seg.id)}
                  className={`${SEGMENT_BASE} ${
                    isActive
                      ? "bg-ink text-surface"
                      : "text-textSecondary hover:bg-chip-hover hover:text-ink"
                  }`}
                >
                  {seg.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {savesA && (
            <input
              type="text"
              autoFocus
              value={nameA}
              onChange={(e) => setNameA(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Natural Everyday"
              aria-label={both ? "Look A name" : "Look name"}
              className={NAME_INPUT}
            />
          )}
          {savesB && (
            <input
              type="text"
              autoFocus={!savesA}
              value={nameB}
              onChange={(e) => setNameB(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Evening Glam"
              aria-label={both ? "Look B name" : "Look name"}
              className={NAME_INPUT}
            />
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-pill border border-border px-4 py-3 text-center text-sm font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="flex-1 rounded-pill bg-accent px-4 py-3 text-center text-sm font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
