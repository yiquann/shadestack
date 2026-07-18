"use client";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { LayerRow } from "./LayerRow";

export function LayerPanel() {
  const { layers, moveLayer } = useTryOnSession();
  const topFirst = [...layers].reverse();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moveLayer(
      active.id as CatalogProduct["category"],
      over.id as CatalogProduct["category"]
    );
  }

  if (layers.length === 0) {
    return (
      <p data-testid="active-layers-empty" className="text-sm text-textMuted">
        No products applied yet — add one to start your look.
      </p>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={topFirst.map((l) => l.category)}
        strategy={verticalListSortingStrategy}
      >
        <div className="rounded-card border border-border">
          {topFirst.map((layer) => (
            <LayerRow key={layer.category} layer={layer} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
