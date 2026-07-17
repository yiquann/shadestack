"use client";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { LayerRow } from "./LayerRow";

export function LayerPanel() {
  const { layers, moveLayer, clearLook } = useTryOnSession();
  const topFirst = [...layers].reverse();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moveLayer(
      active.id as CatalogProduct["category"],
      over.id as CatalogProduct["category"]
    );
  }

  return (
    <section className="px-5 py-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
        Active Layers
      </h2>
      {layers.length === 0 ? (
        <p data-testid="active-layers-empty" className="mt-3 text-sm text-textMuted">
          No products applied yet — add one below to start your look.
        </p>
      ) : (
        <>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={topFirst.map((l) => l.category)}
              strategy={verticalListSortingStrategy}
            >
              <div className="mt-2 rounded-card border border-border">
                {topFirst.map((layer) => (
                  <LayerRow key={layer.category} layer={layer} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            onClick={clearLook}
            data-testid="clear-look-button"
            className="mt-3 rounded-pill border border-border px-4 py-2 text-xs font-semibold text-textSecondary transition-colors duration-150 hover:bg-chip/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Clear Look
          </button>
        </>
      )}
    </section>
  );
}
