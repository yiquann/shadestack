"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AppliedLayer, LookId } from "@/lib/tryon/session";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";

type Props = {
  layer: AppliedLayer;
  look: LookId;
};

export function LayerRow({ layer, look }: Props) {
  const { setOpacity, toggleVisible, removeLayer } = useTryOnSession();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `${look}:${layer.category}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`layer-row-${layer.category}`}
      className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
    >
      <button
        {...attributes}
        {...listeners}
        data-testid={`drag-handle-${layer.category}`}
        aria-label={`Reorder ${layer.product.name}`}
        className="shrink-0 cursor-grab touch-none px-1.5 py-1 text-base text-textFaint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ⠿
      </button>
      <div
        className="h-10 w-10 shrink-0 rounded-card"
        style={{
          background: `linear-gradient(145deg, ${layer.product.colorHex}cc, ${layer.product.colorHex})`,
          boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.35)",
        }}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="overflow-x-auto whitespace-nowrap text-sm text-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="font-bold">{layer.product.brand}</span>{" "}
          <span className="font-normal text-textSecondary">{layer.product.name}</span>
        </p>
        <p className="overflow-x-auto whitespace-nowrap text-xs text-textMuted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {layer.product.shade}
        </p>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(layer.opacity * 100)}
          onChange={(e) => setOpacity(layer.category, Number(e.target.value) / 100, look)}
          aria-label={`${layer.product.name} opacity`}
          data-testid={`opacity-${layer.category}`}
          className="mt-1 w-full accent-accent"
        />
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          onClick={() => toggleVisible(layer.category, look)}
          aria-label={layer.visible ? "Hide layer" : "Show layer"}
          aria-pressed={layer.visible}
          data-testid={`toggle-visible-${layer.category}`}
          className="rounded-full p-2.5 text-textSecondary transition-colors duration-150 hover:bg-chip hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {layer.visible ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 3l18 18" />
              <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-2.2 3.1" />
              <path d="M6.6 6.6A17.2 17.2 0 0 0 2 12s3.6 7 10 7a10.4 10.4 0 0 0 4-.8" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            </svg>
          )}
        </button>
        <button
          onClick={() => removeLayer(layer.category, look)}
          aria-label={`Remove ${layer.product.name}`}
          data-testid={`remove-${layer.category}`}
          className="rounded-full p-2.5 text-sm text-textSecondary transition-colors duration-150 hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
