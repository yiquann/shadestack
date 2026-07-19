"use client";

import { useState } from "react";
import { DESIGN_TOKENS } from "@/lib/tokens";

type Props = {
  onClose: () => void;
  onSave: (name: string) => void;
};

// Bottom sheet to name and save the current look. Mirrors ProductDetailSheet's
// scrim + slideUp panel.
export function SaveLookSheet({ onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  function submit() {
    if (!trimmed) return;
    onSave(trimmed);
  }

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
        <p className="mt-1 text-xs text-textMuted">Name this combination to re-apply it later.</p>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Natural Everyday"
          aria-label="Look name"
          className="mt-4 w-full rounded-pill border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-textFaint focus-visible:ring-2 focus-visible:ring-accent"
        />
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
            disabled={!trimmed}
            className="flex-1 rounded-pill bg-accent px-4 py-3 text-center text-sm font-semibold text-surface transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
