import type { SourceMode } from "@/lib/tryon/session";

export type { SourceMode };

const MODES: { id: SourceMode; label: string }[] = [
  { id: "model", label: "Model" },
  { id: "photo", label: "Photo" },
  { id: "camera", label: "Camera" },
];

type Props = {
  active: SourceMode;
  onChange: (mode: SourceMode) => void;
};

const SEGMENT_BASE =
  "flex-1 rounded-pill px-3 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function ModeSourcePicker({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 rounded-pill bg-chip p-1">
      {MODES.map((mode) => {
        const isActive = mode.id === active;
        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(mode.id)}
            className={`${SEGMENT_BASE} ${
              isActive
                ? "bg-ink text-surface"
                : "text-textSecondary hover:bg-chip-hover hover:text-ink"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
