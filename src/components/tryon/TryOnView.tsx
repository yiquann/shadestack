"use client";

import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { ModeSourcePicker } from "./ModeSourcePicker";
import { FaceMeshTracker } from "./FaceMeshTracker";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { AddProductsSection } from "./AddProductsSection";

type Props = {
  products: CatalogProduct[];
};

export function TryOnView({ products }: Props) {
  const { layers } = useTryOnSession();

  return (
    <main className="pb-6">
      <h1 className="px-5 pt-6 font-display text-2xl text-ink">Try On</h1>
      <div className="mt-4">
        <ModeSourcePicker active="model" />
      </div>
      <div className="mt-4 px-5">
        <FaceMeshTracker layers={layers} />
      </div>
      <LayerPanel />
      <AddProductsSection products={products} />
    </main>
  );
}
