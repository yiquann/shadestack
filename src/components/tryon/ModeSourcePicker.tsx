const MODES = [
  { id: "model", label: "Model" },
  { id: "photo", label: "Photo" },
  { id: "camera", label: "Camera" },
] as const;

type Props = {
  active: (typeof MODES)[number]["id"];
};

const SEGMENT_BASE =
  "flex-1 rounded-pill px-3 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function ModeSourcePicker({ active }: Props) {
  return (
    <div className="mx-5 flex gap-1 rounded-pill bg-chip p-1">
      {MODES.map((mode) => {
        const isActive = mode.id === active;
        const disabled = mode.id !== "model";
        return (
          <button
            key={mode.id}
            disabled={disabled}
            className={`${SEGMENT_BASE} ${
              isActive
                ? "bg-ink text-surface"
                : disabled
                  ? "cursor-not-allowed text-textFaint opacity-50"
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
