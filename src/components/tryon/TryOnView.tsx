"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { useTryOnSession } from "@/lib/tryon/TryOnSessionContext";
import { ModeSourcePicker, type SourceMode } from "./ModeSourcePicker";
import { FaceMeshTracker } from "./FaceMeshTracker";
import { PhotoSource } from "./PhotoSource";
import { CameraSource } from "./CameraSource";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { AddProductsSection } from "./AddProductsSection";

type Props = {
  products: CatalogProduct[];
};

export function TryOnView({ products }: Props) {
  const { layers } = useTryOnSession();
  const [mode, setMode] = useState<SourceMode>("model");

  return (
    <main className="pb-6">
      <h1 className="px-5 pt-6 font-display text-2xl text-ink">Try On</h1>
      <div className="mt-4">
        <ModeSourcePicker active={mode} onChange={setMode} />
      </div>
      <div className="mt-4 px-5">
        {mode === "model" && <FaceMeshTracker layers={layers} />}
        {mode === "photo" && <PhotoSource layers={layers} />}
        {mode === "camera" && <CameraSource layers={layers} />}
      </div>
      <LayerPanel />
      <AddProductsSection products={products} />
    </main>
  );
}
