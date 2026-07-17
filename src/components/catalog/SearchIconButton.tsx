"use client";

type Props = {
  onClick: () => void;
};

export function SearchIconButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label="Search"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-chip text-ink transition-colors duration-150 hover:bg-chip-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>
  );
}
