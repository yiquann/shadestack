"use client";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { LookId } from "@/lib/tryon/session";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { LayerRow } from "./LayerRow";

type Props = {
  look: LookId;
  /** Suppresses the built-in "Active Layers" heading when a caller (e.g. the drawer) supplies its own. */
  hideHeading?: boolean;
};

export function LayerPanel({ look, hideHeading }: Props) {
  const { looks, moveLayer } = useTryOnSession();
  const layers = looks[look];
  const topFirst = [...layers].reverse();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = String(active.id).split(":")[1] as CatalogProduct["category"];
    const to = String(over.id).split(":")[1] as CatalogProduct["category"];
    moveLayer(from, to, look);
  }

  return (
    <section>
      {!hideHeading && (
        <h2 className="text-[11px] font-bold uppercase tracking-[0.8px] text-textMuted">
          Active Layers
        </h2>
      )}
      {layers.length === 0 ? (
        <p data-testid="active-layers-empty" className="mt-3 text-sm text-textMuted">
          No products applied yet — add one below to start your look.
        </p>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={topFirst.map((l) => `${look}:${l.category}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-2 rounded-card border border-border">
              {topFirst.map((layer) => (
                <LayerRow key={layer.category} layer={layer} look={look} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
