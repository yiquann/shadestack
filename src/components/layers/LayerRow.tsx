"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AppliedLayer, LookId } from "@/lib/tryon/session";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { CATEGORY_LABELS } from "@/lib/catalog/types";

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
        className="shrink-0 cursor-grab touch-none px-1 text-textFaint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{layer.product.name}</p>
        <p className="truncate text-xs text-textMuted">{CATEGORY_LABELS[layer.category]}</p>
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
      <button
        onClick={() => toggleVisible(layer.category, look)}
        aria-label={layer.visible ? "Hide layer" : "Show layer"}
        aria-pressed={layer.visible}
        data-testid={`toggle-visible-${layer.category}`}
        className="shrink-0 rounded-full p-2 text-ink transition-colors duration-150 hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {layer.visible ? "👁" : "🚫"}
      </button>
      <button
        onClick={() => removeLayer(layer.category, look)}
        aria-label={`Remove ${layer.product.name}`}
        data-testid={`remove-${layer.category}`}
        className="shrink-0 rounded-full p-2 text-textSecondary transition-colors duration-150 hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ✕
      </button>
    </div>
  );
}
